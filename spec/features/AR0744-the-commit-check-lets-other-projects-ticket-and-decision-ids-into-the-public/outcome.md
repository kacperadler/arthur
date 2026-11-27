# AR0744 - Outcome

- Merged: 2026-11-27, `56bb690d`
- Branch: arthur/2026-11-27-worker-e2c7cb0a
- Reviews: review-1.md PASS
- Cost: worker $4.40, reviews $0.69; review rounds 1

## What went in

- test/other-projects.ts: learns each other project's prefix from its config, or in a job from `<home>/projects/prefixes`, and refuses its ticket and decision ids in tracked paths, file lines and commit messages; a prefix learned from neither refuses the commit.
- test/other-projects.test.ts: fixtures with real configs (a decoy, a null and a string piece); rows for ids in files, binary files and messages, ids that pass, each digit, a config's own prefix, the prefixes file in a job, and every way a prefix goes unlearned; the real-checkout test learns prefixes in a job through the `ARTHUR_JOB` the process started with, and fails with a count and 20 lines, not a full diff.
- .githooks/commit-msg: its comment also names ticket and decision ids.
- docs/setup.md: the public-repo check paragraph covers ids, where prefixes come from, and the refusal when none is learned.
- spec/features/AR0744-the-commit-check-lets-other-projects-ticket-and-decision-ids-into-the-public/findings.md: F1, the test kit hides a job's `ARTHUR_JOB`; F2, three mutants of the id check that change no behaviour.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1910/1982 passed.

## Left open

- Deferred (client summary): F1. The test kit hides a job's ARTHUR_JOB, so the real-checkout check reads it from /proc
- Deferred (client summary): F3. an underscore or a digit next to an id lets it through
