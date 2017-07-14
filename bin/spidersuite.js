#!/usr/bin/env node
'use strict';

const _ = require('lodash');
const path = require('path');
const commander = require('commander');
const cursor = require('ansi')(process.stdout);
const util = require('util');

const Crawler = require(path.resolve('lib/Crawler'));
const defaultConfig = require(path.resolve('lib/config/defaultConfig'));
const configFileReader = require(path.resolve('lib/config/configFileReader'));

const pjson = require('../package.json');

let config;
let crawler;

commander
  .version(pjson.version)
  .option('-c, --config [configPath]', 'Run with config', '')
  .option('-v, --verbose', 'Print extra output')
  .description('Node script that crawls a given URL with optional crawler config.')
  .usage('[--config=config] url');

commander.parse(process.argv);

if (commander.args.length !== 1) {
  commander.help();
} else {
  if (commander.config) {
    cursor.reset().write(util.format('Attempting to use config: %s\n', commander.config));
    config = configFileReader.load(commander.config);
  } else {
    cursor.reset().write('No config specified.  Using default.\n');
    config = _.clone(defaultConfig);
  }

  cursor.reset().write(`Parsed config: ${JSON.stringify(config, null, '  ')}\n`);

  // TODO add proper sequential crawling, as this won't work with more than one URL
  cursor.reset().write(`Crawling ${commander.args[0]}\n`);
  crawler = new Crawler(commander.args[0], config, commander.verbose);
  crawler.crawl();
}
