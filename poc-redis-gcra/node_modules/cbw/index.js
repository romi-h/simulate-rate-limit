
var debug = function(err) {
  if (process.env.DEBUG)
    console.info('Caught error', err, err.stack);
};


module.exports = function(cb) {
  return function(fn) {
    return function() {
      var err = arguments[0],
        args = 2 <= arguments.length ? [].slice.call(arguments, 1) : [];
      if (err) {
        debug(err);
        return cb(err);
      }
      try {
        return fn.apply(null, args);
      } catch (err) {
        debug(err);
        return cb(err);
      }
    };
  };
};
