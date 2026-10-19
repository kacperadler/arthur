# AR0197 - Review 1

- Job: 2026-10-19-review-ar0197-youtrack-bdd87484
- Branch: h/2026-10-19-ar0197-youtrack-e4f38f0b
- Commit reviewed: 562931f836b76d0d4571ec640b513bcf2b15ff44
- Verdict: PASS

## Final message

Findings (none blocking):

- `packages/youtrack/docs/commands/youtrack.md:36` — the `tokenEnv` option row still reads "Arthur reads as", even though `youtrack-options.ts`'s `about` text for the same option was updated to "reads and writes as" in this diff. Cosmetic inconsistency, not a functional gap (doc page already documents every write verb and refusal elsewhere); not blocking.

Notes:

- F1/F2 findings correctly scoped as `open`, not silently fixed; F1 matches roadmap 45's literal text ("updating an **article** that changed meanwhile" only), so leaving issue-update without a version check is spec-compliant, not a bug.
- Article-version-as-plain-argument and the 361-line budget are both pre-approved per the task's Focus line; correctly justified in the final message and the `structure.test.ts` comment, and `wc -l` confirms 361 exactly.

Mutation checks I ran myself (not just trusted the worker's claim), each restored after:
- Disabled the article version-mismatch check (`youtrack-write.ts` `update`) → "an article changed since the version read..." test failed as expected.
- Disabled the empty/blank-heading-file check (`fromFile`) → the empty-file test failed as expected.
- Disabled the unknown-custom-field check (`setField`) → the field-refusal test failed as expected.
- Disabled the cross-project id-prefix guard (`youtrack-command.ts`) → the "id outside the project...refused before any call" test failed as expected.
- Disabled the 0-minutes/non-integer work-item guard (`addWork`) → the work-item test failed as expected.

All five mutations were caught by the existing suite; tree restored to clean (`git diff --stat` empty) after each.

Other checks run directly in this worktree:
- `npm ci`: clean, 13 packages.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 638 passed, 0 failed — matches the worker's claimed count exactly.
- Manually inspected `youtrack-api.ts`'s `fail()`: both `token` and `url.host` are redacted (`replaceAll`) in every error path, for GET and POST alike; confirmed by the test asserting "Bearer [token]" and "[url]" appear in 401/500 messages, and by `refusal()`'s helper asserting neither real token ever appears.
- Confirmed OS-chosen loopback port (`fake.listen(0, "127.0.0.1")`) and event-based waits (`await once(fake, "listening")`, `await once(closed, "close")`) rather than fixed timers — safe for 2-core CI.
- Verified package boundaries: `youtrack-write.ts`/`youtrack-command.ts` import only sibling files and `@arthur/core/*` exports; no cross-plugin or core-internal imports. `packages/youtrack/package.json` has no `dependencies` key (unchanged, still empty).
- Verified README/`arthur.mmd` both say "2 of 3 entries; 44, 45 built; 46" and match each other (confirmed by the passing `readme.test.ts` mermaid-sync check in the full suite).
- Verified AR0194's coordinator.md line and its `context.test.ts` assertion match the ticket's Done means text (reading-only, "Nothing more" honored — no extra lines added).
- Verified no delete verb exists (`VERBS` table has no `delete`; `issue delete`/`article delete` tests assert exit 2, no server calls).

PASS
