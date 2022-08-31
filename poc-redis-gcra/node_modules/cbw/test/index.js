var assert = require('assert');
var cbw = require('../index');


describe('index', function() {

  it('should handle error', function(done) {
    var async = function(cb) {
      cb(new Error('oops'));
    };

    var handler = function(err) {
      assert.equal(err.message, 'oops');
      done();
    };

    async(cbw(handler)(function() {
      done(new Error('should not reach here'));
    }));
  });

  it('should handle result', function(done) {
    var async = function(cb) {
      cb(null, 'one', 2, false);
    };

    var handler = function(err) {
      done(new Error('should not reach here'));
    };

    async(cbw(handler)(function(one, two, three) {
      assert.equal(one, 'one');
      assert.equal(two, 2);
      assert.equal(three, false);
      done()
    }))
  })

})
