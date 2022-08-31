// /source/lib.ts
// The option parser and rate limiting middleware
const { MemoryStore }= require('./memory-store');
/**
 * Type guard to check if a store is legacy store.
 *
 * @param store {LegacyStore | Store} - The store to check.
 *
 * @return {boolean} - Whether the store is a legacy store.
 */
const isLegacyStore = (store) =>
// Check that `incr` exists but `increment` does not - store authors might want
// to keep both around for backwards compatibility.
  typeof store.incr === 'function' &&
  typeof store.increment !== 'function';
/**
 * Converts a legacy store to the promisified version.
 *
 * @param store {LegacyStore | Store} - The store passed to the middleware.
 *
 * @returns {Store} - The promisified version of the store.
 */
const promisifyStore = (passedStore) => {
  if (!isLegacyStore(passedStore)) {
    // It's not an old store, return as is
    return passedStore;
  }
  const legacyStore = passedStore;
  // A promisified version of the store
  class PromisifiedStore {
    async increment(key) {
      return new Promise((resolve, reject) => {
        legacyStore.incr(key, (error, totalHits, resetTime) => {
          if (error)
            reject(error);
          resolve({ totalHits, resetTime });
        });
      });
    }
    async decrement(key) {
      return legacyStore.decrement(key);
    }
    async resetKey(key) {
      return legacyStore.resetKey(key);
    }
    async resetAll() {
      if (typeof legacyStore.resetAll === 'function')
        return legacyStore.resetAll();
    }
  }
  return new PromisifiedStore();
};
/**
 * Type-checks and adds the defaults for options the user has not specified.
 *
 * @param options {Options} - The options the user specifies.
 *
 * @returns {Configuration} - A complete configuration object.
 */
const parseOptions = (passedOptions) => {
  var _a, _b, _c;
  // Passing undefined should be equivalent to not passing an option at all, so we'll
  // omit all fields where their value is undefined.
  const notUndefinedOptions = omitUndefinedOptions(passedOptions);
  // See ./types.ts#Options for a detailed description of the options and their
  // defaults.
  const config = Object.assign(
    Object.assign(
      {
        windowMs: 60 * 1000,
        max: 5,
        message: 'Too many requests, please try again later.',
        statusCode: 429,
        legacyHeaders: (_a = passedOptions.headers) !== null && _a !== void 0 ? _a : true,
        standardHeaders: (_b = passedOptions.draft_polli_ratelimit_headers) !== null && _b !== void 0 ? _b : false,
        requestPropertyName: 'rateLimit',
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
        requestWasSuccessful: (_request, response) => response.statusCode < 400,
        skip: (_request, _response) => false,
        keyGenerator(request, _response) {
          if (!request.ip) {
            console.error('WARN | `express-rate-limit` | `request.ip` is undefined. You can avoid this by providing a custom `keyGenerator` function, but it may be indicative of a larger issue.');
          }
          return request.ip;
        },
        async handler(request, response, _next, _optionsUsed) {
          // Set the response status code
          response.status(config.statusCode);
          // Call the `message` if it is a function.
          const message = typeof config.message === 'function'
            ? await config.message(request, response)
            : config.message;
          // Send the response if writable.
          if (!response.writableEnded) {
            response.send(message !== null && message !== void 0 ? message : 'Too many requests, please try again later.');
          }
        },
        onLimitReached(_request, _response, _optionsUsed) { }
      },
      notUndefinedOptions
    ),
    {
      // Note that this field is declared after the user's options are spread in,
      // so that this field doesn't get overriden with an un-promisified store!
      store: promisifyStore((_c = notUndefinedOptions.store) !== null && _c !== void 0 ? _c : new MemoryStore())
    }
  );
  // Ensure that the store passed implements the `Store` interface
  if (typeof config.store.increment !== 'function' ||
      typeof config.store.decrement !== 'function' ||
      typeof config.store.resetKey !== 'function' ||
      (typeof config.store.resetAll !== 'undefined' &&
        typeof config.store.resetAll !== 'function') ||
      (typeof config.store.init !== 'undefined' &&
        typeof config.store.init !== 'function')) {
    throw new TypeError('An invalid store was passed. Please ensure that the store is a class that implements the `Store` interface.');
  }
  return config;
};
/**
 * Just pass on any errors for the developer to handle, usually as a HTTP 500
 * Internal Server Error.
 *
 * @param fn {RequestHandler} - The request handler for which to handle errors.
 *
 * @returns {RequestHandler} - The request handler wrapped with a `.catch` clause.
 *
 * @private
 */
const handleAsyncErrors = (fn) => async (request, response, next) => {
  try {
    await Promise.resolve(fn(request, response, next)).catch(next);
  }
  catch (error) {
    next(error);
  }
};
/**
 *
 * Create an instance of IP rate-limiting middleware for Express.
 *
 * @param passedOptions {Options} - Options to configure the rate limiter.
 *
 * @returns {RateLimitRequestHandler} - The middleware that rate-limits clients based on your configuration.
 *
 * @public
 */
exports.rateLimit = (passedOptions) => {
  // Parse the options and add the default values for unspecified options
  const options = parseOptions(passedOptions !== null && passedOptions !== void 0 ? passedOptions : {});
  // Call the `init` method on the store, if it exists
  if (typeof options.store.init === 'function')
    options.store.init(options);
  // Then return the actual middleware
  const middleware = handleAsyncErrors(async (request, response, next) => {
    // First check if we should skip the request
    const skip = await options.skip(request, response);
    if (skip) {
      next();
      return;
    }
    // Create an augmented request
    const augmentedRequest = request;
    // Get a unique key for the client
    const key = await options.keyGenerator(request, response);
    // Increment the client's hit counter by one
    const { totalHits, resetTime } = await options.store.increment(key);
    // Get the quota (max number of hits) for each client
    const retrieveQuota = typeof options.max === 'function'
      ? options.max(request, response)
      : options.max;
    const maxHits = await retrieveQuota;
    // Set the rate limit information on the augmented request object
    augmentedRequest[options.requestPropertyName] = {
      limit: maxHits,
      current: totalHits,
      remaining: Math.max(maxHits - totalHits, 0),
      resetTime,
    };
    // Set the X-RateLimit headers on the response object if enabled
    if (options.legacyHeaders && !response.headersSent) {
      response.setHeader('X-RateLimit-Limit', maxHits);
      response.setHeader('X-RateLimit-Remaining', augmentedRequest[options.requestPropertyName].remaining);
      // If we have a resetTime, also provide the current date to help avoid issues with incorrect clocks
      if (resetTime instanceof Date) {
        response.setHeader('Date', new Date().toUTCString());
        response.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000));
      }
    }
    // Set the standardized RateLimit headers on the response object
    // if enabled
    if (options.standardHeaders && !response.headersSent) {
      response.setHeader('RateLimit-Limit', maxHits);
      response.setHeader('RateLimit-Remaining', augmentedRequest[options.requestPropertyName].remaining);
      if (resetTime) {
        const deltaSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
        response.setHeader('RateLimit-Reset', Math.max(0, deltaSeconds));
      }
    }
    // If we are to skip failed/successfull requests, decrement the
    // counter accordingly once we know the status code of the request
    if (options.skipFailedRequests || options.skipSuccessfulRequests) {
      let decremented = false;
      const decrementKey = async () => {
        if (!decremented) {
          await options.store.decrement(key);
          decremented = true;
        }
      };
      if (options.skipFailedRequests) {
        response.on('finish', async () => {
          if (!options.requestWasSuccessful(request, response))
            await decrementKey();
        });
        response.on('close', async () => {
          if (!response.writableEnded)
            await decrementKey();
        });
        response.on('error', async () => {
          await decrementKey();
        });
      }
      if (options.skipSuccessfulRequests) {
        response.on('finish', async () => {
          if (options.requestWasSuccessful(request, response))
            await decrementKey();
        });
      }
    }
    // Call the `onLimitReached` callback on the first request where client
    // exceeds their rate limit
    // NOTE: `onLimitReached` is deprecated, this should be removed in v7.x
    if (maxHits && totalHits === maxHits + 1) {
      options.onLimitReached(request, response, options);
    }
    // If the client has exceeded their rate limit, set the Retry-After header
    // and call the `handler` function
    if (maxHits && totalHits > maxHits) {
      if ((options.legacyHeaders || options.standardHeaders) &&
        !response.headersSent) {
        response.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
      }
      options.handler(request, response, next, options);
      return;
    }
    next();
  });
  middleware.resetKey =
    options.store.resetKey.bind(options.store);
  return middleware;
};
/**
 *
 * Remove any options where their value is set to undefined. This avoids overwriting defaults
 * in the case a user passes undefined instead of simply omitting the key.
 *
 * @param passedOptions {Options} - The options to omit.
 *
 * @returns {Options} - The same options, but with all undefined fields omitted.
 *
 * @private
 */
const omitUndefinedOptions = (passedOptions) => {
  const omittedOptions = {};
  for (const k of Object.keys(passedOptions)) {
    const key = k;
    if (passedOptions[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      omittedOptions[key] = passedOptions[key];
    }
  }
  return omittedOptions;
};
