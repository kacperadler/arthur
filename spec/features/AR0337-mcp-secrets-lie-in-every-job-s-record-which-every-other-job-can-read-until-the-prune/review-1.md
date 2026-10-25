# AR0337 - Review 1

- Job: 2026-10-25-review-af07bbfb
- Branch: arthur/2026-10-25-worker-4bc2cf0a
- Commit reviewed: c1f645c9a5bc211b9eba3837167b15d3d0bdf07f
- Verdict: FAIL

## Final message

**Findings**

1. `packages/core/src/job-control.ts:103`: nothing tests that the continue writes `mcp/` only for a local job. `writeMcp(folder, passed.mcp)` sits inside `if (there === undefined)`. That condition is the only thing that keeps a job on another machine from getting the role's secrets written into the local record. The worker's message claims this ("a job on another machine still gets none"). **Mutation:** I moved `writeMcp(folder, passed.mcp)` out of the `if`, to just before `if (budgetUsd !== undefined) write(folder, "budget", …)`, so it also runs for a remote job. `machine.test.ts`, `wrapper.test.ts` and `spawn-rules.test.ts` then gave 63 pass, 0 fail. With that mutation, a continue of a remote job whose role has MCP servers writes `mcp/.mcp.json` into `<home>/jobs/<id>/`. No local wrapper runs for that job, so none of the three new removals ever runs for it, and the `.mcp.json` stays until `arthur prune`. That is the exact leak this ticket is about. The review criteria count an uncaught mutation of a key behavior as a FAIL. What's needed: in `machine.test.ts`, a continue of a job on another machine whose role answers `mcp`, asserting no `mcp/` here or there and no secret in the SSH calls.

**Notes (non-blocking)**
- `env-refusal.ts:79`: a glob that ends in a suffixed name gets through. `cat mcp/.mc?.json.bak` is allowed, while `cat mcp/.mcp.json.bak`, `.m*`, `.*` and `.mcp.\json` are refused. For `.env` the same case is covered by the `.env${tail}` candidate. Arthur never writes a suffixed `.mcp.json`, so this is minor. `grep -r TOKEN ~/.arthur/jobs` also gets through, but the docs already say the guard is not a sandbox, and AR0320 is out of scope.
- `wrapper.test.ts`: the mode-600 check only catches its mutation under a permissive umask. With this machine's umask `0077`, dropping `{ mode: 0o600 }` still passes. Under `umask 022` the test fails as it should.
- The core budget goes 6156 → 6167 under AR-D29's standing rule, and the reason is in `test/structure.test.ts`, as in earlier reviews. The two extra removals (`job-scope.ts` `end()` and the sweep in `job-records.ts`) go beyond the ticket's text, but the final message explains why, and both are tested.
- Outside the range: a job blocked in its run whose wrapper dies is never swept, because the sweep only ends `working` or `idle` jobs. Its `mcp/` would stay.

**Checks run**
- `npm ci`: 22 packages added.
- `npm run check`: `tsc`, no errors.
- `npm test`: 1127 tests, 1069 pass, 0 fail, 58 skipped.
- Mutations, each restored with `git checkout --` (the tree is clean):
  - Removing the wrapper's `rmSync(mcp)`: 2 `wrapper.test.ts` tests fail. Caught.
  - Removing the continue's `writeMcp`: the "only during a run" test fails. Caught.
  - Removing the `rmSync` in `job-scope.ts` `end()`: the "wrapper does not start" test fails. Caught.
  - Removing the sweep's `rmSync`: the sweep test in `job-records.test.ts` fails. Caught.
  - Dropping `.mcp.json` from `namedGlob`'s names: the `env-guard.test.ts` table fails. Caught.
  - Dropping `(?!\w)` after `mcp\.json` in `NAME`: the table fails. Caught.
  - Unknown-kind guard turned into a fallback to a role named like the kind: the unknown-kind test fails. Caught.
  - `mode: 0o600` dropped: not caught under umask 077, caught under umask 022.
  - `writeMcp` moved outside `there === undefined`: **not caught** (finding 1).

FAIL