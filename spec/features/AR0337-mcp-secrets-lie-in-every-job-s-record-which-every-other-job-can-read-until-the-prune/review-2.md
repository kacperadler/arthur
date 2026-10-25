# AR0337 - Review 2

- Job: 2026-10-25-review-9dfd0856
- Branch: arthur/2026-10-25-worker-4bc2cf0a
- Commit reviewed: 00bde8f4bdfcbd21c3b2511a8e6fc9752bc9e396
- Verdict: FAIL

## Final message

## Findings

1. **`packages/core/src/env-refusal.ts:79`: no test covers the `.filter((name) => /^\.mcp\.json(?!\w)/i.test(name))` on the new suffixed candidates.** This filter is the only thing that keeps `.mcp${tail}` from becoming a candidate that is not an MCP config name.
   - **Mutation:** I deleted the `.filter(...)` call. `env-guard.test.ts` still passed (3 pass, 0 fail).
   - **What the mutation changes:** with the filter gone, `cat .mc?.yml` is refused as "the secrets file `.mcp.yml` (through the glob `.mc?.yml`)". With the filter in place, it is allowed. So a harmless file gets refused, and the test that says "every other call passes" does not notice.
   - **The final message's example does not show this:** it says the filter means "`.m*.bak` is never reported as `.mcp.bak`". That is true even without the filter, because `.mcp.json${tail}` comes first in the list and `find` returns `.mcp.json.bak`.
   - **Why it fails:** the styleguide's rule is "Each behavior has a test that fails when the behavior is removed", and the review criteria count an uncaught mutation as a FAIL.
   - **Likely fix:** one allowed row in the `PROJECT` table of `env-guard.test.ts`, such as `["bash", { command: "cat .mc?.yml" }, undefined]`.

## Notes
- Review 1's finding is fixed. I moved `writeMcp(folder, passed.mcp)` out of `if (there === undefined)` in `job-control.ts`, and `machine.test.ts` "…nor its continue…" fails.
- Review 1's notes are fixed too. The `.mc?.json.bak` row exists, and its `.mcp${tail}` candidate is caught when removed. Dropping the mode-600 check now fails even under this machine's umask `0077`, because the test sets `process.umask(0o022)` itself.
- The refusal text says "set one key with sed -i 's/^KEY=.*/KEY=value/' <file>". That advice does not fit a JSON `.mcp.json`. It only affects wording.
- The core budget goes 6167 → 6168 under AR-D29's standing rule. The reason is written in `test/structure.test.ts`, and the structure test passes.
- Guard probes I ran that are refused: `.mcp.json`, `.MCP.json`, `.mcp.js*`, `.[m]cp.json`, `.mcp?json`, `.mcp*`, `.mcp''.json`, `.mcp.\json`, `\.mcp.json`, `$D.mcp.json`, `-f.mcp.json`, `.mcp.json~`, `.mcp.json.bak`, `.m*.bak`.
- Probes that are allowed:
  - by design: `mcp.json`, `x.mcp.json`, `.mcp.jsonc`;
  - a name the code builds at runtime, `open(chr(46)+'mcp.json')`. The docs already say the guard is "not a sandbox", and AR0320 is out of scope.

## Checks run
- `npm ci`: 22 packages added.
- `npm run check`: `tsc` printed no errors.
- `npm test`: 1127 tests, 1069 pass, 0 fail, 58 skipped.
- Mutations, each restored with `git checkout --`. The tree is clean at the end.
  - `writeMcp` moved outside `there === undefined` (`job-control.ts`): `machine.test.ts` MCP test fails. Caught.
  - The continue's `writeMcp` removed: `wrapper.test.ts` "only during a run" fails. Caught.
  - `jobs.ts` continue check gives `mcp: undefined`: "only during a run" fails. Caught.
  - The wrapper's `rmSync(mcp)` removed: 2 `wrapper.test.ts` tests fail. Caught.
  - The `rmSync(mcp)` in `job-scope.ts` `end()` removed: "wrapper does not start" fails. Caught.
  - The sweep's `rmSync(mcp)` in `job-records.ts` removed: the sweep test fails. Caught.
  - `|mcp\.json(?!\w)` removed from `NAME`: the `env-guard` table fails. Caught.
  - `...suffixed` dropped from `names`: the `env-guard` table fails. Caught.
  - The `.mcp${tail}` candidate removed: the `env-guard` table fails. Caught.
  - The suffixed candidates' `.filter(...)` removed: **not caught** (finding 1).
  - `{ mode: 0o600 }` dropped, run under umask 077: "only during a run" fails. Caught.

FAIL