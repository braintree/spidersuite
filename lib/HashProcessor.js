'use strict';

const _ = require('lodash');

// Compare hashes found and expected and generate errors if necessary.
module.exports = function HashProcessor(crawler, errorHandler, logger) {
  // Object with key=URL, and value is an object that defines possible hash targets.
  const hashesFound = {};

  // Object with key=URL, and value is an object of hash targets that are expected.
  const hashesExpected = {};

  return {
    /**
     * Given a string url and a Cheerio document, find the hashes that page supports.
     * @param {String} url the url
     * @param {object} $ the Cheerio document
     */
    findSupportedHashes(url, $) {
      $('[id],a[name]').each(function findHash() {
        const $elem = $(this);
        const id = $elem.attr('id') || $elem.attr('name');

        if (!hashesFound[url]) {
          hashesFound[url] = {};
        }
        hashesFound[url][id] = true;
      });
    },

    /**
     * Given a url (and the queueItem referencing that url as a link), register any expected hashes
     * associated on that url.
     * @param {String} url the url
     * @param {Object} queueItem the queueItem that is referencing the url as a link
     */
    registerExpectedHash(url, queueItem) {
      const hashIndex = url.indexOf('#');
      let processedUrl;
      let hashContent;

      if (hashIndex >= 0) {
        // If the page links to itself (via a hash), use the current page's path.
        processedUrl = crawler.cleanExpandResources([url], queueItem)[0] || queueItem.url;

         // Store the expectation.
        hashContent = url.slice(hashIndex + 1);
        if (hashContent) {
          if (!hashesExpected[processedUrl]) {
            hashesExpected[processedUrl] = {};
          }
          hashesExpected[processedUrl][hashContent] = queueItem.url;
        }
      }
    },

    /**
     * Reconcile the expected hashes with the found hashes. Generate errors as necessary.
     */
    findErrors() {
      _.forIn(
        _.pickBy(hashesExpected,
          // don't expect hashes of ignored or disallowed urls, duh.
          (idsExpected, url) => {
            const wasIgnored = (logger.ignored.indexOf(url) !== -1)
                            || (logger.disallowed.indexOf(url) !== -1);

            return !wasIgnored;
          }),
        (idsExpected, url) => {
          let urlAfterRedirects = url;
          const redirectChain = [];

          // For a given url, follow redirects.
          while (logger.redirects[urlAfterRedirects]) {
            redirectChain.push(urlAfterRedirects);
            urlAfterRedirects = logger.redirects[urlAfterRedirects];
          }

          // Test all the hash ids expected made on the original URL.
          _.forIn(idsExpected, (linkedFrom, id) => {
            let redirects;
            let hashLinkFrom;

            // If the target hash isn't found, that's an error.
            if (!hashesFound[urlAfterRedirects] || !hashesFound[urlAfterRedirects][id]) {
              hashLinkFrom = hashesExpected[url][id];
              if (redirectChain.length > 0) {
                redirects = redirectChain.map(redirectUrl => `${redirectUrl}#${id}`);
              }

              errorHandler.handleHashError(urlAfterRedirects, id, hashLinkFrom, redirects);
            } else {
              // Hash was found, yippee!
            }
          });
        });
    }
  };
};
