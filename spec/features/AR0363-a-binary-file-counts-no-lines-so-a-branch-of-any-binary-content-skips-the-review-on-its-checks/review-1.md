# AR0363 - Review 1

- Job: 2026-10-25-review-64ad40cc
- Branch: arthur/2026-10-25-worker-3f46ff15
- Commit reviewed: b7fb6708351a6821c0806393835eb421f90eaf8a
- Verdict: PASS

## Final message

No findings. The branch does what AR0363 asks, from the code to the test to the docs.

- **The rule:** `packages/delivery/src/review-needed.ts:66` returns `review: changes a binary file <path>` for any numstat line whose added count is `-`. It runs before the size rule, so a binary change is reviewed whatever its size and whether or not its checks pass.
- **The size sum:** line 68 drops `|| 0`. That is safe because by then no `-` count can be left, so `Number()` always gets a number.
- **Rule order:** the worker put the binary rule before the docs-only rule, so a binary `*.md` is reviewed. That fits the ticket's "before the size", since docs-only also comes before size. The rule comes after the always-review list, deletion and `.env` rules, which all answer `review` anyway, so only the reason text differs there.
- **Test rows:** `src/shop.wasm` with passing checks gets reviewed; a binary `docs/logo.md` next to a docs change is reviewed instead of `no review: … all docs`.
- **Docs:** `docs/commands/review-needed.md`, "The rules", has the new rule 5, rules 6–8 renumbered, and the old "a binary file counting none" note removed. The `decide` comment is updated to match.
- **Styleguide:** one commit, `fix(AR0363): …`. The source file is 97 lines, adds no dependency and has no class.

Notes (not blocking):
- No row covers a binary file that replaces an existing one. It runs the same numstat line as an added file, so this is coverage only.
- Moving the rule earlier, before the deletion or `.env` rules, would go uncaught. It would only change which reason a `review` answer names, so it is not a key behavior.

Checks I ran in my checkout, each under `timeout 300`:
- `npm run check`: tsc, exit 0.
- `node --test test/structure.test.ts`: 15 pass, 0 fail.
- `node --import @arthur/core/testing --test packages/delivery/test/review-needed.test.ts`: 7 pass, 0 fail. This matches the worker's claim.
- I did not run `npm test`, as the task said; the merge runs the full suite on main.

Mutations, each restored with `git checkout -- packages/delivery/src/review-needed.ts` (the tree is clean afterwards):
- **Binary rule line deleted:** the `.wasm` row fails with `no review: NaN lines changed; …`. Caught.
- **`added === "-"` changed to `"x"`:** the `.wasm` row fails. Caught.
- **Binary rule moved after the docs-only rule:** the binary `*.md` row fails with `no review: 2 files, all docs (*.md)`. Caught.

PASS