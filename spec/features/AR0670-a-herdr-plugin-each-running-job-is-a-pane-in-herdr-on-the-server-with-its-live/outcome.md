# AR0670 - Outcome

- Merged: 2026-11-10, `31286fa2`
- Branch: arthur/2026-11-09-worker-bafad861
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md FAIL, review-4.md PASS
- Cost: worker $21.48, reviews $4.99; review rounds 4

## What went in

- packages/core/src/job-follow.ts: new; `followJob` streams a job's log and state lines until its run ends, the final state always told.
- packages/core/src/job-commands.ts: `arthur jobs --follow <id>`, refused with `--state`; new usage line.
- packages/core/src/run-record.ts: each message's text goes into `log` as `> ` lines.
- packages/core/docs/commands/jobs.md: usage line, `## --follow <id>` section, short id list.
- packages/core/docs/commands/spawn.md: the `log` item names the `> ` text lines.
- packages/core/test/job-follow.test.ts: new; the follow view's tests, including a same-state rewrite and the end race; each follow ends with its test.
- packages/core/test/run-record.test.ts: new; the `> ` lines in `log`, their order, a message without text, secret values named.
- packages/core/test/wrapper.test.ts: the log regex expects the `> ` lines.
- packages/core/test/job-records.test.ts: new usage string, the `--follow` refusals, following an ended job through the CLI.
- packages/herdr/package.json: new `@arthur/herdr` 0.1.0.
- packages/herdr/src/herdr.ts: new; the plugin (summary, tools, options check, doctor, handlers, cleanup, start pass).
- packages/herdr/src/herdr-cli.ts: new; herdr calls with a 5 s timeout, the workspace and coordinator tab, the tab map, state reports.
- packages/herdr/docs/herdr.md: new; server setup, tabs, the four-row state table, herdr missing, other machines.
- packages/herdr/test/fake-herdr.ts: new; a fake `herdr` 0.9.3 on PATH with up, down, hang and error modes, its state written whole.
- packages/herdr/test/herdr-shapes.json: new; answer keys recorded from `herdr api schema --json` 0.9.3.
- packages/herdr/test/fake-shapes.test.ts: new; the fake's answers match the recorded shapes.
- packages/herdr/test/herdr.test.ts: new; the plugin against the fake host and the fake herdr (an idle job's tab at start included), and its options file.
- package-lock.json: adds the `@arthur/herdr` workspace.
- test/structure.test.ts: core budget 7528 (measured, after main's AR0665), herdr 250.
- test/option-tables.test.ts: herdr in PLUGINS, in the list of empty tables and in the tools list.
- arthur.config.example.ts: herdr listed as built, imported, and a `herdr()` entry with its comment.
- spec/roadmap.md: an order paragraph and the `## Herdr` section with entry 115 (Tickets: AR0670).
- spec/vision.md: a herdr row in the plugin table.
- README.md: a herdr feature line; the "In short" line dropped to stay within 120 lines.
- spec/features/AR0670-a-herdr-plugin-each-running-job-is-a-pane-in-herdr-on-the-server-with-its-live/findings.md: new; F1, F2, F3, each open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1644/1715 passed.

## Left open

- Deferred (client summary): F1. A hung herdr queues every event's calls behind 5 s each
- Deferred (client summary): F2. Each job-state makes three herdr calls before its report
- Deferred (client summary): F3. No test covers the herdr call's fallback message
