# AR0738 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. arthur commit-board pushes nothing, and the sandboxed coordinator of AR0667 T5 cannot push

- Kind: feat
- Found by: 2026-11-24-worker-02ceda55 (worker), 2026-11-24
- Where: `packages/delivery/src/commit-board.ts:74`
- What: `arthur commit-board` commits and stops; the procedures still say `git push` after it (`packages/manage/roles/coordinator/audit-ended.md:9`, `retro-ended.md:8`, `pyramid-ended.md:7`). AR0667's plan hides `~/.ssh` and Git's credentials from the coordinator in T5, so that `git push` will fail there [INFERENCE: read from the plan's T5, not run], and a board commit then reaches origin only with the next `arthur merge`.
- Suggestion: after its commit, `arthur commit-board` asks `github.push` for the project's branch as `arthur merge` does (`packages/delivery/src/merge-command.ts:46`) and prints its line; the procedures drop their `git push`. Out: retries of a failed push.
- Status: open

## F2. Board files that are no .md under spec/features, and the owner's spec files, have no command that commits them

- Kind: feat
- Found by: 2026-11-24-worker-02ceda55 (worker), 2026-11-24
- Where: `packages/delivery/src/commit-board.ts:18`
- What: `arthur commit-board` commits only the `.md` files under `spec/features/`, as AR0667's plan says (a project's `spec/features/` may hold code, such as RSpec files). Arthur's own main tracks 5 ticket attachments that are no `.md` (`git ls-files spec/features | grep -v '\.md$' | wc -l` printed 5: a log, three images, a page), and the coordinator also commits `spec/roadmap.md` at times. Once the coordinator no longer runs `git commit` (AR0667 T5) it has no way to commit such a file. A merge whose `spec:` commit is refused stages its ticket's whole folder (`packages/delivery/src/merge-outcome.ts:83`), so an attachment there stays staged after `arthur commit-board 'spec: <id> merged'` [INFERENCE: from those lines, not run].
- Suggestion: the owner decides which of these the coordinator may commit: a list of extensions for a ticket's attachments (`.png`, `.jpg`, `.log`, `.html`), `spec/roadmap.md`, or none (they go in by a worker's branch). Out: any file outside `spec/`.
- Status: open

## F3. A failed check of arthur merge resets main under a commit made by plain git during its checks

- Kind: fix
- Found by: 2026-11-24-worker-02ceda55 (worker), 2026-11-24
- Where: `packages/delivery/src/merge-command.ts:159`
- What: After a failed check the merge runs `git reset --quiet --keep <before>` without looking whether HEAD is still its own merge commit. A commit made on main while the checks ran (the owner's own `git commit`, or any commit not made by `arthur commit-board`, which now holds the merge lock) is dropped with the merge commit, its files put back [INFERENCE: read from the lines, not run; `packages/delivery/src/merge-recovery.ts:34` guards the same move with a compare-and-swap].
- Suggestion: reset only when HEAD is the merge commit (`git update-ref HEAD <before> <merge commit>`, then `git read-tree -m -u`, as `merge-recovery.ts` does); else leave main and say which commit landed on top. `merge-command.ts` is at 220 counted lines, so this needs a split or a budget decision.
- Status: open

## F4. The eval baseline was recorded before the roles named arthur commit-board

- Kind: test
- Found by: 2026-11-24-worker-02ceda55 (worker), 2026-11-24
- Where: `evals/baseline.json`
- What: Three scenarios expected main to move after the coordinator's `git commit` (`packages/manage/evals/audit-autopilot`, `packages/manage/evals/retro`, `packages/delivery/evals/condition-before-review`). The stub `arthur` of a run commits nothing, so this branch changed them to expect a call `arthur commit-board`. Their rates in the baseline are those of the old roles and expectations; no live `arthur eval` ran on this branch.
- Suggestion: run `arthur eval` once after the merge and record the new baseline. Out: new scenarios.
- Status: open

## F5. vetted throws without naming package.json or the command when the check cannot be read or started

- Kind: fix
- Found by: 2026-11-24-worker-963de939 (worker), 2026-11-24
- Where: `packages/delivery/src/merge-outcome.ts:94`
- What: `vetted` parses the `package.json` HEAD holds with a bare `JSON.parse` (line 94) and reads `ran.stderr.trim()` (line 98) before `ran.error`. With a `package.json` of `{` at HEAD, `arthur commit-board` ends with `Expected property name or '}' in JSON at position 1 (line 1 column 2)`, which names no file (`packages/delivery/test/commit-board.test.ts`, "a check that throws"; this branch unstages the files, the words are unchanged). With the script's spawn failing (seen with `PATH` set to "" by hand in `commit-board.ts`), it ended with `Cannot read properties of undefined (reading 'trim')`: the `ran.error?.message` of line 98 is never reached. `arthur merge` calls the same function for its `spec:` commit, after its checks ran [INFERENCE: its path was not run with either input].
- Suggestion: `vetted` answers a refusal in both cases, `HEAD:package.json is no JSON: <the parser's words>` and `npm run commit-msg did not start: <error>`, with a test row each in `commit-board.test.ts`. Out: a change of what a missing `package.json` means.
- Status: open
