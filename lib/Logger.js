'use strict';

const _ = require('lodash');
const cursor = require('ansi')(process.stdout);

const CHAR_CHECK = (new Buffer('E29C94EFB88E', 'hex')).toString();
const CHAR_EX = (new Buffer('E29C98', 'hex')).toString();
const CHAR_LEFT_DOUBLE_ANGLE = (new Buffer('C2AB', 'hex')).toString();
const CHAR_RIGHT_DOUBLE_ANGLE = (new Buffer('C2BB', 'hex')).toString();
const CHAR_INFINITY = '∞';

const MAX_LINKS_FROM = process.env.MAX_LINKS_FROM || 5;
const MAX_REDIRECTS_FROM = process.env.MAX_REDIRECTS_FROM || 5;

/**
 * Clears the cursor's current line.
 */
function clearLine() {
  cursor.horizontalAbsolute(0).eraseLine();
}

/**
 * Sets the text color to red if there's an error, otherwise sets to green.
 * @param {Boolean} isError true if logging an error.
 */
function setTextColor(isError) {
  if (isError) {
    cursor.brightRed();
  } else {
    cursor.brightGreen();
  }
}

module.exports = function (crawler, verbose) {
  if (verbose) {
    cursor
      .reset()
      .write('\n\n========================\nConfiguration\n========================\n')
      .write(JSON.stringify(crawler, null, '  '))
      .write('\n');
  }

  cursor.reset().write('\n\n========================\nRunning\n========================\n');

  return {
    links: {},
    warnings: [],
    errors: [],
    notFound: [],
    ignored: [],
    successes: [],
    redirects: {},
    redirectsFrom: {},
    mimes: {},
    timeouts: [],

    /**
     * Track the number of MIME types encountered by the spider.
     * @param {Object} queueItem the queueItem
     */
    trackMime(queueItem) {
      let mime;

      // Save off the mime count, if applicable.
      if (queueItem && queueItem.stateData && queueItem.stateData.contentType) {
        mime = queueItem.stateData.contentType.toString().toLowerCase();
        mime = mime.replace(/\s+/g, '');
        if (!this.mimes[mime]) {
          this.mimes[mime] = 1;
        } else {
          this.mimes[mime] += 1;
        }
      }
    },

    /**
     * Log a successful request/response cycle.
     * @param {Object} queueItem the queueItem
     */
    logSuccess(queueItem) {
      const parent = this;

      crawler.queue.countItems({ fetched: true }, (countItemsErr, completeCount) => {
        if (countItemsErr) {
          throw countItemsErr;
        }

        crawler.queue.getLength((getLengthErr, length) => {
          if (getLengthErr) {
            throw getLengthErr;
          }

          // Log to the console if applicable.
          if (!verbose) {
            clearLine();
            cursor.write(`fetched ${completeCount}/${length}`);
          } else {
            cursor
              .green()
              .write(CHAR_CHECK)
              .write(' ')
              .reset()
              .write(queueItem.url)
              .write('\n');
          }

          parent.trackMime(queueItem);
          parent.successes.push({ url: queueItem.url });
        });
      });
    },

    /**
     * Log a warning (which is also a success)
     * @param {Object} warning the error
     */
    logWarning(warning) {
      clearLine();
      cursor
        .brightYellow()
        .write('! ')
        .write(warning.url)
        .write('\n')
        .write(warning.warningMsg)
        .reset()
        .write('\n');
      this.warnings.push(_.omit(warning, ['queueItem']));
      if (warning.queueItem) {
        this.logSuccess(warning.queueItem);
      }
    },

    /**
     * Log a 404 response.
     * @param {Object} url the url
     */
    log404(url) {
      clearLine();
      cursor
        .brightRed()
        .write(CHAR_EX)
        .write(' ')
        .write(url)
        .reset()
        .write('\n');
      this.notFound.push({
        url
      });
    },

    /**
     * Log a generic error.
     * @param {Object} error the error
     */
    logError(error) {
      clearLine();
      cursor
        .brightRed()
        .write(CHAR_EX)
        .write(' ')
        .write(error.url)
        .write('\n')
        .write(error.msg)
        .reset()
        .write('\n');
      this.errors.push(_.omit(error, ['queueItem']));
    },

    /**
     * Log a message letting the user know a URL was ignored.
     * @param {URL} parsedURL the URL that was ignored
     */
    logIgnore(parsedURL) {
      const url = parsedURL.url;

      if (verbose && crawler.ignored.indexOf(url) === -1) {
        clearLine();
        cursor
          .grey()
          .write('_ ')
          .write(parsedURL.url)
          .reset()
          .write('\n');
      }
      this.ignored.push(url);
      crawler.ignored.push(url);
    },

    /**
     * Let the user know a URL was redirected.
     * @param {Object} queueItem the associated queueItem
     * @param {URL} parsedURL the URL redirected from
     */
    logRedirect(queueItem, parsedURL) {
      const url = parsedURL.url;

      if (verbose) {
        clearLine();
        cursor
          .cyan()
          .write(CHAR_RIGHT_DOUBLE_ANGLE)
          .write(' ')
          .write(queueItem.url)
          .write('\n')
          .write(CHAR_LEFT_DOUBLE_ANGLE)
          .write(' ')
          .write(url)
          .reset()
          .write('\n');
      }

      this.redirects[queueItem.url] = url;
      if (!this.redirectsFrom[url]) {
        this.redirectsFrom[url] = [];
      }
      this.redirectsFrom[url].push(queueItem.url);
      this.successes.push({ url: queueItem.url });
    },

    /**
     * Log the fact that a request timed out.
     * @param {error} error the request error
     */
    logTimeout(error) {
      clearLine();
      cursor
        .magenta()
        .write(CHAR_INFINITY)
        .write(' ')
        .write(error.url)
        .reset()
        .write('\n');

      this.timeouts.push(error.url);
    },

    /**
     * Register a relationship between two URLs.
     * @param {String} sourceURL the source URL
     * @param {String} targetURL the target URL
     */
    registerLink(sourceURL, targetURL) {
      if (!this.links[targetURL]) {
        this.links[targetURL] = [];
      }
      this.links[targetURL].push(sourceURL);
    },

    /**
     * Generate a comprehensive report on the run.
     * @returns {number} the total number of errors found, to be used as an exit code for a process
     */
    report() {
      const exitCode = this.errors.length + this.notFound.length + this.timeouts.length;
      const self = this;

      /**
       * Truncate the array, adding a descriptive last item that counts the remainder.
       * @param {Number} size the size of the array
       * @param {array} ary the array to truncate
       * @returns {array} ary the array to truncate
       */
      function truncateFrom(size, ary) {
        let retAry;

        if (ary && (size > 0) && ary.length && (ary.length > size)) {
          retAry = ary.slice(0, size);
          retAry.push(`and ${ary.length - size} more...`);

          return retAry;
        }

        return ary;
      }

      /**
       * Attach detail to each report item.
       * @param {object} item the item
       * @returns {Number} Returns the item passed in.
       */
      function attachDetail(item) {
        // Find all redirects in the chain.
        let workingSet = self.redirectsFrom[item.url];
        let redirectFromSet;
        let url;

        if (workingSet) {
          redirectFromSet = [];
          while (workingSet.length > 0) {
            url = workingSet.pop();
            redirectFromSet.push(url);
            if (self.redirectsFrom[url]) {
              workingSet = workingSet.concat(self.redirectsFrom[url]);
            }
          }
          item.redirectFrom = truncateFrom(MAX_REDIRECTS_FROM, redirectFromSet);
        }

        // Find all links to this URL from other URLs.  Hash link errors set their own hashLinkFrom for this purpose.
        item.linkedFrom = item.hashLinkFrom || truncateFrom(MAX_LINKS_FROM, self.links[item.url]);
        delete item.hashLinkFrom;

        return item;
      }

      // If verbose, attach linkedFrom to each warning, error, and 404.
      this.notFound = _.map(this.notFound, attachDetail);
      this.errors = _.map(this.errors, attachDetail);
      if (verbose) {
        this.warnings = _.map(this.warnings, attachDetail);
        this.successes = _.map(this.successes, attachDetail);
      }
      this.notFound = _.sortBy(this.notFound, 'url');
      this.errors = _.sortBy(this.errors, 'url');
      this.warnings = _.sortBy(this.warnings, 'url');
      this.successes = _.sortBy(this.successes, 'url');
      this.timeouts = this.timeouts.sort();

      // Log the results.
      cursor
        .reset()
        .write('\n\n========================\nSummary\n========================\n')
        .write('success count:\t')
        .write(`${this.successes.length}`)
        .write('\n');
      cursor
        .write('mime counts (note these will not match success count total due to redirects):\n')
        .write(JSON.stringify(this.mimes, null, '  '))
        .write('\n');

      if (verbose) {
        cursor
          .write('redirects:\n')
          .write(JSON.stringify(this.redirects, null, '  '))
          .write('\n');
        cursor
          .write('successes: ')
          .write(JSON.stringify(this.successes, null, '  '))
          .write('\n');
        cursor
          .write('ignored: ')
          .write(JSON.stringify(_.uniq(this.ignored).sort()))
          .write('\n');
        cursor.write('warning count: ');
        setTextColor(this.warnings.length !== 0);
        cursor
          .write(`${this.warnings.length}\n`)
          .reset();
        if (this.warnings.length > 0) {
          cursor
            .write('warnings: ')
            .write(JSON.stringify(this.warnings, null, '  '))
            .write('\n');
        }
      }

      cursor.write('timeout count: ');
      setTextColor(this.timeouts.length !== 0);
      cursor
        .write(`${this.timeouts.length}\n`)
        .reset();
      if (this.timeouts.length > 0) {
        cursor
          .write('timeouts: ')
          .write(JSON.stringify(this.timeouts, null, '  '))
          .write('\n');
      }

      cursor.write('error count: ');
      setTextColor(this.errors.length !== 0);
      cursor
        .write(`${this.errors.length}\n`)
        .reset();
      if (this.errors.length > 0) {
        cursor
          .write('errors: ')
          .write(JSON.stringify(this.errors, null, '  '))
          .write('\n');
      }

      cursor.write('not found count: ');
      setTextColor(this.notFound.length !== 0);
      cursor
        .write(`${this.notFound.length}\n`)
        .reset();
      if (this.notFound.length > 0) {
        cursor
          .write('not found: ')
          .write(JSON.stringify(this.notFound, null, '  '))
          .write('\n');
      }

      cursor.write('\n\nTotal error count: ');
      setTextColor(exitCode > 0);
      cursor.write(`${exitCode}`);
      cursor.reset();
      cursor.write('\n\n');

      return exitCode;
    }
  };
};
