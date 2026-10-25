# AR0337 - Review 3

- Job: 2026-10-25-review-da1b019e
- Branch: arthur/2026-10-25-worker-4bc2cf0a
- Commit reviewed: 84837cdfe0311b1e2ec31d896192e3b6539f7736
- Verdict: PASS

## Final message

## Findings

None. Round 3 fixes review 2's one finding, and the merge with main drops nothing.

- `packages/core/test/env-guard.test.ts:88` adds the allowed row `["bash", { command: "cat .mc?.yml" }, undefined]`. When I delete the `.filter(...)` at `packages/core/src/env-refusal.ts:79`, the table now fails: "refused: … the secrets file .mcp.yml (through the glob .mc?.yml)". That matches the worker's claim.
- The merge `84837cdf` keeps the branch's diff against `223068ad` at the same 16 files as before. Only the one row was added. In `test/structure.test.ts`, `BUDGETS` is `core: 6168` (6167 plus 1, each raise explained under AR-D29) and `delivery: 1327`, which is main's value. Every other budget is main's.
- The ticket's Done means all hold:
  - `wrapper.ts` removes `<record>/mcp/` before it writes `state`.
  - `arthur continue` writes it again through `writeMcp`, for a local job only.
  - `.mcp.json` is in `NAME`, with its rows in the `PROJECT` table.
  - `coordinator.md` "MCP servers" says every job of the user can read the file while it exists.
  - Both tests exist: the wrapper test checks the record has no `mcp/` once `state` is `ended` and that a continue writes it back, and the guard table covers the names.

## Notes
- `env-refusal.ts:79`: a glob placed inside the name, before a suffix, gets through: `cat .mcp.js?n.bak` is allowed. `.env` has the same gap (`cat .e?v.local` is allowed), so this follows the existing pattern. Arthur never writes a suffixed `.mcp.json`, and the guard says it is not a sandbox (AR0320 is out of scope).
- The refusal's advice (`sed -i 's/^KEY=…'`) does not fit a JSON file. That is wording only, already noted in review 2.

## Checks run
- `npm ci`: 22 packages added.
- `npm run check`: `tsc`, no errors.
- `npm test`: 1128 tests, 1070 pass, 0 fail, 58 skipped.
- Mutations, each restored with `git checkout --`. The tree is clean at `84837cdf`.
  - Removed the `.filter(...)` on the suffixed candidates (`env-refusal.ts:79`): `env-guard.test.ts` gives 2 pass, 1 fail, on the `cat .mc?.yml` row. Caught.
  - Removed the wrapper's `rmSync(join(folder, "mcp"), …)` (`wrapper.ts`): `wrapper.test.ts` gives 17 pass, 2 fail. Caught.
  - Moved `writeMcp(folder, passed.mcp)` out of `if (there === undefined)` (`job-control.ts`): `machine.test.ts` gives 34 pass, 1 fail, on "…nor its continue…". Caught.
- Guard probes with `envRefusal`:
  - Refused: `.mcp.json`, `.m*`, `.mc?.json~`, `.mcp*.bak`, `.m[c]p.json`.
  - Allowed: `.mc?.yml`, `.mcp.yml`, `.mcp.js?n.bak` (see notes).

PASS