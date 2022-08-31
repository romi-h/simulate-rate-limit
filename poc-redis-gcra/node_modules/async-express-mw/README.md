# Async Express MW

> _Just wraps express middlewares so that you can use `async` functions and have the error passed onto the `next` function._

[![Build Status](https://travis-ci.org/lteacher/async-express-mw.svg?branch=master)](https://travis-ci.org/lteacher/async-express-mw)
[![Coverage Status](https://coveralls.io/repos/github/lteacher/async-express-mw/badge.svg?branch=master)](https://coveralls.io/github/lteacher/async-express-mw?branch=master)
[![npm version](https://badge.fury.io/js/async-express-mw.svg)](https://badge.fury.io/js/async-express-mw)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/lteacher/async-express-mw/master/LICENSE.md)


Similar to other existing packages it simply provides a lightweight wrapper function which passes any error to the express js `next` function. There were some other packages that needed to transpile, had dependencies or didnt have all features such as allowing array, and error handler so created this. Use it if you want.

## Usage

Just wrap middlewares with the async wrap thing

```javascript
// You can use import / export if you want
const wrap = require('async-express-mw');

// Some middleware function can be wrapped
const wrappedMwThing = wrap(async (req, res, next) => {/* does something magical */});

// Multiple mw can be wrapped by providing an array
const firstAmazingMw = async (req, res, next) => {/* does amazing stuff */}
const otherMw = async (req, res, next) =>  {/* does other stuff */}

// Wrapped maybe to express or router
app.get('/amazing-thing/:id', wrap([firstAmazingMw, otherMw]));

// Allows async error mw just as long as, per usual, the handler has the 4 param sig
const errorMw = async (err, req, res, next) => {/* handles all the errorz */}

app.use('/amazing-thing/:id', wrap(errorMw));
```
