'use strict';

module.exports = function HtmlValidator(titlePattern) {
  const titleRegex = new RegExp(titlePattern);

  return {
    /**
     * Given a cheerio document, return an error if the title does not match the titlePattern.
     * Supports a document that omits html or head, as is allowed in html4 & html5.
     *
     * @param {object} $ the Cheerio document
     * @returns {boolean} error an error if the title does not match the titlePattern
     */
    getTitleValidationFailure($) {
      const titleQueries = [
        'html head',
        'head'
      ];
      let foundTitleText;

      titleQueries.forEach((query) => {
        foundTitleText = foundTitleText || $(query).find('title').text();
      });

      foundTitleText = foundTitleText || $('title').text();

      if (!titleRegex.test(foundTitleText)) {
        return {
          titlePattern,
          titleText: foundTitleText
        };
      }

      // indicates no problems, yay!
      return false;
    }
  };
};
