'use strict';

const _ = require('lodash');

module.exports = function () {
  /**
  * Returns the first matching pattern in the given list that matches url.
  * @param {array} urls the list of url patterns to search
  * @param {String} url the url to check against
  * @param {String} rootUrl the root url of this spider run, to be used for inserting into patterns where necessary.
  * @returns {String} the pattern that matches, or undefined if not found.
  */
  function getFirstMatchingPattern(urls, url, rootUrl) {
    let matchingPattern;

    _.forEach(urls, (pattern) => {
      const newRegex = new RegExp(pattern.replace('#{ROOT_URL}', rootUrl), 'g');

      if (newRegex.test(url)) {
        matchingPattern = pattern;

        // break out of loop
        return false;
      }

      return true; // keep going.
    });

    return matchingPattern;
  }

  return {
    getFirstMatchingPattern
  };
};
