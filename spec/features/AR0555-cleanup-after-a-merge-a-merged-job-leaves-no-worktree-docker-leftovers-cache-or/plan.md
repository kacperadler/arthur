# AR0555 - Plan

- Job: 2026-10-29-plan-ff10fd96
- Planned at: 308521ead20241c5a497e51c1f512ac1f7906cff

## Approach
The ticket assumes a core `host.jobs.cleanup` hook and a `docker` plugin. Neither exists. `packages/` has no docker plugin, roadmap entries 70–72 have no ticket on the board, and the core source never mentions `jobs.cleanup`. The one per-job hook the core prune has is `jobs.keep` (`packages/core/src/job-records.ts` `prune`). It is called once the worktree and the local branch are freed, before the record is deleted. Every option below follows the recommended options under Not available directly.

1. **Origin branch at prune (github).** github provides `jobs.keep`. It always answers "keep nothing", so it never holds back a worktree or a record. It then deletes the job's origin branch in the background, one deletion at a time. Conditions:
   - The branch is exactly `arthur/<job id>`, and it is not the branch the project's checkout has checked out.
   - origin still has the branch (`git ls-remote`). If not, nothing is done and nothing is said, which also makes a repeated prune safe.
   - origin's tip is the commit github pushed (a new record, `<github folder>/pushed/<job id>`, written after each successful `github.push` of an `arthur/<id>` branch) or a commit the checkout's main branch contains (`git merge-base --is-ancestor`).
   - The delete is `git push --force-with-lease=<ref>:<tip> origin :<ref>`, so a tip that moves between the check and the delete is refused.
   - It uses the same no-prompt env, no-hook flags and `configRefusal` as `push`.
   - A refusal or a failure is a `notice`. A deletion is one log line. The push record is removed with the branch.
2. **Sweep command (github).** New `arthur github sweep-branches [--dry-run] [--project <name>]`. It lists origin's `arthur/*` branches and deletes those whose job record is gone and whose tip main contains, all in one push with a lease per branch. It prints every branch it kept and why:
   - the name is not `arthur/<job id>`;
   - the job still exists (`arthur prune <id>` frees it);
   - the tip is not in main.

   `--dry-run` deletes nothing. It exists so the owner can see the list and give his word before the first run over today's 138 branches.
3. **Prune at merge (delivery).** `arthur merge` prunes after it pushed main. It prunes the merged job and every job naming its ticket; jobs still in a run are kept, as the prune itself decides. So main is on origin before github deletes the branch. I picked this over "the procedure ends with the prune" because `after-merge.md` step 4 already asks for that prune, and that is what gets forgotten. The prune step leaves `after-merge.md`.
4. **Dropped ticket (delivery).** A `ticket-moved` to `dropped` (it arrives in `arthur run`) prunes the ticket's jobs the same way. A branch Git keeps as unmerged is then deleted with `git branch -D` and pruned again, so github's hook also removes origin's copy when its tip is the one github pushed. A worktree with uncommitted changes still keeps its branch: Git refuses `-D` on a branch checked out in a worktree.
5. **Per-job folders outside the worktree.** There are three:
   - `<home>/jobs/<id>/cache/` (the package caches, `wrapper.ts:123,129`) goes with the record already.
   - `<home>/delivery/<id>/` (the files `checks`, `review-needed`, `ci-wait`, `ci-told`) is never removed today; there are 420 such folders (15 MB). Delivery's own `jobs.keep` will remove it. `<home>/delivery/reviews/<id>.json` stays, because FAIL counts and costs rely on it.
   - omp's session folder `~/.omp/agent/sessions/-.arthur-worktrees-<id>/` is never removed (422 folders, 308 MB). The core will pass `--session-dir <record>/session`, so the session goes with the record.
6. **Left alone.** The core's prune logic (`git branch -d`, worktree rules), the docker cleanup (nothing to clean until roadmap 70–72), pull requests and issues (AR0556), and today's 420 delivery folders and 422 omp sessions of jobs already gone (a one-time manual removal, not code).

## Not available directly
- **`host.jobs.cleanup` and the docker plugin do not exist.** I searched `packages/` for `jobs.cleanup` and `docker`; the hits are only test fixtures (`packages/core/test/setup.test.ts` `DOCKER`). In `spec/roadmap.md`, entry 71 is the hook, still unbuilt. `spec/build.json` has no ticket for entries 70–72. The core's only per-job prune hook is `jobs.keep`, collected synchronously in `job-records.ts` `prune`, and today no plugin provides it.
  - Option 1: github provides `jobs.keep`, answers no reason, and runs the delete in the background. Cost: ~10 lines, no core change. Risk: the hook's name says "keep"; the result appears as a log line or notice, not in the prune's own line; a CLI `arthur prune` exits only after the git call ends (at most 60 s).
  - Option 2: build entry 71's async `host.jobs.cleanup` in the core first. Cost: about a day, and the core is at its budget (6467/6467). Risk: a new core step, which the ticket rules out.
  - Option 3: no per-job hook, only the sweep, run by the procedure or a schedule. Cost: smallest. Risk: cleanup is left to memory again, and the Done means' per-job point is not met.
  - Recommendation: Option 1.
- **omp sessions live outside the job.** omp writes them to `~/.omp/agent/sessions/<cwd slug>/` (I checked the folders on this machine). The core's agent argv (`packages/core/src/wrapper.ts:77-82`) passes no `--session-dir`. `omp --help` has `--session-dir` ("storage and lookup").
  - Option 1: add `"--session-dir", join(folder, "session")` to the existing `--append-system-prompt` line in `wrapper.ts`. Cost: 0 source lines, args asserted in 3 core test files. Risk: a job started before the deploy, continued after it, finds no session in the new folder [INFERENCE: what omp's `--continue` does with an empty session dir is not verified]; and the core is outside Scope In.
  - Option 2: delivery's `jobs.keep` deletes the `~/.omp/agent/sessions/<slug>` folder. Cost: ~3 lines. Risk: it copies omp's naming rule, which breaks silently when omp changes, and a plugin writes outside its own folder.
  - Option 3: a follow-up core ticket. Cost: none now. Risk: 308 MB keeps growing, and that Done means point stays open.
  - Recommendation: Option 1.
- **The prune cannot delete an unmerged branch.** `job-records.ts` `prune` uses `git branch -d` only, so a dropped ticket's branch and record are kept and github's hook is never reached.
  - Option 1: on a drop, delivery runs `git branch -D` and prunes again. Cost: ~8 lines. Risk: a ticket dropped by mistake loses its commits here and, when github pushed them, on origin.
  - Option 2: keep unmerged branches; the worktree is freed, the sweep lists the branch as not in main. Cost: none. Risk: the Goal's "nothing stays" is not met for drops.
  - Recommendation: Option 1, as the Goal says; confirm under Open questions.

## Files
- `packages/github/src/github-git.ts`: export `gitAway`, and move `push`'s no-prompt env into an exported function shared with the deletes.
- `packages/github/src/github-branches.ts` (new): `recordPush` (writes `<folder>/pushed/<id>` through a temporary name and a rename), the origin delete used by the hook (checks and lease as in Approach 1, run one at a time), and `sweepCommand` (`arthur github sweep-branches`).
- `packages/github/src/github.ts`: the `github.push` provider takes the branch's tip before the push and records it on success; provide `jobs.keep`; register the sweep command. Stays under 200 lines.
- `packages/github/docs/github.md`: new section "Branches on origin" (the hook, its rules, the notices, the push record, the sweep); the "Across a restart" section names `pushed/`.
- `packages/github/docs/commands/github.md` (new): the command's doc, usage, output, refusals.
- `packages/github/test/github-branches.test.ts` (new): the hook and the sweep against a bare origin folder, with the `FOLDERS_ALLOWED` config the push tests use.
- `packages/delivery/src/ticket-prune.ts` (new): prunes a ticket's jobs plus the merged job; with the drop flag, runs `git branch -D` on branches Git kept and prunes again (unhooked git, `configRefusal` first). Returns the prune's lines.
- `packages/delivery/src/merge-command.ts`: `merge` also returns the job id and the ticket id. `run` passes only `{ project, branch }` to `github.push`, prints the prune's lines after the push, and the last line becomes `nothing committed but the merge[, nothing pushed]`. Stays at or under 200 lines.
- `packages/delivery/src/delivery.ts`: a `ticket-moved` handler for `to === "dropped"` that calls `ticket-prune.ts` and logs its lines; a `jobs.keep` provider that removes `<host.folder>/<id>/` and answers no reason.
- `packages/delivery/docs/commands/merge.md`: the merge prunes at its end; remove "prunes nothing".
- `packages/delivery/docs/delivery.md`: a dropped ticket's jobs are pruned, unmerged branches included; the per-job folder goes at prune.
- `packages/delivery/roles/coordinator/after-merge.md`: step 4 without `arthur prune`.
- `packages/delivery/evals/merge/scenario.json`, `packages/delivery/evals/review-pass/scenario.json`: the stubbed merge output with the prune lines, the new last line and the new procedure; drop the `^arthur prune .*<id>` calls.
- `packages/session/evals/after-restart-plan/scenario.json`, `packages/session/evals/unblocked-after-restart/scenario.json`: the same stub text. `packages/develop/test/scenarios.test.ts:338` requires every stub to end with `after-merge.md` as it is. These two are outside Scope In, but only as fixtures.
- `packages/delivery/test/merge.test.ts`: update `DONE` and the full-output assertions; new merge and drop cases.
- `packages/core/src/wrapper.ts`: `--session-dir <record>/session` on the existing argv line (omp Option 1).
- `packages/core/test/job-control.test.ts`, `limits.test.ts`, `wrapper.test.ts`: the asserted agent args.
- `test/structure.test.ts`: raise the github budget (659 now, about 780) and the delivery budget (1686 now, about 1720), the exact numbers set by the worker, only with the owner's budget decision.

## Risks
- **The hook deletes an unpushed-elsewhere unmerged branch.** It runs only after `git branch -d` succeeded (merged into HEAD), or when the local branch was already gone. In the second case, an origin tip equal to the pushed one is deleted even if unmerged, as the Done means' "or" allows. A branch someone deleted locally by hand, unmerged but pushed, loses its last copy. Kept narrow by the exact-name check, the push record and the lease.
- **Blocking `arthur run`.** Deletes run in the background through `gitAway` (its own session, killed after 60 s, no prompt), never with a synchronous network call. So the daily prune and the drop handler never stall the run's event loop.
- **Parallel pushes.** The hook runs one delete at a time, so pruning many jobs at once never opens many ssh connections.
- **Main's push failed.** The origin branch is still deleted, because the local main contains its commits; the next main push carries them. Nothing is lost.
- **The core prune rejects unknown ids.** The merge and drop prunes pass only ids from `host.jobs.list()`. Jobs in a run come back as `kept: it is working`, and the merge still exits 0.
- **Existing merge tests re-merge the same job** (`merge.test.ts:159`, "AC0001 is merged"). Once the job is pruned, that call answers `no job <id>`. Those tests need a second job of the ticket, or a check that the job is gone.
- **Two processes write push records.** A PASS pushes from `arthur run`, `no review` from the CLI. Each branch has its own file, written to a temporary name and renamed, so neither ever sees half a file.
- **`--force-with-lease` and the sweep.** A branch moved after `ls-remote` is refused per ref (porcelain `!`), listed as kept with git's reason, and the other branches are still deleted.
- **omp `--session-dir`.** An ended job from before the deploy, continued after it, may start a fresh session [INFERENCE]. Jobs started after the deploy are unaffected.

## How to test
- **Done means 1 (origin branch at prune), in `github-branches.test.ts`, with a fake host, real Git and a bare origin folder.** A worker branch pushed through `github.push` and merged into main, then `fake.host.jobs.prune([id])`: wait until `git ls-remote origin` no longer has `arthur/<id>`. Then the refusals:
  - tip moved: a commit pushed to origin's branch after Arthur's push, not in main;
  - not merged: a branch on origin with no push record and not in main;
  - main: a job whose branch is `main`, through `fake.collect("jobs.keep", …)`;
  - foreign name: `arthur/other` on a job with another id.

  Each one: wait for its `notice` in `fake.emitted`; origin's branch is still there.
- **Failed delete.** The bare origin's `pre-receive` hook exits 1. The prune line still reads `worktree … removed; branch … deleted; record deleted`, the worktree folder is gone, and the `notice` names `not deleted on origin`.
- **Repeated prune.** A test `jobs.keep` keeps the record and the job is pruned twice: exactly one delete, and no notice the second time.
- **Done means 2 (prune at merge), in `merge.test.ts`.** After `arthur merge` goes in, the worker's and its review's records, the worktree and `arthur/<id>` are gone. The output holds the prune lines after `github: pushed main …` and ends with the new last line and `after-merge.md`. A failed check prunes nothing.
- **Done means 3 (dropped ticket).** `fake.emit("ticket-moved", { …, to: "dropped" })` with an ended worker on an unmerged branch: wait until its record and branch are gone. A dirty worktree keeps its branch and record. A job in a run is kept.
- **Done means 4 (sweep), against a bare origin.**
  - Deleted: a merged branch whose job is gone.
  - Kept, each with its reason: one whose job exists, one not in main, one foreign name.
  - `--dry-run` deletes nothing and lists the same.
  - A refused origin (no remote, or a key `configRefusal` names) exits 1.
  - Wrong usage exits 2.

  The first real run over today's 138 branches comes after the merge: the coordinator runs `arthur github sweep-branches --dry-run`, gets the owner's word, then runs it without `--dry-run`. The worker's sandbox cannot reach origin: `~/.ssh` is hidden, and my own `git ls-remote` failed there.
- **Done means 5 (job folders).** A merge test asserts `<delivery folder>/<id>/` is gone and `reviews/<id>.json` stays. A core test asserts the agent args carry `--session-dir <record>/session`, and the existing prune test shows the record, and so the session, gone.
- **Done means 7.** `npm run check` and `npm test` pass, including `test/structure.test.ts` with the approved budgets and `packages/develop/test/scenarios.test.ts` with the updated stubs.

## Open questions
- Line budgets: github is at 659/659 and delivery at 1686/1686. The plan needs raises to about 780 and about 1720 (exact numbers from the worker). Do you approve the raise (`--kind budget`)?
- On a dropped ticket, delete its unmerged commits too: the local branch with `git branch -D`, and origin's copy when its tip is the one Arthur pushed? The plan does this because the Goal says "nothing stays". Answer no, and the drop frees only worktrees and merged branches.
- omp sessions: is the one-line core change (`--session-dir` inside the job record, `packages/core/src/wrapper.ts`) all right in this ticket, although Scope In names only github and delivery? Answer no, and it becomes a follow-up core ticket; that Done means point then stays open.