# AR0220 - Review 1

- Job: 2026-10-20-review-ar0220-youtrack-g-8b4e72c1
- Branch: h/2026-10-20-ar0220-youtrack-grouped-51fb6847
- Commit reviewed: 1c077c5d3bbeafa58d953993ad7d07a8cb6f15fc
- Verdict: PASS

## Final message

Clean. All verification complete.

Findings: none that block merge.

Notes:
- `packages/youtrack/src/youtrack-attachments.ts` now does both attachment-save and attachment-add/delete; cohesive single-file-single-topic ("attachments"), not a Shape violation, just worth noting as a slightly broader file responsibility.
- README.md's one-line command summary was updated though not explicitly named in ticket Scope; it's a direct, minimal consequence of the new verbs and the final message explains it — not a boundary issue.

Checks run (in this worktree, against `334be8c7..1c077c5d`):
- `npm ci`: clean, 16 packages.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 741/741 pass, 0 fail — matches worker's claim exactly.
- Mutation testing on `packages/youtrack/src/youtrack-command.ts` / `youtrack-attachments.ts` / `youtrack-api.ts` (each reverted after, `git status --short` clean afterward):
  - Removed the empty-state-group filter in `byState` → 2 tests fail (grouped-list tests).
  - Dropped `"delete"` from the `ARTHUR_JOB` write-refusal list → job-refusal test fails.
  - Disabled the attachment-id regex check (`if (false)`) → attachment test fails.
  - Changed `remove()`'s HTTP method from `"DELETE"` to `"GET"` → delete and attachment-delete tests fail.
  - Disabled the outside-project prefix check (`if (false)`) → the single shared "outside project" test fails, covering delete and attachment verbs too.
  All five mutations were caught by the existing suite; no mutation of a key behavior went undetected.
- Verified against JetBrains' live YouTrack REST docs (`api-usecase-attach-files.html`, `operations-api-issues.html`, `resource-api-admin-projects-projectID-customFields.html`, `api-entity-StateBundleElement.html`, `api-entity-StateProjectCustomField.html`): the `upload` multipart field name, the DELETE method on `/api/issues/{id}` and `/api/articles/{id}`, and the `bundle(values(name,ordinal))` / `ordinal` shape used in `byState` all match the documented API — the two items the worker flagged `[INFERENCE]` hold up.
- Line budget: `wc -l packages/youtrack/src/*.ts` → 518, matches the raised budget and its comment in `test/structure.test.ts`.
- Diff reviewed end-to-end against every Done-means bullet in `spec/features/AR0220.../ticket.md`: grouped list (3-state and 8-state/ordinal-order cases), issue/article delete (404, 403, outside-project, job refusal), attachment add/delete (missing-file refusal, id-form refusal, token-never-leaks, job refusal), and the four doc/roadmap/usage-line/header-comment updates — all present and tested.

PASS
