'use strict'

// Executes the given middleware function
const exec = (fn, ...rest) => {
  // We should expect the next function here per express definitions
  const next = rest[rest.length - 1];

  // Always resolve in case non-promise returned, pass next for any catch
  Promise.resolve(fn(...rest)).catch(next);
}

// Creates a standard express middlware function
const standardMw = (fn) => (req, res, next) => exec(fn, req, res, next);

// Creates an express error handling middlware function
const errorMw = (fn) => (err, req, res, next) => exec(fn, err, req, res, next);

// Wraps a given middleware function
const wrap = (middleware) => {
  if (typeof middleware !== 'function') throw new Error('Middleware wrapper only accepts functions');

  return middleware.length <= 3 ? standardMw(middleware) : errorMw(middleware);
}

module.exports = (mw) => Array.isArray(mw) ? mw.map(wrap) : wrap(mw);
