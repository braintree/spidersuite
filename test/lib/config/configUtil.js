'use strict';

const chai = require('chai');

const configUtil = require('../../../lib/config/configUtil')();

const assert = chai.assert;

describe('getFirstMatchingPattern', () => {
  it('should return a matching pattern when the first matches', () => {
    const patterns = ['https:\\/\\/example\\.com'];

    assert.equal(patterns[0], configUtil.getFirstMatchingPattern(patterns, 'https://example.com'));
  });

  it('should return the first matching pattern when more than one matches', () => {
    const patterns = ['https:\\/\\/example\\.com', 'com', 'example'];

    assert.equal(patterns[0], configUtil.getFirstMatchingPattern(patterns, 'https://example.com'));
    assert.equal(patterns[1], configUtil.getFirstMatchingPattern(patterns, 'https://github.com'));
    assert.equal(patterns[2], configUtil.getFirstMatchingPattern(patterns, 'https://example.org'));
  });

  it('should return undefined when it does not match', () => {
    const patterns = ['https:\\/\\/example\\.com'];

    assert.isUndefined(configUtil.getFirstMatchingPattern(patterns, 'https://github.com'));
  });

  it('should return undefined when the patterns is empty', () => {
    assert.isUndefined(configUtil.getFirstMatchingPattern(undefined, 'https://example.com'));
    assert.isUndefined(configUtil.getFirstMatchingPattern([], 'https://example.com'));
  });

  it('should return the first matching ROOT_URL replacement', () => {
    const patterns = ['^#{ROOT_URL}\\/lala\\/$'];

    assert.equal(patterns[0],
      configUtil.getFirstMatchingPattern(patterns, 'https://localhost:9999/lala/', 'https://localhost:9999'));
  });

  it('should return undefined if the ROOT_URL replacement still does not match', () => {
    const patterns = ['^#{ROOT_URL}\\/lala\\/$'];

    assert.isUndefined(configUtil.getFirstMatchingPattern(patterns, 'https://example.com', 'https://localhost:9999'));
  });
});
