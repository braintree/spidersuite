'use strict';

/* eslint no-use-before-define: 0 */

const fs = require('fs');
const _ = require('lodash');
const stripComments = require('strip-json-comments');
const deepmerge = require('deepmerge');
const path = require('path');
const requireUncached = require('require-uncached');

const defaultConfig = require('./defaultConfig');

const debug = require('debug')('spidersuite:configFileReader');

// Parts of this file taken from the eslint source and modified for the purposes of this app.

/**
 * Convenience wrapper for synchronously reading file contents.
 * @param {string} filePath The filename to read.
 * @returns {string} The file contents, with the BOM removed.
 * @private
 */
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, '');
}

/**
 * Loads a JSON configuration from a file.
 * @param {string} filePath The filename to load.
 * @returns {Object} The configuration object from the file.
 * @throws {Error} If the file cannot be read.
 * @private
 */
function loadJSONConfigFile(filePath) {
  try {
    return JSON.parse(stripComments(readFile(filePath)));
  } catch (e) {
    debug(`Error reading JSON file: ${filePath}`);
    e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
    throw e;
  }
}

/**
 * Loads a JavaScript configuration from a file.
 * @param {string} filePath The filename to load.
 * @returns {Object} The configuration object from the file.
 * @throws {Error} If the file cannot be read.
 * @private
 */
function loadJSConfigFile(filePath) {
  debug(`Loading JS config file: ${filePath}`);
  try {
    return requireUncached(filePath);
  } catch (e) {
    debug(`Error reading JavaScript file: ${filePath}`);
    e.message = `Cannot read config file: ${filePath}\nError: ${e.message}`;
    throw e;
  }
}

/**
 * Determines if a given string represents a filepath or not using the same
 * conventions as require(), meaning that the first character must be nonalphanumeric
 * and not the @ sign which is used for scoped packages to be considered a file path.
 * @param {string} filePath The string to check.
 * @returns {boolean} True if it's a filepath, false if not.
 * @private
 */
function isFilePath(filePath) {
  return path.isAbsolute(filePath) || !/\w|@/.test(filePath.charAt(0));
}

/**
 * Applies values from the 'extends' field in a configuration file.
 * @param {Object} config The configuration information.
 * @param {string} filePath The file path from which the configuration information
 *      was loaded.
 * @param {string} [relativeTo] The path to resolve relative to.
 * @returns {Object} A new configuration object with all of the 'extends' fields
 *      loaded and merged.
 * @private
 */
function applyExtends(config, filePath, relativeTo) {
  // normalize into an array for easier handling
  const configExtends = !Array.isArray(config.extends) ? [config.extends] : config.extends;

  // Make the last element in an array take the highest precedence
  const extendedConfig = configExtends.reduceRight((previousValue, parentPath) => {
    try {
      let loadedConfig;
      let finalParentPath = parentPath;

      if (finalParentPath === 'spider:default' || finalParentPath === 'spidersuite:default') {
        loadedConfig = _.clone(defaultConfig);
      } else if (isFilePath(finalParentPath)) {
        /*
         * If the `extends` path is relative, use the directory of the current configuration
         * file as the reference point. Otherwise, use as-is.
         */
        finalParentPath = (path.isAbsolute(parentPath)
          ? parentPath
          : path.join(relativeTo || path.dirname(filePath), parentPath)
        );

        loadedConfig = load(finalParentPath);
      } else {
        throw new Error(`extends=${finalParentPath} not supported.`);
      }
      debug(`Loading ${finalParentPath}`);

      return deepmerge(loadedConfig, previousValue);
    } catch (e) {
      /*
       * If the file referenced by `extends` failed to load, add the path
       * to the configuration file that referenced it to the error
       * message so the user is able to see where it was referenced from,
       * then re-throw.
       */
      e.message += `\nReferenced from: ${filePath}`;
      throw e;
    }
  }, config);

  return extendedConfig;
}

/**
 * Loads a configuration file from the given file path.
 * @param {Object} filePath The value from calling resolve() on a filename or package name.
 * @returns {Object} The configuration information.
 */
function load(filePath) {
  const dirname = process.cwd();
  const resolvedPath = path.resolve(dirname, filePath);
  let config;

  switch (path.extname(filePath)) {
    case '.js':
      config = loadJSConfigFile(resolvedPath);
      break;

    case '.json':
      config = loadJSONConfigFile(resolvedPath);
      break;

    default:
      throw new Error(`${filePath} does not match a known extension`);
  }

  /*
   * If an `extends` property is defined, it represents a configuration file to use as
   * a 'parent'. Load the referenced file and merge the configuration recursively.
   */
  if (config.extends) {
    config = applyExtends(config, resolvedPath.filePath, dirname);
  }

  delete config.extends;

  return config;
}

module.exports = {
  load
};
