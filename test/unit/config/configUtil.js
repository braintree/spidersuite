'use strict';

var _ = require('lodash');
var chai = require('chai');
var assert = chai.assert;
var path = require('path');
var configUtil = require(path.resolve('lib/config/configUtil'))();

describe('getFirstMatchingPattern', function () { 
  it('should return a matching pattern when the first matches', function (done) {
    var patterns = ["https:\\/\\/example\\.com"];

    assert.equal(patterns[0], configUtil.getFirstMatchingPattern(patterns, "https://example.com"));

    done();
  });

  it('should return the first matching pattern when more than one matches', function (done) {
    var patterns = ["https:\\/\\/example\\.com", "com", "example"];

    assert.equal(patterns[0], configUtil.getFirstMatchingPattern(patterns, "https://example.com"));
    assert.equal(patterns[1], configUtil.getFirstMatchingPattern(patterns, "https://github.com"));
    assert.equal(patterns[2], configUtil.getFirstMatchingPattern(patterns, "https://example.org"));

    done();
  });

  it('should return undefined when it does not match', function (done) {
    var patterns = ["https:\\/\\/example\\.com"];

    assert.isUndefined(configUtil.getFirstMatchingPattern(patterns, "https://github.com"));

    done();
  });

  it('should return undefined when the patterns is empty', function (done) {
    assert.isUndefined(configUtil.getFirstMatchingPattern(undefined, "https://example.com"));
    assert.isUndefined(configUtil.getFirstMatchingPattern([], "https://example.com"));

    done();
  });

  it('should return the first matching ROOT_URL replacement', function (done) {
    var patterns = [ "^#{ROOT_URL}\\/lala\\/$" ];

    assert.equal(patterns[0], 
      configUtil.getFirstMatchingPattern(patterns, "https://localhost:9999/lala/", "https://localhost:9999"));

    done();
  });

  it('should return undefined if the ROOT_URL replacement still does not match', function (done) {
    var patterns = [ "^#{ROOT_URL}\\/lala\\/$" ];

    assert.isUndefined(configUtil.getFirstMatchingPattern(patterns, "https://example.com", "https://localhost:9999"));

    done();
  });
});
