'use strict';

const _ = require('lodash');
const path = require('path');
const tls = require('tls');
const cheerio = require('cheerio');
const Crawler = require('simplecrawler');
const URL = require('url');
const cursor = require('ansi')(process.stdout);

const LoggerFactory = require(path.resolve('lib/Logger'));
const ErrorHandlerFactory = require(path.resolve('lib/ErrorHandler'));
const HashProcessorFactory = require(path.resolve('lib/HashProcessor'));
const configUtil = require(path.resolve('lib/config/configUtil'))();

const mailtoMatcher = /mailto:/i;

let spooledReportTimer;

/**
 * Validate the seed url is well formed.
 *
 * @param {String} crawlerSeedUrl the crawler seed url.
 */
function validateUrl(crawlerSeedUrl) {
  let urlProtocol;

  if (!crawlerSeedUrl || !crawlerSeedUrl.protocol || !crawlerSeedUrl.hostname || !crawlerSeedUrl.path) {
    throw new Error('Invalid URL.');
  }

  // Strip off trailing colon
  urlProtocol = crawlerSeedUrl.protocol.slice(0, -1);

  if (urlProtocol !== 'https') {
    throw new Error('Spider only support https protocol.');
  }
}

/**
 * Set the config.rootUrl, for use in later functions.
 *
 * @param {object} config the spider config.
 * @param {String} crawlerSeedUrl the crawler seed url.
 */
function setConfigRootUrl(config, crawlerSeedUrl) {
  let portString = '';

  if (crawlerSeedUrl.port) {
    portString = `:${crawlerSeedUrl.port}`;
  }
  config.rootUrl = `https://${crawlerSeedUrl.hostname}${portString}`;
  cursor.reset().write(`Set config.rootUrl to ${config.rootUrl}\n`);
}

/**
 * Set the TLS settings based on the config.
 *
 * @param {object} config the spider config.
 */
function initTls(config) {
  // Deal with ciphers.
  if (!config.strictCiphers) {
    tls.DEFAULT_CIPHERS = 'ALL';
    cursor.reset().write('Relaxing cipher list to allow any cipher.\n');
  }

  // Ignore invalid SSL certs.
  if (config.simplecrawlerConfig.ignoreInvalidSSL) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
    cursor.reset().write('Ignoring invalid certificates.\n');
  }
}

/**
 * Initialize the spool, if specified.
 *
 * @param {object} config the spider config.
 * @param {object} crawler the simplecrawler object.
 */
function initSpool(config, crawler) {
  // Start the spooled report timer.
  if (config.reportSpoolInterval > 0) {
    cursor.reset().write(`Starting spool reporting every ${config.reportSpoolInterval} ms.\n`);
    spooledReportTimer = setInterval(() => {
      crawler.queue.filterItems({ status: 'spooled' }, (error, spooled) => {
        cursor.reset().write('currently spooled:\n');
        _.forEach(spooled, (item) => {
          cursor.reset().write(`  ${item.url}\n`);
        });
        cursor.reset().write('\n');
      });
    }, config.reportSpoolInterval);
  }
}

/**
 * Add fetch conditions based on `excludePatterns` property.
 *
 * @param {object} config the spider config.
 * @param {object} crawler the simplecrawler object.
 * @param {object} logger the spider logger.
 */
function initExcludePatterns(config, crawler, logger) {
  if (config.excludePatterns && config.excludePatterns.length > 0) {
    crawler.addFetchCondition((parsedURL) => {
      const firstMatchingPattern = configUtil.getFirstMatchingPattern(
        config.excludePatterns,
        parsedURL.url,
        config.rootUrl
      );

      if (firstMatchingPattern) {
        logger.logIgnore(parsedURL);
      }

      return !firstMatchingPattern;
    });
  }
}

/**
 * Add fetch conditions based on `includePatterns` property.
 *
 * @param {object} config the spider config.
 * @param {object} crawler the simplecrawler object.
 * @param {object} logger the spider logger.
 */
function initIncludePatterns(config, crawler, logger) {
  if (config.includePatterns && config.includePatterns.length > 0) {
    crawler.addFetchCondition((parsedURL) => {
      const firstMatchingPattern = configUtil.getFirstMatchingPattern(
        config.includePatterns,
        parsedURL.url,
        config.rootUrl
      );

      if (!firstMatchingPattern) {
        logger.logIgnore(parsedURL);
      }

      return !!firstMatchingPattern;
    });
  }
}

/**
 * Inject simplecrawler config into the crawler instance.
 *
 * @param {object} config the spider config.
 * @param {object} crawler the simplecrawler object.
 */
function injectCrawlerConfig(config, crawler) {
  _.forEach(config.simplecrawlerConfig, (value, key) => {
    crawler[key] = value;
  });
}

/**
 * Add any config.additionalPaths to the crawler queue.
 *
 * @param {object} config the spider config.
 * @param {object} crawler the simplecrawler object.
 */
function initAdditionalPaths(config, crawler) {
  if (config.additionalPaths) {
    _.forEach(config.additionalPaths, (relativePath) => {
      crawler.queueURL(relativePath, undefined);
    });
  }
}

/**
 * Check whether the title of the page (if present) matches the given pattern.
 *
 * @param {String} url the url
 * @param {String} pattern the pattern
 * @param {object} $ the Cheerio document
 * @param {object} errorHandler the errorHandler where to send errors.
 */
function checkTitle(url, pattern, $, errorHandler) {
  $('title').each(function () {
    const titleText = $(this).text();

    if (!new RegExp(pattern, 'g').test(titleText)) {
      errorHandler.handleTitleError({
        url,
        msg: `pattern: ${pattern} failed on title: ${titleText}`
      });
    }
  });
}

/**
 * Set up the crawler discover resources to parse and validate any html pages using cheerio.
 *
 * @param {object} config the spider config.
 * @param {object} crawler the simplecrawler object.
 * @param {object} errorHandler the errorHandler instance.
 * @param {object} hashProcessor the hashProcessor instance.
 */
function initDiscoverResources(config, crawler, errorHandler, hashProcessor) {
  // Prevent analyzing any resource outside our domain of interest.
  // Use cheerio to prune certain blocks before we scan for resources.
  // Also, remove all query strings and hashes to ensure uniformity.
  crawler.oldDiscoverResources = crawler.discoverResources;
  crawler.discoverResources = function (buf, queueItem) {
    let $;
    let list;
    let strContent;

    // Special processing for HTML
    if (queueItem.stateData.contentType.indexOf('text/html') === 0) {
      // Load the contents into Cheerio to tease apart the DOM
      // Do not parse 'URL(s)', which is a valid content string (who knew?)
      strContent = buf.toString('utf-8');
      strContent = strContent.replace(/URL\(s\)/g, '');
      $ = cheerio.load(strContent);

      // Find ids and anchor hashes and save them off! These are potential hash targets.
      hashProcessor.findSupportedHashes(queueItem.url, $);

      // If this is the host we're crawling, parse the page.
      if (queueItem.host === crawler.host) {
        if (config.titlePattern) {
          // Check the title matches the given pattern.
          checkTitle(queueItem.url, config.titlePattern, $, errorHandler);
        }

        // Do not dive into <pre>, <code>, or <svg> tags looking for resources.
        $('pre,code,svg').remove();

        // Save off expected hashes for the hrefs. Simplecrawler throws hashes away by default.
        $('a[href]').each(function () {
          const href = $(this).attr('href');

          hashProcessor.registerExpectedHash(href, queueItem);
        });

        // Go discover the embedded resources.
        list = this.oldDiscoverResources($.html(), queueItem);

        // Process URLs to remove mailto's.
        list = _.map(list, (considerURL) => {
          if (mailtoMatcher.test(considerURL)) {
            return null;
          }

          return considerURL;
        });

        // Return only unique items in the list.
        // Shuffle them, because:
        // 1. Shuffling improves throughput, since we'll hit more servers simultaneously
        // 2. Shuffling decreases likelihood we are seen as a robot by servers.
        // 3. Shuffling reduces the chance of missing a race condition error over time.
        return _.shuffle(_.uniq(list));
      }
    }

    return [];
  };
}

/**
 * Set up the other fetch and queue error handlers.
 *
 * @param {object} crawler the simplecrawler object.
 * @param {object} errorHandler the errorHandler instance.
 */
function initErrorHandlers(crawler, errorHandler) {
  // Handle fetch errors.
  crawler.on('fetch404', (queueItem) => {
    errorHandler.handleFetchServerError(404, queueItem);
  });
  crawler.on('fetcherror', (queueItem) => {
    errorHandler.handleFetchError(queueItem, 'fetcherror');
  });
  crawler.on('fetchdataerror', (queueItem) => {
    errorHandler.handleFetchError(queueItem, 'fetchdataerror');
  });
  crawler.on('gziperror', (queueItem) => {
    errorHandler.handleFetchError(queueItem, 'gziperror');
  });
  crawler.on('fetchtimeout', (queueItem) => {
    errorHandler.handleFetchError(queueItem, 'fetchtimeout');
  });

  // Handle client errors, which are a different breed altogether.
  crawler.on('fetchclienterror', (queueItem, error) => {
    errorHandler.handleFetchClientError(queueItem, 'fetchclienterror', error);
  });

  // Handle non-fetch queue error.
  crawler.on('queueerror', (error, URLData) => {
    errorHandler.handleQueueError(error, URLData);
  });
}

module.exports = function (myUrl, config, verbose) {
  return {
    crawl() {
      let crawler;
      let logger;
      let errorHandler;
      let hashProcessor;

      const crawlerSeedUrl = URL.parse(myUrl);

      validateUrl(crawlerSeedUrl);
      setConfigRootUrl(config, crawlerSeedUrl);
      initTls(config);

      crawler = new Crawler(myUrl);

      initAdditionalPaths(config, crawler);
      initSpool(config, crawler);
      injectCrawlerConfig(config, crawler);

      logger = new LoggerFactory(crawler, verbose);
      errorHandler = new ErrorHandlerFactory(config, logger);
      hashProcessor = new HashProcessorFactory(crawler, errorHandler, logger);

      initExcludePatterns(config, crawler, logger);
      initIncludePatterns(config, crawler, logger);

      initDiscoverResources(config, crawler, errorHandler, hashProcessor);
      initErrorHandlers(crawler, errorHandler);

      // This is a success callback.
      crawler.on('fetchcomplete', (queueItem) => {
        logger.logSuccess(queueItem);
      });

      // Capture links.
      crawler.on('discoverycomplete', (queueItem, resources) => {
        _.forEach(resources, (url) => {
          logger.registerLink(queueItem.url, url);
        });
      });

      // Following a redirect.
      crawler.on('fetchredirect', (queueItem, redirectURL) => {
        logger.logRedirect(queueItem, redirectURL);
      });

      // We're done.  Log a summary and exit.
      crawler.on('complete', () => {
        let exitCode;

        // Stop the spool report timer.
        if (spooledReportTimer) {
          clearInterval(spooledReportTimer);
        }

        // Find and log errors associated to hashes.
        hashProcessor.findErrors();

        // Log and finish.
        // Wait 2 seconds to exit to allow console logs a last chance to make it out.
        exitCode = logger.report();
        setTimeout(() => {
          process.exit(exitCode);
        }, 2000);
      });

      crawler.start();
    }
  };
};
