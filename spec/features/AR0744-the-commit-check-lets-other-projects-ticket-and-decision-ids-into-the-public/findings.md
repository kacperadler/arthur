# AR0744 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The test kit hides a job's ARTHUR_JOB, so the real-checkout check reads it from /proc

- Kind: test
- Found by: 2026-11-27-worker-e2c7cb0a (worker), 2026-11-27
- Where: `packages/core/src/test-env.ts:8`, `test/other-projects.test.ts:13-15`
- What: the kit deletes every `ARTHUR_` variable before a test runs, so in a job `npm test`'s real-checkout test of `test/other-projects.ts` cannot learn the other projects' prefixes from `<home>/projects/prefixes` (their configs give `EACCES` there) and fails with one `its prefix was not learned` line per project. The plan assumed the test keeps `process.env`. The branch reads the `ARTHUR_JOB` the test process started with from `/proc/self/environ`, which holds only on Linux; elsewhere a job's `npm test` would fail that test.
- Suggestion: the kit exports the job's record path it cleared (for example `startedJob` from `@arthur/core/testing`), and the test reads that instead of `/proc`; the kit still clears the variable itself.
- Status: deferred (client summary)

## F2. Three mutants of the id check change no behaviour

- Kind: test
- Found by: 2026-11-27-worker-e2c7cb0a (worker), 2026-11-27
- Where: `test/other-projects.ts:47`, `test/other-projects.ts:90`
- What: `npm run mutate` on 68422c5e reported three survivors no test can catch: `"prefix" in piece` removed (`.prefix` of an object without one is `undefined`; the `in` is there for TypeScript's narrowing); `-e` removed from the `git grep` (the pattern starts with a prefix of A-Z, never `-`); `-o` removed (each line still gives one `path:line` once duplicates are removed; `-o` keeps Git's output to the ids instead of whole lines of a binary file read with `-a`).
- Suggestion: none; a later mutate run that reports them again needs no test.
- Status: dropped (no behaviour change)

## F3. an underscore or a digit next to an id lets it through

- Kind: fix
- Found by: 2026-11-27-review-48aa41e4 (review), 2026-11-27
- Where: `test/other-projects.ts:86,88`
- What: Both `\b` and `git grep -w` count `_` and digits as word characters, so `deploy_WS0150`, `WS-D156_note` and `1WS0150` pass in files and in messages. I confirmed this in a scratch repository: the grep printed nothing and the RegExp gave `false`. The plan chose these boundaries to pass `XWS0150`; a boundary of "not a letter or digit" (`git grep -P`) would catch the underscore forms.
- Status: deferred (client summary)
