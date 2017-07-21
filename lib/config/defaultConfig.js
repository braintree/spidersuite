'use strict';

const path = require('path');
const pkg = require(path.resolve('package'));
const version = pkg.version;

// NOTE: Configuration pieces are JS libraries, not JSON, in order to support:
// 1. regex
// 2. rule inheritance (via require)

module.exports = {
  // simplecrawler config.  See https://www.npmjs.com/package/simplecrawler#configuration.
  simplecrawlerConfig: {
    discoverRegex: [
      /\s?(?:href|src)\s?=\s?([']).*?1/ig,
      /\s?(?:href|src)\s?=\s?[^'][^\s>]+/ig,
      /\s?url\(([']).*?1\)/ig,
      /\s?url\([^'].*?\)/ig
    ],
    maxConcurrency: 10,
    maxResourceSize: 16 * 1024 * 1024, // 16 MB
    interval: 100,
    timeout: 180000,
    listenerTTL: 0,
    filterByDomain: false,
    parseHTMLComments: false,
    parseScriptTags: false,
    downloadUnsupported: true,
    ignoreInvalidSSL: true,
    userAgent: 'Braintree Spidersuite v' + version
  },

  // If false, the cipher list is relaxed.
  strictCiphers: false,

  // If greater than zero, prints out the current spool at the specified interval.
  reportSpoolInterval: 0
};
