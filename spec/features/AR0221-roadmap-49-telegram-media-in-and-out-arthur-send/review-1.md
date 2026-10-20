# AR0221 - Review 1

- Job: 2026-10-20-review-ar0221-roadmap-49-9d0ddc08
- Branch: h/2026-10-20-ar0221-roadmap-49-telegr-5cf10e3c
- Commit reviewed: 34bac55cd55212f04152866e3761e3266e68bd48
- Verdict: PASS

## Final message

Signed-off commit, Conventional Commits with ticket scope AR0221. All requirements satisfied.

Findings: none that block merge.

Notes (non-blocking):
- `packages/orchestration/src/inbox.ts`: a claim's `coordinator-replied` is emitted inside `turnText` before the message is queued and removed from `inbox/received/`. A restart in that window re-resolves the message from scratch on the next start, re-asking claims and potentially sending the claim's `reply` (e.g. "heard: …") to the owner a second time. Worker disclosed this honestly as `[INFERENCE]`; it's not a named Done-means edge case in roadmap entry 49, so not a blocking gap, but worth a follow-up ticket.
- The worker's final message said it skipped checking "arthur send must not send before every channel is checked" due to no-new-scope budget constraints. I ran that exact mutation (moved each channel's `send()` call inline into the collection loop instead of after every answer is checked) against `packages/core/test/cli.test.ts`: the existing test "arthur send asks every channel and sends only once all took the message" fails immediately (`pager` is invoked and overwrites its state file before `phone`'s refusal is surfaced). So the behavior is already covered; the worker's named gap was not an actual gap.

Checks run (in this worktree, not the main checkout):
- `npm ci`: succeeds.
- `npm run check`: passes (tsc, no errors).
- `npm test`: 756/756 pass, 0 fail (247s run).
- `git grep -nE "[0-9]{6,12}:[A-Za-z0-9_-]{20,}"`: prints nothing, exit 1 — no token-shaped literal.
- Mutation test (send-before-check, described above): existing test catches it; reverted via `git checkout -- packages/core/src/send-command.ts` (worktree clean afterward, confirmed via `git status --short`).
- Smoke: ran the real CLI (`node cli.ts send --help`, `send` with no config, `send` with a fake `channel.send` plugin) in `/tmp/ar0221-smoke` (removed after): help text matches `docs/commands/send.md`; no-channel-enabled error matches; a fake channel's accept/refuse paths behave exactly as `send-command.ts` and the docs describe.
- Cross-checked every Done-means edge case of roadmap entry 49 (11-file refusal, size/side limits with slice hint, token never in an error, album of one, mixed album+caption in order, unclaimed voice note's dual line, throwing/rejecting claim naming plugin+error, slow-voice-note ordering, no-channel-enabled) against the diff's tests in `packages/core/test/parts.test.ts`, `packages/core/test/cli.test.ts`, `packages/telegram/test/media.test.ts`, `packages/orchestration/test/inbox.test.ts` — each has a passing test.
- Verified package-boundary rules (telegram/orchestration import only `@arthur/core`'s published `/parts`, `/plugin`, `/lock`, `/option-table` exports; core does not import a plugin), line budgets (every new/changed file ≤200 lines; package totals match `test/structure.test.ts`, which match the ticket's Decision numbers exactly), README/`arthur.mmd` show entry 49 built, docs (`send.md`, `telegram.md`, `coordinator.md`) updated to match new behavior.

PASS
