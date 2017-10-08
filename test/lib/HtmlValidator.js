'use strict';

const chai = require('chai');
const cheerio = require('cheerio');

const HtmlValidator = require('../../lib/HtmlValidator');

const assert = chai.assert;

describe('HtmlValidator', () => {
  describe('titleMatches', () => {
    const pattern = 'MyCompany';
    const myValidator = new HtmlValidator(pattern);

    [
      '<html><head><title>MyCompany</title></head></html>',
      '<html><head><title>This is MyCompany</title></head></html>',
      '<html><head><title>MyCompany is awesome</title></head></html>',
      '<head><title>MyCompany not surrounded by html</title></head>',
      '<title>MyCompany not surrounded by html or head</title>'
    ].forEach((rawHtml) => {
      it(`should return false if the head.title matches the pattern: ${rawHtml}`, () => {
        const $ = cheerio.load(rawHtml);

        assert.isFalse(myValidator.getTitleValidationFailure($));
      });
    });

    [
      '<html><head><title>NotMyNotCompanyNot</title></head></html>',
      '<html><head><title>My Company</title></head></html>',
      '<html><head><title>mycompany</title></head></html>',
      '<html><head><title>MYCOMPANY</title></head></html>'
    ].forEach((rawHtml) => {
      it(`should return truthy if the head.title does not match the pattern: ${rawHtml}`, () => {
        const $ = cheerio.load(rawHtml);

        assert.isTrue(!!myValidator.getTitleValidationFailure($));
      });
    });

    it('should always return false if there is no input pattern to the validator itself', () => {
      const $ = cheerio.load('<html><head><title>MyCompany</title></head></html>');

      assert.isFalse(new HtmlValidator().getTitleValidationFailure($));
    });
  });
});
