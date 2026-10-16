# arthur version

Usage: `arthur version`

Prints the version of Arthur's core: the first 12 hex digits of a SHA-256 over the names and contents of the core's source files (`packages/core/src/`), so two checkouts of one commit print the same and any change to the core prints another. It needs no config.

A spawn on another machine runs `arthur version` there first and refuses, before any record exists, when the two differ: `machine <name> runs arthur <theirs>, this one is <ours>; both need the same version` (see `arthur spawn --help`).
