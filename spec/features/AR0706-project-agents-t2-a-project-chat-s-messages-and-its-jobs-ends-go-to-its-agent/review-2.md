# AR0706 - Review 2

- Job: 2026-11-15-review-531c510a
- Branch: arthur/2026-11-14-worker-8a88fde0
- Commit reviewed: eeb76152f2fbfaee8669cb94a56d509df8ec8d74
- Verdict: FAIL

## Final message

**Findings**

1. `packages/orchestration/src/inbox.ts:101`: no test catches it when the outbox filter `.filter((one) => from !== "outbox" || one.endsWith(".json"))` is removed. The filter belongs to the removed-agent outbox move added in `affd1d77`. It stops `inbox.start()` from renaming the removed agent's `outbox/sent/` and `outbox/held/` folders, and its unfinished `.`-prefixed draft files, into the coordinator's `outbox/`.
   - **Mutation:** I deleted the filter and ran `project-routing.test.ts`. Result: 10 pass, 0 fail.
   - **Cause:** the test at `project-routing.test.ts:172` writes only `.json` files into a fresh agent outbox. A real agent that has ever replied also has `outbox/sent/`.
   - **What it would break:** I ran a throwaway test with a removed agent holding `outbox/sent/1-000001.json` and a coordinator holding a non-empty `outbox/sent/`. It passes on the tip. With the filter removed it fails: `inbox.start()` throws `ENOTEMPTY: directory not empty, rename '.../agents/shop/outbox/sent' -> '.../orchestration/outbox/sent'`.
   - **Why it matters:** the start of `arthur run` would break after removing any agent that ever replied. The review criteria count a key behaviour whose condition can be removed without a test failing as a FAIL.
   - **Fix:** give the removed agent `outbox/sent/` (and a `.` draft file) in that test, and assert they stay where they are.

## Notes
- (risk) `packages/orchestration/src/inbox.ts:100`: a removed agent's turn may get answered twice. The start moves the agent's `inbox/turn/` files to the coordinator's `queued/`, and its unsent `outbox/*.json` to the coordinator's outbox. A reply in that outbox may already answer those turn files, because the agent wrote it before it could move them to `answered/`. That reply is sent, and the same messages also reach the coordinator as new, unmarked queued messages. The coordinator's own restart check (`inbox-extension.ts:161-165`) only looks at `turn/`, so it doesn't catch this, and the owner gets two answers.
- (minor) `packages/orchestration/src/inbox.ts:24`: mutate's only `survived:` mutant puts back `const RESULT_LINES = 15;`, which nothing reads since `wake()` moved to `wake.ts`. It changes no behaviour, so it is not a missing test.
- (minor) `packages/orchestration/test/project-routing.test.ts`: the plan's How to test puts the T2 cases in `inbox.test.ts`. They are in this new file instead, which `inbox.test.ts` points to because its tests need tmux. This is placement only, not a change of approach.

## Checks (all on `eeb76152`)
- `npm run check`: `tsc`, exit 0.
- `npm test`: 1865 tests, 1801 pass, 0 fail, 0 cancelled, 64 skipped. Matches the worker's claim.
- `npm run mutate`, three calls on the same commit:
  - 1st: 38 mutants, 37 caught, 1 survived, 62 not run (time).
  - 2nd: 78 mutants, 77 caught, 1 survived, 22 not run (time).
  - 3rd: 100 mutants, 99 caught, 1 survived, 351 not run (`--max 100`).
  - The survivor is `packages/orchestration/src/inbox.ts:24: hunk reverted to the base`. Matches the worker's claim.
- Hand mutations. Each was restored with `git checkout -- <file>`, and `git status` is clean.
  - `inbox.ts` `seen` checking only the coordinator's folder: 2 tests fail (`project-routing`, `inbox`), caught.
  - `inbox.ts` start-time move without the filter for sessions still in the config: 3 fail, caught.
  - `inbox.ts` move without the outbox `.json` filter: 0 fail, **not caught** (finding 1).
  - `voice-reply.ts` failure line without the reply's place (`...at`): 1 fail, caught.
  - `delivery/src/hand-back.ts` without `project` on the stopped hand-back message: 1 fail, caught.
- Throwaway test (removed agent with `outbox/sent/`, then deleted): passes on the tip; fails with `ENOTEMPTY` with the filter removed.

FAIL