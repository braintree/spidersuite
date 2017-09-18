'use strict';

const configUtil = require('./config/configUtil')();

module.exports = function ErrorHandler(config, logger) {
  /**
   * Handle a 4xx or 5xx server error
   * @param {Number} httpCode the http code, between 400 and 510, inclusive
   * @param {Object} queueItem the simplecrawler QueueItem
   */
  function handleFetchServerError(httpCode, queueItem) {
    const configKey = `http${httpCode}WarnOnlyPatterns`;

    const firstMatchingPattern = configUtil.getFirstMatchingPattern(
      config[configKey],
      queueItem.url,
      config.rootUrl
    );

    if (firstMatchingPattern) {
      logger.logWarning({
        code: httpCode,
        url: queueItem.url.toString(),
        queueItem,
        warningMsg: `Ignoring ${httpCode} as configured by ${firstMatchingPattern}`
      });
    } else if (httpCode === 404) {
      logger.log404(queueItem.url);
    } else {
      logger.logError({
        code: httpCode,
        url: queueItem.url.toString(),
        msg: `Http code ${httpCode}`,
        queueItem
      });
    }
  }


  /**
   * A fetch failed somehow. Generate and handle it as an error.
   * @param {Object} queueItem the simplecrawler QueueItem
   * @param {String} simpleCrawlerEventName the simplecrawler event triggered.
   */
  function handleFetchError(queueItem, simpleCrawlerEventName) {
    const code = queueItem.stateData.code;
    let error;

    if (code >= 400 && code <= 510) {
      handleFetchServerError(code, queueItem);
    } else {
      error = {
        code,
        simpleCrawlerEventName,
        msg: 'Spider fetch error',
        url: queueItem.url.toString(),
        status: queueItem.status,
        queueItem
      };

      if (queueItem.status === 'timeout') {
        logger.logTimeout(error);
      } else {
        logger.logError(error);
      }
    }
  }


  /**
   * A fetch failed somehow. Generate and handle it as an error.
   * @param {Object} queueItem the simplecrawler QueueItem
   * @param {String} simpleCrawlerEventName the simplecrawler event triggered.
   * @param {String} clientError the client error object.
   */
  function handleFetchClientError(queueItem, simpleCrawlerEventName, clientError) {
    const error = {
      code: queueItem.stateData.code,
      simpleCrawlerEventName,
      msg: JSON.stringify(clientError),
      url: queueItem.url.toString(),
      status: queueItem.status,
      queueItem
    };

    logger.logError(error);
  }


  /**
   * A hash was not found on the target page that was expected.
   * @param {String} url the url
   * @param {String} id the hash id
   * @param {String} hashLinkFrom url where this hash is linked
   * @param {Array} redirects list of redirects of the original url
   */
  function handleHashError(url, id, hashLinkFrom, redirects) {
    const firstMatchingPattern = configUtil.getFirstMatchingPattern(
      config.hashNotFoundWarnOnlyPatterns,
      url,
      config.rootUrl
    );
    const hashUrl = `${url}#${id}`;

    if (firstMatchingPattern) {
      logger.logWarning({
        url: hashUrl,
        hashLinkFrom: [hashLinkFrom],
        redirects,
        warningMsg: `Ignoring hash not found as configured by ${firstMatchingPattern}`
      });
    } else {
      logger.logError({
        url: hashUrl,
        hashLinkFrom: [hashLinkFrom],
        redirects,
        msg: 'Hash not found'
      });
    }
  }

  /**
   * The title failed the validation.
   * @param {Object} error the error.
   */
  function handleTitleError(error) {
    logger.logError(error);
  }

  /**
   * Handle any other queue errors not related to fetching
   * @param {Object} error the error.
   */
  function handleQueueError(error) {
    logger.logError(error);
  }

  return {
    handleFetchServerError,
    handleFetchError,
    handleFetchClientError,
    handleHashError,
    handleTitleError,
    handleQueueError
  };
};
