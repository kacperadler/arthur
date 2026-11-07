# AR0563 - Outcome

- Merged: 2026-11-07, `4b1e1cbb`
- Branch: arthur/2026-11-07-worker-0af70689
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $8.51, reviews $1.62; review rounds 2

## What went in

- `.agents/arthur/criteria/pyramid.md`: Arthur's own copy of the pyramid criteria.
- `arthur.config.example.ts`: `pyramid: { budgetUsd: 10 }` in the manage options.
- `packages/manage/criteria/pyramid.md`: the four layers; a correction caught twice at a lower layer moves up; a prose line the code now enforces is dead. `arthur init` writes it.
- `packages/manage/docs/commands/pyramid.md`: the page `arthur pyramid --help` prints: usage, phone form, refusals and the line they print, exit codes.
- `packages/manage/docs/manage.md`: the intro, `pyramid.budgetUsd`, the load refusals, `spec/pyramid/` left out of audited commits, and the section "The pyramid audit".
- `packages/manage/roles/coordinator/pyramid-ended.md`: the procedure when a pyramid ends: file, one planning ticket, commit, check and send the page, prune.
- `packages/manage/roles/pyramid.md`: the pyramid job's role and the exact form of its final message.
- `packages/manage/src/audit.ts`: exports `findings`; a commit touching only `spec/pyramid/` is no commit to audit.
- `packages/manage/src/manage-options.ts`: the `pyramid.budgetUsd` option, its type, table entry and check; the summary names the commands.
- `packages/manage/src/manage.ts`: sets up the pyramid; header comment.
- `packages/manage/src/pyramid.ts`: the kind, the refusals, the commands, and the prompt section; FAIL reviews are `review-N.md` files only.
- `packages/manage/src/repeats-command.ts`: the `/repeats` page now comes from `reportPage`.
- `packages/manage/src/report-file.ts`: a report's page is a renderer function; the plain `page` and the report-style `reportPage` both live here.
- `packages/manage/src/retro-due.ts`: `RETROS` uses the plain `page` renderer.
- `packages/manage/src/retro.ts`: exports `shipped`, `repeatsOf` and `corrections`.
- `packages/manage/test/audit.test.ts`: the wake now has three answers.
- `packages/manage/test/manage-options.test.ts`: the options list includes `pyramid`; new `pyramid.budgetUsd` test.
- `packages/manage/test/pyramid.test.ts`: tests of the refusals, commands, the prompt with and without history, each history input alone, the blocked-question filters, plan reviews left out, filing, the page, and the audit range.
- `packages/manage/test/retro.test.ts`: the criteria list and the wake answers include the pyramid.
- `packages/orchestration/roles/coordinator.md`: one line: when you ask how agents could work better, or for a pyramid audit, run `arthur pyramid`.
- `spec/features/AR0563-arthur-pyramid-and-pyramid-a-pyramid-audit-of-any-project-one-planning-ticket/findings.md`: F1 and F2.
- `test/arthur-criteria.test.ts`: the criteria Arthur's roles read include `pyramid`.
- `test/outside-text.test.ts`: the role files include `pyramid.md`, eight job roles.
- `test/structure.test.ts`: manage line budget 1535.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1550/1621 passed.

## Left open

- Deferred (client summary): F1. A finished pyramid audit left unfiled raises no health line
- Deferred (client summary): F2. The vision's list of roles a model can be set for leaves out the newer roles
