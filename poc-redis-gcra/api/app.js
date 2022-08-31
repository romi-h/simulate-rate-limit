
module.exports = () => {


  const path = require('path');
  const express = require('express');
  const auth = require('./auth');

  // -------------- TIME BUCKET LIMITER -----------------------------
  const { rateLimit } = require('../express-rate-limit/lib');

  // 60req/30secs PER IP    -> i.e. 2 req/sec avg
  const apiPublicLimiterMw = rateLimit({
    windowMs: 30 * 1000,
    max: 60,               // Limit each IP to 'max' requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    keyGenerator: (req, res) => req.ip,
  });

  // ALLOW BURST
  // 15req/1secs PER IP
  const apiPublicBurstLimiterMw = rateLimit({
    windowMs: 1 * 1000,
    max: 15,               // Limit each IP to 'max' requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    keyGenerator: (req, res) => req.ip,
  });

  // 60req/30secs PER USER   -> i.e. 2 req/sec avg
  const apiPrivateLimiterMw = rateLimit({
    windowMs: 30 * 1000,
    max: 60,               // Limit each USER to 'max' requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    keyGenerator: (req, res) => req.session.id,
  });


  // -------------- GCRA LIMITER -----------------------------
  const Redis = require('ioredis');
  const RedisGCRA = require('../redis-gcra/lib');
  const keyPrefix = process.env.NODE_ENV || 'development';
  const redisConfig = {
    "host": "localhost",
    "port": 6379,
    "tls": false
  };

  const redisClient = new Redis({ keyPrefix, ...redisConfig });
  //https://github.com/Losant/redis-gcra
  const limiterGcra = RedisGCRA({
    redis: redisClient,
    keyPrefix,        // DEFAULTS
    burst: 20,        // limit on maximum tokens available
    rate: 10,         // rate at which tokens regenerate per period
    period: 1000,     // period, in milliseconds, for token regeneration
    cost: 1           // cost in tokens for this limit request
  });

  Promise.all([
    limiterGcra.reset({ key: '127.0.0.1' }),
    limiterGcra.reset({ key: '0.0.0.0' }),
    limiterGcra.reset({ key: 'one' }),
    limiterGcra.reset({ key: 'two' })
  ]).then(() => {console.log('GCRA LIMITER RESET DONE')});


  const apiPublicLimiterGcraMw = async (req, res, next) => {
    const gcraLimits = await limiterGcra.limit({
      key: req.ip,     // LIMIT BY IP
      burst: 20,       // limit on maximum tokens available
      rate: 2,         // rate at which tokens regenerate per period
      period: 1000,    // period, in milliseconds, for token regeneration
      cost: 1          // cost in tokens for this limit request
    });
    req.gcraLimits = gcraLimits;

    //console.log({gcraLimits});

    if (gcraLimits?.limited) {
      return res.send(429);
    }

    next();
  };

  const apiPrivateLimiterGcraMw = async (req, res, next) => {
    const gcraLimits = await limiterGcra.limit({
      key: req.session.id, // LIMIT BY USER
      burst: 20,       // limit on maximum tokens available
      rate: 2,         // rate at which tokens regenerate per period
      period: 1000,    // period, in milliseconds, for token regeneration
      cost: 1          // cost in tokens for this limit request
    });
    req.gcraLimits = gcraLimits;
    console.log({gcraLimits});
    if (gcraLimits?.limited) {
      return res.send(429);
    }

    next();
  };


  // ------------------- EXPRESS APP ----------------------
  const app = express();

  // root path
  app.get(['/', '/healthcheck'], (req, res) => res.sendStatus(200));

  app.get('/dashboard', (req,res) => {
    res.sendFile(path.join(__dirname+'/dashboard.html'));
  });


  //------------------------- PUBLIC API -----------------------
  const publicMw = (req, res) => res.json({ data: 'public', gcraLimits: req.gcraLimits });

  app.get('/api/public', publicMw);
  app.get('/express-rate-limit/public', apiPublicLimiterMw, publicMw);
  app.get('/express-rate-limit/public-burst', apiPublicBurstLimiterMw, apiPublicLimiterMw, publicMw);
  app.get('/gcra-rate-limit/public', apiPublicLimiterGcraMw, publicMw);



  //------------------------- PRIVATE API -----------------------


  app.use(auth.check);

  const privateMw = (req, res) => res.json({ data: 'private', gcraLimits: req.gcraLimits });

  app.get('/api/private', privateMw);
  app.use('/express-rate-limit/private', apiPrivateLimiterMw, privateMw);
  app.get('/gcra-rate-limit/private', apiPrivateLimiterGcraMw, privateMw);




  return app;
};
