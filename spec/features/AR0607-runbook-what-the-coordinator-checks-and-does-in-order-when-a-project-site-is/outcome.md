# AR0607 - Outcome

- Merged: 2026-11-07, `37bc0bbc`
- Branch: arthur/2026-11-06-worker-6674e97b
- Reviews: review-1.md PASS
- Cost: worker $3.68, reviews $0.83; review rounds 1

## What went in

- packages/uptime/roles/coordinator/site-down.md: the boilerplate runbook, 7 ordered steps. Reads go first. A redeploy runs only on a class's policy answer or the owner's own recorded answer; any other output, a silent-mode grant among them, means ask him and wait. Then the report, and how it ended.
- packages/uptime/src/uptime.ts: each down and each up also sends one `coordinator-message` naming the runbook. That is the project's own while it is a regular file inside its folder with no symlink on the way, otherwise the boilerplate with a note. `uptime.project(sites, { runbook? })` builds `{ sites, runbook? }`.
- packages/uptime/src/uptime-options.ts: `Piece` and `checkPiece`, which refuse a runbook outside the project's folder, unknown keys and any other piece shape. The summary mentions the coordinator's runbook.
- packages/uptime/test/uptime.test.ts: projects get folders. Tests cover both messages; the own runbook against a missing file, a folder, a symlink and a symlinked folder; and no message while offline or after a restart.
- packages/uptime/test/uptime-options.test.ts: `checkPiece`'s passing shapes and each refusal.
- packages/uptime/docs/uptime.md: the `runbook` argument and its refusals, plus "The coordinator's runbook": both messages, the boilerplate, how to start a project's own, and that a redeploy goes ahead only on policy or the owner's own answer.
- test/structure.test.ts: uptime line budget raised from 344 to 383.
- spec/roadmap.md: entry 114 under Uptime (a redeploy never on a silent-mode grant), plus an order note.
- spec/vision.md: the uptime row mentions the coordinator's runbook.
- README.md: the uptime line mentions the coordinator's runbook.
- arthur.mmd: the uptime node and the status line (entries 98 and 114).
- arthur.config.example.ts: the uptime comment and the project-file example show `{ runbook }`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1528/1599 passed.

## Left open

- Deferred (client summary): F1. while a silent-mode grant holds, `--recommend 1` makes the log record `Redeploy now` as answered by recommendation, even though nothing is deployed
