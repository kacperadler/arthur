# AR0349 - Review 1

- Job: 2026-10-23-review-ar0349-forged-own-22ec74d1
- Branch: h/2026-10-23-ar0349-forged-owner-para-cf06f333
- Commit reviewed: e8ec19f4ce4d58e1c83132d7bb9588b546089b5e
- Verdict: PASS

## Final message

Worktree clean, matches commit `e8ec19f4` exactly.

---

**Findings:** none.

**Notes:**
- Quoting-split regex (`\r\n|[\n\r\v\f\u0085\u2028\u2029]`) is duplicated identically in `hand-over.ts` and `handoff-extension.ts` (different packages, no shared export point in `@arthur/core`). Acceptable under the styleguide's "duplicating a short function is cheaper than a helper bag," but worth a shared `@arthur/core` export if a third consumer appears.
- Three self-reported scope decisions (eval turn needing `plugin`, dropping `[delivery]` alongside `[github]`, line-budget raises) are all covered by the ticket's `Decisions` entry dated 2026-10-23, so none is an unapproved departure.

**Checks run:**
- `npm ci` — clean.
- `npm run check` — `tsc`, no errors.
- `npm test` — 1061/1061 passed (matches worker's claim exactly).
- Mutation: removed line-quoting in `hand-over.ts` (`quoted = [text]`) → 14 inbox tests fail, including the dedicated new test. Restored, diff clean.
- Mutation: removed the `coordinator.turn` plugin-missing refusal in `inbox.ts` → the "coordinator.turn answers…" test fails (`Missing expected rejection`). Restored, diff clean.
- Mutation: reinstated `[github]` prefix in `github.ts`'s review message → the pull-request-review test fails with a clear diff. Restored, diff clean.
- Verified `event.plugin` is wired from the real emitting plugin at the host/event-log level (`event-log.ts:9`, `core/src/events.ts:71`, pattern confirmed in `doctor.ts`/`env.ts`), not from event payload data — closes the forgery vector the ticket targets; a plugin can't claim to be another plugin by putting a field in its own `text`.
- Confirmed role file (`roles/coordinator.md`) diff is minimal: one new line plus two short in-line edits, as the task's Focus required.
- Confirmed structure-test line-budget numbers (2317/880/704) match real `git diff --numstat` deltas cited in the comment, and the enforcing test (`checkStructure`) passed in the full run.
- Spot-checked github/session/delivery/eval diffs for boundary violations (plugin importing another plugin, core importing a plugin) — none found; each package only touches its own files plus docs.

PASS
