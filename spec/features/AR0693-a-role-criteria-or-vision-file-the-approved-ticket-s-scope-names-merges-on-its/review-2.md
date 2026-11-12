# AR0693 - Review 2

- Job: 2026-11-12-review-64832607
- Branch: arthur/2026-11-11-worker-07795aec
- Commit reviewed: 91f537a8b59485ed9f6bfebc01cc3b00be71a228
- Verdict: FAIL

## Final message

## Findings

1. **`packages/delivery/src/auto-merge.ts:52-53`: an `--auto` merge can take in a role, criteria or vision file that nobody approved.**
   - **What's wrong:** `named` is built from the raw ticket.md text. Paths in backticks inside an HTML comment count as named, and so do paths under an indented `  Out:` line. That breaks the code's own reason for the exception: "a role, criteria or vision `*.md` main's ticket names in its Scope is the owner's word on it" (`auto-merge.ts:48`).
   - **Why the owner never sees it:** the repo's existing Scope reader, `packages/orchestration/src/autopilot.ts:59-63`, strips `<!-- … -->` first ("a guidance comment … names no file"). It also ends the In part at `line.trim() === "Out:"`.
   - **How it gets through:** the two readers disagree, so a held path can sit in a Scope that autopilot's always-review check (`autopilot.ts:70`) never sees. The coordinator can then pre-approve the ticket by policy (`ticket status --autopilot`), and `--auto` merges a role change the owner never decided. An HTML comment is also invisible in rendered Markdown, so an owner who approves a ticket from its rendered view misses it too.
   - **Bypass:** the base refused every role path. On the tip, a plain `arthur merge --auto` lets through:
     - `.agents/arthur/roles/worker.md` when the Scope holds `<!-- \`.agents/arthur/roles/worker.md\` -->`;
     - `spec/vision.md` when the Scope lists it under `  Out:` (indented).
   - **Reproduction:** both merged in a throwaway test appended to `auto-merge.test.ts`, run alone. Output: `AC0001 undefined ""`, `AC0002 undefined ""`, which means exit code unset and no refusal. The file was restored afterwards.
   - **Not covered by F2:** reading the Scope as it stood at approval would not close this.
   - **Fix:** drop HTML comments and end the In part at a trimmed `Out:` line, the way `autopilot.ts` does. Add a test with a commented role path and one with an indented `Out:`.

## Notes
- (minor) `packages/delivery/src/auto-merge.ts:43`: mutate's only survivor ("hunk reverted to the base") is an equivalent mutant. That hunk only moved the role globs and the vision path into the `roles` and `vision` constants.
- (minor) `packages/delivery/test/auto-merge.test.ts:218`: the hand mutations below each fail the new test, naming its own case. Removing `.md` fails on AC0006, removing the `Out:` split on AC0007, removing the next-heading split on AC0009, and reading the ticket at `${tip}` instead of `${before}` on AC0008. The test covers these paths.
- (minor) `packages/delivery/src/auto-merge.ts:52`: `Out: \`x\`` on the same line ends the In part here but not in autopilot. This direction only refuses more, so it is safe, but it is a third difference between the two readers.

## Checks (all on 91f537a8, in this checkout)
- **`npm run mutate`:** 25 mutants, 24 caught, 1 survived (`auto-merge.ts:43: hunk reverted to the base`), 21 not run (`--max 25`), none cut by time.
- **`npm run check`:** `tsc`, no errors.
- **`npm test`:** tests 1748, pass 1684, fail 0, cancelled 0, skipped 64. The structure test passes; `auto-merge.ts` is not in its yellow list.
- **Hand mutations, each run with `node --import @arthur/core/testing --test packages/delivery/test/auto-merge.test.ts`:** each gave 10 pass, 1 fail, as listed in the notes. Each was restored with `git checkout --`.
- **Throwaway bypass test:** the comment and indented `Out:` cases both merged (finding 1). Restored; `git status --short` is empty.
- **`matchesGlob` probe:** `**/roles/**` and `**/criteria/**` match no path under a dot folder (`.github/workflows/criteria/x.md`, `.agents/skills/roles/x.md`, `.husky/roles/x.md`). So the `.md` exception cannot reach CI or hook folders.

FAIL