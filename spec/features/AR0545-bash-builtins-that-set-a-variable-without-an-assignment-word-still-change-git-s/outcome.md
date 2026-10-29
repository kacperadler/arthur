# AR0545 - Outcome

- Merged: 2026-10-29, `cbbd5833`
- Branch: arthur/2026-10-29-worker-062fd159
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $8.60, reviews $2.61; review rounds 3

## What went in

- `packages/core/src/worktree-guard.ts`: a git-config name (`GIT_CONFIG*`, `HOME`, `XDG_CONFIG_HOME`) set by a builtin without an assignment word counts as config set in the call: `for`, `select`, `read`, `printf -v`, `mapfile`/`readarray`, `getopts`, `let`, a nameref, `${name:=…}`/`${name=…}`, and `export $v=…` (refused where it stands, AR-D318). Every `((…))`, `$((…))` and `$[…]` is read from the raw text up to its closing bracket, its double quotes removed as bash does; it counts when it names such a variable or holds a `$` or a backtick. Kept on top of AR0546's second pass with the call's config.
- `packages/core/test/worktree-guard.test.ts`: a refused row and a passing row on an unrelated name for each form, the compound operators (`|=`, `&=`, `>>=`, `+=`, `==`) and the quoted names of reviews 1 and 2, strings only.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1221/1289 passed.

## Left open

- Deferred (client summary): F1. Arithmetic outside `let`, `((…))`, `$((…))` and `$[…]` still sets HOME or XDG_CONFIG_HOME unseen
- Deferred (client summary): F3. `read -p HOME x` is refused: the prompt operand is counted as a name
