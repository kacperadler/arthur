# AR0460 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. test/readme.test.ts reads the real env file, and fails inside a job

- Kind: test
- Found by: 2026-10-26-worker-b6154019 (worker), 2026-10-26
- Where: `test/readme.test.ts:24-28`
- What: the status-line test runs `arthur config check` with `XDG_CONFIG_HOME` passed through from the caller, so without it set the CLI reads the production env file, `~/.config/arthur/.env`. Inside a job the sandbox denies that file, and the test fails with exit 1 and `/home/kacper/.config/arthur/.env: cannot be read (EACCES)` on stdout, whatever the branch changed. Reproduced: `node --test test/readme.test.ts` in this job fails; `XDG_CONFIG_HOME=<a temporary folder> node --test test/readme.test.ts` passes.
- Suggestion: give the spawned CLI its own `XDG_CONFIG_HOME` under the test's temporary folder in place of the caller's, so the test never touches the owner's env file. Nothing else in the test changes.
- Status: ticket AR0461

## F2. The duplicate command-file test cannot tell a case-sensitive lookup apart

- Kind: test
- Found by: 2026-10-26-review-ab955ef7 (reviewer), 2026-10-26
- Where: `site/scripts/plugins.ts:83`
- What: `seen.get(file)` instead of `seen.get(file.toLowerCase())` still passes: the only test pair is `Run.md`/`run.md`.
- Suggestion: none.
- Status: dropped (AR-D53: a site build check; no risk)

## F3. A findings commit uses the docs prefix

- Kind: process
- Found by: 2026-10-26-review-ab955ef7 (reviewer), 2026-10-26
- Where: commit ddffdb0f
- What: the commit hook refuses `spec(...)`, so the worker used `docs(...)`.
- Suggestion: none.
- Status: dropped (AR-D53: the hook's rule; no risk)

## F4. The site build warns that the i18n collection does not exist

- Kind: build
- Found by: 2026-10-26-review-ab955ef7 (reviewer), 2026-10-26
- Where: `npm run build` inside `site/`
- What: seen by the worker; not known whether it predates this branch.
- Suggestion: none.
- Status: dropped (AR-D53: a warning, the build passes)
