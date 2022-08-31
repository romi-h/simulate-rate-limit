cbw
========

[![npm version](https://badge.fury.io/js/cbw.svg)](https://badge.fury.io/js/cbw)
![Build Status](https://github.com/Adslot/node-cbw/actions/workflows/node.js.yml/badge.svg)

Callback wrapper for cleaner async code. Main benefit is you don't need to write `if (err) return cb(err)`.


## Usage


```javascript
var cbw = require('cbw');

var doSomething = function(cb) {
  getUsers(cbw(cb)(function(users) {
    getArticles(cbw(cb)(function(articles) {
      cb(null, [users, articles]);
    }));
  }));
};

```

## License

MIT
