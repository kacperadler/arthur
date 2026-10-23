# AR0324 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

Every entry comes from `check.md` beside this file, which holds the rows and how each was checked. Each is written as a missing check: the input the code does not cover and the check that would.

## F1. The review kind takes any task with the three head lines, so a PASS can rest on a task nobody built from the branch (AR0311 F6, confirmed)

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23
- Where: `packages/delivery/src/delivery.ts:109-125` (`refusal`: one ticket on the board in-progress/review/done, `Branch: arthur/\S+`, `Commit: [0-9a-f]{7,40}`, the round; nothing else), `:53-59` (`prepare` checks out whatever `Commit:` names), `packages/delivery/src/merge-command.ts:130-133` and `packages/delivery/src/auto-merge.ts:24-29` (the record's commit and the final line `PASS` are the PASS)
- Rule: a review's PASS rests on the task `arthur review` built: the ended worker's branch at its tip, the range and the worker's final message.
- What: `arthur spawn --kind review '<task>'` with hand-written `Ticket:`, `Branch:` and `Commit:` lines, from the coordinator or from any job (AR0323), starts a review of any commit the repository holds, while the worker still runs too, with any text under the head lines; a `Commit:` that is the branch's tip and a final line `PASS` is then the PASS `arthur merge` and `--auto` take. In the probe, a spawn naming main's HEAD as `Commit:` was accepted, and one naming the tip whose agent ended on `PASS` let `arthur merge <worker>` in without `--unreviewed`.
- Suggestion: in `refusal` (or `prepare`), take the task only when it is byte for byte what `reviewTask(host, worker, round)` builds for the worker `Branch:` names: that worker exists, is a worker, has ended, its branch's tip in the project's checkout is `Commit:` (the full sha), and its one ticket is the task's; refuse any other task with `a review's task is what arthur review writes; spawn it with arthur review <worker job>`. The hand-back builds its task with `reviewTask` already, so it passes. Tests in `review.test.ts`: a hand-written task with the real tip refused; one with another commit refused; one while the worker runs refused; `arthur review` and the hand-back's next review still start; an eval's review (`named`, no home) unchanged. Out: who may run `arthur spawn` at all (AR0323).
- Status: open

## F2. `review-needed` lets a small change to what the merge and each spawn run go in without a review (AR0311 F11, confirmed)

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23
- Where: `packages/delivery/src/delivery-options.ts:16` (the default always-review list: Arthur's own files and `.github/workflows/**`), `packages/delivery/src/review-needed.ts:53-83` (a branch of 30 lines or fewer with passing checks is `no review`), `packages/delivery/src/merge-checks.ts:46-63` and `packages/projects/src/install.ts` (the merge runs the tip's install, `check` and `test` scripts as `sh -c` in Arthur's process; each spawn runs the install)
- Rule: small changes to what runs on the VPS are still reviewed.
- What: a branch that changes at most 30 lines of a `package.json` script, a lockfile (`package-lock.json`, `bun.lock`, `yarn.lock`, `pnpm-lock.yaml`: a dependency's `resolved` URL), `.npmrc` (`ignore-scripts`, a registry), `.nvmrc`, or a hooks folder (`.githooks/`, `.husky/`), with the job's recorded checks passing, is `no review: <n> lines changed; the job's checks: …`, its ticket done, and the owner's plain `arthur merge` then runs that script, install or Node as Arthur on the VPS; in the probe each of the first four answered `no review`. `--auto` holds `**/package.json` (`auto-merge.ts:35`) but not the others either.
- Suggestion: add to `ALWAYS_REVIEW` what the merge and a spawn execute in every project: `**/package.json`, `**/package-lock.json`, `**/npm-shrinkwrap.json`, `**/bun.lock`, `**/bun.lockb`, `**/yarn.lock`, `**/pnpm-lock.yaml`, `**/.npmrc`, `**/.nvmrc`, `.githooks/**`, `.husky/**`; since `held` is also `--auto`'s and `delivery.alwaysReview`'s, `--auto` then refuses them and autopilot refuses a ticket whose Scope names one, which is the intent (a tradeoff to name in `docs/commands/review-needed.md`, "The always-review list"). Tests: rows in `review-needed.test.ts`'s table for a one-line change of each; `auto-merge.test.ts:146` a lockfile among the held paths; `:174`'s list check extended. Out: where the merge's steps run (AR0311 F14, AR0328).
- Status: open

## F3. `--auto` takes CI passed on an older commit of the branch (AR0311 F13, confirmed)

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23
- Where: `packages/delivery/src/auto-merge.ts:56-68` (a run counts when `below < own`), `packages/delivery/src/ci-wait.ts:75` (a wait wakes for the same), `packages/delivery/docs/commands/merge.md:34`, pinned by `packages/delivery/test/auto-merge.test.ts:203` rows 217-224
- Rule: only a branch whose CI passed on its exact tip reaches main on its own.
- What: a branch whose last commits no run built (pushed with `[skip ci]`, skipped by a workflow's `paths-ignore`, or pushed before the run of the tip was listed) merges with `--auto` on a run of an ancestor: the review is of the tip, CI of what came before it, and the commits between are checked by the merge's own `check` and `test` on the VPS only.
- Suggestion: take a run with `below === 0` only; for a tip with no run, wait as for none (`startWait`), and say `no run built the tip yet`; `ciEnded` wakes for `below === 0` only. The cost: a workflow with `paths-ignore` never passes the tip of a docs-only commit, so such a branch waits for the owner's `--no-ci`; name it in `docs/commands/merge.md`, "--auto". Tests: `auto-merge.test.ts:203` inverted (a run 1 below refused and waiting); `:226` an end 1 below the tip wakes nobody.
- Status: open

## F4. The job's record of its checks is its own word: written from inside the agent, not tied to the tip's tree, not stale after a change by bash

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23
- Where: `packages/delivery/src/checks-extension.ts:14-23` (appended inside the agent's process from the tool result's text), `:27-30` (`stale` from `edit`/`write` tool calls only; `docs/commands/review-needed.md:35` names the bash limit), `packages/delivery/src/review-needed.ts:37`, `:78-83` (the file believed as it is, its last fresh lines deciding `no review`)
- Rule: a `no review` rests on the project's checks having passed on the tip.
- What: three inputs the check does not cover. A line written by anything in the job but the extension: the branch's own `test` script runs under `npm test` with `ARTHUR_JOB` in its environment and the same user, and the worktree guard reads tool calls, not what a program does (AR0320, "Writes outside the guard's view"). A change after the run that no tool call made: `sed -i`, `git checkout`, `git apply`, `git commit --amend` keep the lines fresh. A run on a tree other than the tip's: the lines name no commit, so a run before the last commit, or with uncommitted changes, is as good as one on the tip.
- Suggestion: each line the extension writes ends with the worktree's `git rev-parse HEAD` and `clean` or `dirty` (`git status --porcelain --untracked-files=no` empty or not) at the run's end; `review-needed` takes a `check`/`test` line only when its commit is the tip and the tree was clean, else `review: … the job's checks ran on <commit>, not the tip` or `… on a dirty tree`; `stale` then goes. The writer (a program in the job writing the home folder) is AR0329's sandbox; until it lands, the lines are a hint the sandbox makes a record. Tests in `checks.test.ts`: the suffix of a clean and a dirty tree; `review-needed.test.ts`: a passing line on an older commit and one on a dirty tree answer `review`, one on the tip `no review`.
- Status: open

## F5. A merge takes main as it is: a commit that reached main by another route is merged on and pushed with the next merge

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23
- Where: `packages/delivery/src/merge-command.ts:78` (`before` is HEAD, whatever it is), `:41-44` and `packages/github/src/github-git.ts:31-36` (main pushed, fast-forward, after the merge)
- Rule: only a branch a review passed reaches main; nothing else is on main but merges and the coordinator's commits of the board, the tickets' folders and `CHANGELOG.md`.
- What: when a commit lands on main other than through `arthur merge` (AR0320 F3 / AR0331: a job's worktree pointed at main, then a plain `git commit` there; or a hand edit in the main checkout), nothing notices: the next merge builds on it, its checks run with it, and `github.push` sends it to origin as part of main. The guard fix is AR0331's; this is the second line AR0320 F3 named for this area.
- Suggestion: before the merge, list the non-merge first-parent commits of main since its last merge commit (`git rev-list -1 --merges --first-parent HEAD`) that change a file outside `spec/**`, `CHANGELOG.md` and `*.md`: `git log --first-parent --no-merges --format=%h <last merge>..HEAD -- . ':(exclude)spec' ':(exclude)CHANGELOG.md' ':(exclude)*.md'`; any such commit refuses: `main has <n> commits since its last merge that change code (<shas>); only a merge puts code on main; the owner decides: main is unchanged`. The owner's own hand commits of code on main are refused by this too, by design (code goes through a ticket); a repository with no merge yet lists from the root. Tests in `merge.test.ts`: a code commit on main between two merges refuses the second naming it; a commit of `spec/` and `CHANGELOG.md` does not; `--unreviewed` does not lift it.
- Status: open

## F6. A plain `arthur merge` asks no CI, so a tip whose run ended `failure` goes in on the checks on main alone, unsaid

- Kind: improvement
- Severity: low
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23
- Where: `packages/delivery/src/merge-command.ts:83` (`autoRefusal`, the only caller of `github.ci`, runs with `--auto` only), `packages/delivery/docs/commands/merge.md:7-9` (the PASS alone), `packages/orchestration/roles/coordinator.md:25`
- Rule: only a branch whose CI passed reaches main.
- What: after `[github] CI run … ended failure on arthur/<id>` the owner's `arthur merge <id>` merges and pushes without a word about that run; the merge's own `check` and `test` on main are what stands between, and they are the same scripts CI ran, on the VPS instead of a runner. `--no-ci` is refused without `--auto` (`merge-command.ts:36`), so there is no way to say the owner saw the failure.
- Suggestion: when a plugin provides `github.ci`, a plain merge asks it as `--auto` does; a run on the branch's own commits that ended other than `success` refuses with the same `--auto merges only with CI passed …` line reworded for the merge, lifted by `--no-ci`, which then goes with a plain merge too on the owner's word; no run, a pending one, or github not loaded merges as today (the owner's merge waits for nothing). Tests in `merge.test.ts`: a failed run on the tip refuses without `--no-ci` and merges with it; a pending run and none merge; `--no-ci` without `--auto` no longer wrong usage (`:312` updated); `docs/commands/merge.md` and `coordinator.md:25` say it.
- Status: open

## F7. A binary file counts no lines, so a branch of any binary content skips the review on its checks

- Kind: bug
- Severity: low
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23
- Where: `packages/delivery/src/review-needed.ts:66-67` (numstat's `-` counts 0), `packages/delivery/docs/commands/review-needed.md:19`
- Rule: a branch over 30 lines, or one whose content no check can read, is reviewed.
- What: a branch that adds or replaces a binary file of any size (a vendored `.wasm` or `.node` addon the tests load, an executable under `tools/`, an archive) is `no review: 0 lines changed; the job's checks: …` when the job's checks pass; in the probe a 64 KiB file answered so.
- Suggestion: a numstat line with `-` for its counts is its own rule before the size: `review: changes a binary file <path>`. Test: a row in `review-needed.test.ts`'s table; `docs/commands/review-needed.md`, "The rules".
- Status: open
