# arthur review-needed

Usage: `arthur review-needed <worker job>`. Comes with the `delivery` plugin, `delivery()` in `arthur.config.ts`; its option is `review.alwaysReview` (below).

Decides whether an ended worker's branch needs a review and prints one line, `review: <why>` or `no review: <why>`, naming the rule that decided. The worker job is its full id or the 8 hex digits that end it. The branch is judged at its tip in the main checkout, from where it leaves HEAD (`git merge-base`), as `arthur review` judges it.

- `no review` moves the job's ticket to `done` (`ticket-moved`, named by delivery) and prints `<id> moves to done.` as a second line. It then asks the plugin that provides `github.push` (the github plugin, `packages/github/docs/github.md`, "Pushes") to push the branch to origin, as after a review's `PASS`, so its CI runs; that plugin's one line, pushed or why not, is printed next. Without it, nothing is pushed. `review` moves and pushes nothing: the review's start moves the ticket to `review`, and its `PASS` pushes (`arthur review --help`).
- Either answer is kept in `<home>/delivery/<job>/review-needed`, a JSON object `{ answer, ticket, branch, commit, at }`, `commit` the tip it judged; asked again, the newest answer replaces it.

## The rules

In this order; the first that holds decides:

1. `review: <path> is on the always-review list`: a changed file matches the list, a renamed file by its old name or its new one.
2. `review: deletes <path>`: the branch deletes a file, a rename's old name included; a branch of docs that also deletes one is reviewed.
3. `review: changes <path>`: a file whose name starts with `.env` (`.env.example` too).
4. `review: the diff mentions .env in <path>`: `.env` in a changed line of a file outside docs (`*.md`) and tests (a `test/` folder at any depth), where it is only text; `process.env`, `.envrc` and `.environment` are not `.env`.
5. `review: changes a binary file <path>`: a file Git counts no lines of (`-` in `git diff --numstat`), whatever its size: a `.wasm` or `.node` addon, an executable, an archive, an image, a binary `*.md` too.
6. `no review: <n> files, all docs (*.md)`: every changed file is Markdown.
7. `review: <n> lines changed, over 30`: lines added and removed.
8. With 30 lines or fewer, the job's checks (below) decide, for each script, `check` and `test`, that the tip's `package.json` declares: `no review: <n> lines changed; the job's checks: check pass, test pass 12/12` when the latest line of each on the tip's clean tree passes, else `review: ...` with the same list (`no test` for a script with no line). Without them it is `review`: `the project's package.json declares no check or test script` (none at the tip, or a broken one), `the job recorded no checks`, or, for a script whose lines all ran elsewhere, as its latest line says, `the job's checks ran on <commit>, not the tip` or `the job's checks ran on a dirty tree`. With neither a check nor a reviewer nothing would have verified the code.

## The always-review list

`review.alwaysReview` in delivery's options: glob patterns (`path.matchesGlob`) from a project's root, the same list for every project; a list given replaces the default. `**` does not enter a folder whose name starts with a dot unless the pattern names it: `**/roles/**` misses `.agents/arthur/roles/worker.md`, which `.agents/**` holds. The default holds what reads secrets, the core's `.env` loading (roadmap entry 3) and the env guard (`**/env.ts`, `**/env-*.ts`), the CI-failure handling of roadmap entries 57 to 59 and the CI's workflows (`**/ci.ts`, `**/ci-*.ts`, `**/github-ci.ts`, `**/auto-merge.ts`, `**/merge-command.ts`, `.github/workflows/**`), the review rules themselves (`**/review-needed.ts`, `**/checks-extension.ts`), the prompt files every job and the coordinator read, so a docs-only branch that rewrites them is still reviewed: every role and its procedures and every criteria file, Arthur's own and a project's `prompts` folders (`**/roles/**`, `**/criteria/**`), a project's overrides and criteria under `.agents/` (`.agents/**`) and the vision (`spec/vision.md`), the board (`spec/build.json`), whose ticket paths say where `arthur ticket file` writes and what `arthur task` prints, and what `arthur merge` and each spawn run as Arthur, in every project: the scripts, the install (npm's, bun's, yarn's, pnpm's, composer's, uv's), its manifest, its lockfile, its registry and the settings that change what it runs (`yarnPath`, the pnpmfile, `bunfig.toml`), the Node and the Git hooks (`**/package.json`, `**/package-lock.json`, `**/npm-shrinkwrap.json`, `**/bun.lock`, `**/bun.lockb`, `**/yarn.lock`, `**/pnpm-lock.yaml`, `**/.npmrc`, `**/.nvmrc`, `**/composer.json`, `**/composer.lock`, `**/uv.lock`, `**/pyproject.toml`, `**/.yarnrc.yml`, `**/.pnpmfile.cjs`, `**/bunfig.toml`, `.githooks/**`, `.husky/**`), however small the change. Other Markdown, a README or a guide, stays docs (rule 6).

The tradeoff: the same list holds `arthur merge --auto` (`arthur merge --help`) and autopilot, so a dependency bump or a one-line script change is never merged on its own nor pre-approved by policy; it waits for a review and the owner's `arthur merge`. That is the intent: such a change runs code on the VPS at the next merge or spawn, which a passing check of the branch does not vouch for.

Other plugins ask it through `call("delivery.alwaysReview", { project, paths })`, which answers the paths on the list; orchestration's autopilot refuses a ticket whose Scope names one (`arthur ticket --help`).

## The job's checks

Delivery registers an OMP extension (`host.jobs.registerExtension`, `packages/delivery/src/checks-extension.ts`), which every job's agent loads with `-e` after the core's own. After each bash call it appends to `<home>/delivery/<job>/checks` one line per run of the project's own checks in the command, in its order, for the `check` and `test` scripts the worktree's `package.json` declares at that moment: `check pass` or `check fail` for `npm run check`, failed by its exit status or a TypeScript error in its output (`error TS<n>`); `test pass <passed>/<total>` or `test fail <passed>/<total>` for `npm test`, `npm t` or `npm run test`, from node --test's last summary in the output (`fail 0` passes), and `test pass` or `test fail` from the exit status when there is none. Commands joined by `;`, `&&` or `|` count each (`npm test | tail` is read from its output, as its exit status is the pipe's). A script the `package.json` does not declare, a missing or broken `package.json`, any other command, one that only mentions `npm test` (`echo npm test`, `git commit -m 'npm test'`), and a call the bash tool moved to the background give no line.

Each line ends with the commit the call began on (`git rev-parse HEAD`) and `clean` or `dirty`: `test pass 12/12 <commit> clean`. The extension reads the worktree as the bash call begins (OMP's `tool_call`) and as it ends: `clean` only when both readings name the same commit and every tracked file (`git ls-files`) with the same inode, size and times, a write changing its ctime, and the second lists no file in `git status --porcelain --untracked-files=no` and none Git is told not to look at (`git update-index --assume-unchanged` or `--skip-worktree`, a tag other than `H` in `git ls-files -v`); else `dirty`. So `npm test; git stash`, `npm test && git commit -am ...`, and an older tree or file put in, tested and put back (`git checkout <old> -- . && npm test && git checkout HEAD -- .`, or the same with `cp`) are `dirty`, as is a call whose tool call the extension did not see. Outside Git as the call ends there is no line. An untracked file is on no branch and leaves the tree `clean`. These reads run no hook and no fsmonitor the worktree's config names, nor read a replacement (refs/replace) (`-c core.hooksPath=/dev/null -c core.fsmonitor=false --no-replace-objects`). A line counts only on the tip's clean tree, so a change after the run, through the edit tool or bash (`sed -i`, `git checkout`, `git commit --amend`), and a run on an earlier commit or beside uncommitted changes leave the tip without checks, and `arthur review-needed` answers `review`. A run again on the tip counts again.

The lines are the job's own word: the job's sandbox keeps `<home>/delivery/<job>/` writable for the extension, which runs in the agent's process, so any program the job runs (`npm test` included) can write them too. They keep a careless branch from `no review`; they are no proof against a job that writes false ones.

A job on another machine writes its checks there, not here, so `arthur review-needed` reads none for it and answers `review`.

## Refused

Exit 1, nothing kept and nothing moved:

- No such job: `arthur review-needed: no job <name>; arthur jobs lists them`; not a worker, `<id> is a <kind> job; a review is of a worker's branch`; still in a run, `<id> is in a run (<state>); review its branch once the run has ended`.
- A worker whose task names no ticket, or several: `<id>'s task names no ticket; a review is of one ticket's branch`.
- A branch gone from the main checkout: `arthur/<id> is not in <folder>: pruned, or not brought back from its machine`; a branch with no commits beyond HEAD: `arthur/<id> at <commit> adds nothing to HEAD (<commit>): nothing to review`.
- On `no review`, a ticket the board cannot move to `done` (merged, dropped, planned): the board's refusal, such as `AC0001: merged cannot move to done; from merged: none, it is final`.

Wrong usage (no job, two, a flag) prints the usage line and exits 2.
