# AR0581 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The YouTrack plugin asks for a user's `name`, which the OpenAPI User does not have

- Kind: fix
- Found by: 2026-10-30-worker-f5583304 (worker), 2026-10-30
- Where: `packages/youtrack/src/youtrack-command.ts:41`, `youtrack-comments.ts:12`, `youtrack-work.ts:10`, `youtrack-write.ts:66`
- What: the plugin asks `reporter(login,name)`, `author(login,name)`, `updater(login,name)`. The `User` schema of YouTrack 2026.4's OpenAPI (https://youtrack.jetbrains.com/api/openapi.json) and the devportal's `api-entity-User` table list `fullName`, not `name`; only the sample responses of `resource-api-issues-issueID-comments` show `name`. `youtrack-shapes.json` records `User.name` from those samples so the fake keeps it. [INFERENCE: a live instance may answer `name`, as the samples do; not checked against one.]
- Suggestion: ask one live instance for `author(login,name,fullName)`; if `name` is missing, ask `fullName` and drop `name` from `youtrack-shapes.json`.
- Status: deferred (client summary)

## F2. The fake YouTrack answers keys the request did not ask for

- Kind: test
- Found by: 2026-10-30-worker-f5583304 (worker), 2026-10-30
- Where: `packages/youtrack/test/fake-youtrack.ts:151`
- What: YouTrack answers only the attributes named in `fields` (plus `$type`); the fake ignores `fields` and answers whole entities (for example a comment's `textPreview`, `attachments`, `visibility`). The shape test accepts any documented key, so code that reads a key it never asked for passes against the fake and gets nothing from a real server.
- Suggestion: have the fake keep only the asked keys and `$type` of each answer (the test's `asked` parser fits), then make the shape test require exactly those. Out: any plugin change.
- Status: deferred (client summary)

## F3. Error answers of the fake GitHub are not shape-checked

- Kind: test
- Found by: 2026-10-30-worker-f5583304 (worker), 2026-10-30
- Where: `packages/github/test/fake-github.ts:136`, `:165`
- What: the 409 of a cancel and the 404 answer `basic-error`, which GitHub's description gives as a schema with no example, so `github-shapes.json` records no key list for it and `fake-shapes.test.ts` requests neither.
- Suggestion: record `basic-error`'s schema properties (`message`, `documentation_url`, `url`, `status`, none required) and check that an error answer holds only those.
- Status: deferred (client summary)

## F4. Two guards of the shape tests matter only when a fake is broken, and survive mutation

- Kind: test
- Found by: 2026-10-30-review-17c4c2c2 (review 1, not blocking)
- What: the Telegram `body.ok` check and the YouTrack refusal of an empty or non-200 answer in `fake-shapes.test.ts`; the worker tested them by breaking the fake.
- Status: deferred (client summary)

## F5. The label and team item keys of a GitHub pull request are recorded but never compared

- Kind: test
- Found by: 2026-10-30-review-c9bc45b2 (review 2, not blocking)
- What: the fake answers `labels` and `requested_teams` as empty lists.
- Status: deferred (client summary)
