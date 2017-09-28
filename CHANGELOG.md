spidersuite release notes
=========================

v0.3.2
-----
* Fix bug where process.exit() was improperly used.
* Fix issue where urls were silently skipped by adding `disallowed` url reporting.

v0.3.1
-----
* Fix bug where output was not flushed before ending the process.

v0.3.0
-----
* Fix logging to only log an ignored url once.
* Fix hash checks to only produce warnings or errors for urls not ignored.
* Rename default config string to `spidersuite:default`.  `spider:default` may be removed at a future date.
* Remove the configurable `MAX_LINKS_FROM` and `MAX_REDIRECTS_FROM` reporting config.

v0.2.0
-----
* Add a custom user agent.
* Reorganize some file names.

v0.1.1
-----
* Fix npm problem.

v0.1.0
-----
* Initial release!
