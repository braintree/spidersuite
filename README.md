# Spidersuite

This project uses Node to implement a spider, and outputs a list of warnings, errors, and 404s.

* [Install spidersuite](#install-spidersuite)
* [Usage](#usage)
* [Run spidersuite](#run-spidersuite)
* [Broken links](#broken-links)
* [Broken redirects](#broken-redirects)
* [Config](#config)

## Install spidersuite

```
npm install spidersuite --save-dev
```

## Usage

1. Start the app that you want to crawl/test.

1. Open another Terminal window in the same directory as your project.
    Run node for your localhost:
    ```
    ./node_modules/.bin/spidersuite [--config <path to config>] https://localhost:8443/
    ```

    The [results](#broken-links) of spidersuite appear in this Terminal window.

## Broken links

If spidersuite finds broken links, the response contains a `not found count` value greater than 0 followed by `not found` information:

```
timeout count: 0
error count: 0
not found count: 5
not found: [
  {
    "url": "https://localhost:8443/brokenurl/",
    "linkedFrom": [
      "https://localhost:8443/"
    ]
  },
  ...
]
```

The `linkedFrom` information shows how spidersuite found this file.

## Broken redirects

If spidersuite finds a link that redirects to a broken page, the report contains the `redirectFrom` property, which lists the URLs for a chain of redirects. Any URL in that chain might be present in the content and contribute to the overall error. For example:

```
not found count: 1
not found: [
  {
    "url": "https://localhost:8443/brokenurlredirect2",
    "redirectFrom": [
      "https://localhost:8443/brokenurlredirect1",
      "https://localhost:8443/brokenurlredirect0"
    ]
  }
]
```

In this example, the original URL in the content is `https://localhost:8443/brokenurlredirect0`, which redirected several times and finally ended on `https://localhost:8443/brokenurlredirect2`, which resulted in a `404`.

> **Important:** The `redirectFrom` property can have multiple heads to the redirect chain. For example, the list might show URLs A, B, C, and D, but A might redirect to B, C might redirect to D, and both B and D redirect to the offending URL. When spidersuite detects an error that results from a chain of redirects, more than one chain can redirect to the same faulty page so you must check the content for all parts of all chains specified by the `redirectFrom` list.

## Config

Spidersuite has many configurable options, which can be used to meet your crawling and reporting needs.

### Config file format

The config file is somewhat similar to eslint's json config format.  The `extends` property attempts to find the referenced file, or the default config if `spider:default` is specified.  The rest of the rules are specified in the config file in the most obvious way possible.

Only json files are allowed.

### Config file options

The section below outlines the full set of options available for use in the config.  See the `examples` directory for further details.

For any pattern, a substition is performed to replace the extracted root url (such as https://domain.example.com:5522) is inserted anywhere `#{ROOT_URL}` is found.  This allows one to treat urls that intentionally or unintentionally that link out to other hosts differently.

#### `additionalPaths`  

A list of paths that are to also be crawled, in addition to the initial url provided.  This option is useful for hidden pages, not navigable from the main url.

#### `excludePatterns`

A list of patterns specifying which URLs not to attempt.  By default, spidersuite includes all urls it finds.

#### `includePatterns`

A list of patterns specifying which URLs to attempt.  By default, spidersuite includes all urls it finds.  If specified, spidersuite will only fetch pages matching at least one of the patterns.

#### `titlePattern`

A single regex pattern, indicating what the html title of the crawled pages on the same domain should contain.

#### `*WarnOnlyPatterns`

These config options indicate that certain errors should be considered warnings, rather than failing errors.

* `hashNotFoundWarnOnlyPatterns`
* `httpXXXWarnOnlyPatterns`, where `XXX` is a number between 400 - 510

#### `reportSpoolInterval`

A number, if greater than zero, indicates an interval with which to print out the current spool (pages currently fetching).  Useful for debugging.

#### `strictCiphers`

If false, the cipher list is relaxed.  Otherwise, a more strict version of ciphers is used over TLS.

#### `simplecrawlerConfig`

[`simplecrawler`](https://www.npmjs.com/package/simplecrawler) is the module behind spidersuite, and has a lot of config options available for adjustment.  Spidersuite allows one to set those via the `simplecrawlerConfig`.

#### `MAX_*_FROM`
By default, spidersuite reports only the first five broken links and redirects for a page. To change that default to report all broken links or redirects for each page, set the `MAX_LINKS_FROM` and `MAX_REDIRECTS_FROM` environment variables to `-1`. 

> **Note:** If the failure is in the header or footer and `MAX_LINKS_FROM` is set to `-1`, hundreds or thousands of entries appear in the `linkedFrom`section of the report, which makes the report hard to read.
