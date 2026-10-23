# AR0307 - Plan

- Job: 2026-10-23-plan-ticket-spec-feature-64b81346
- Planned at: 507533d445e541e9a9aa22aad62c21447a7e820d

## Approach
Most of this ticket is a real run on the VPS, not a code change. A job cannot do that run: the guards stop a job from writing outside its worktree (`~/.config/systemd`, `arthur.config.ts`, `.env`), and the bot token and secrets need the human. So the coordinator drives it from its own session, as recommended under Not available directly. One job, run by Arthur itself, makes the commit at the end. The work goes in three phases, and the harness keeps working this repository until phase 2.

1. **Setup (coordinator and human, no job, no branch).** Follow `docs/setup.md` steps 1 to 15 on this VPS and record what each step's Check prints. I already ran these checks on this VPS: Node v24.21.0, git 2.43.0, tmux 3.4, omp/18.3.0, `Linger=yes`, `Restart=always`, controllers `cpu memory pids`, and `arthur version` prints `8fe8ca34218f`. So steps 2, 9 (drop-in) and 10 already hold.
   - Step 4 clones into `~/arthur`, which already exists as this repository's main checkout. Arthur runs from it, so the project's `path` is `"."`, as in the example config.
   - The real `arthur.config.ts` (Git ignores it) loads these plugins: orchestration, projects (only `arthur`), telegram, delivery, github, commit-rules, findings, session and schedule.
   - `manage` waits for phase 2, because its audits and retros start jobs.
   - Arthur gets a new Telegram bot. The harness polls its own bot and keeps doing so for the other projects; two pollers on one bot get `409`.
   - The human puts the `ARTHUR_*` values in `.env` himself, so no secret goes through a chat.
   - Until phase 2, Arthur's coordinator is told it starts no job on AR.
   - When a step fails because of the docs, the fix is noted for phase 3. When it fails because of code, a small bug ticket with its test goes through the harness as today and merges before phase 2, so the running service gets the fix.
2. **Handover (revertible).** It starts only once the high-severity fixes have merged (Decision 3) and AR0370 has too (see Risks).
   - Before: no harness job is running on AR, and `git -C ~/arthur status --short` is empty.
   - Then: this repository's line is removed from the harness's own list of repositories, and `manage` is turned on in Arthur's config.
3. **AR0307 through Arthur.** Arthur spawns the worker for AR0307. Its task gets the doc fixes from phase 1 plus the switch cleanup. Then the delivery plugin reviews it, CI goes green, `arthur merge AR0307` runs, and the after-merge procedure follows (`packages/delivery/roles/coordinator/after-merge.md`: outcome, findings, commit, push, prune). That run is the one real Arthur ticket the Done means asks for.

Left alone:
- the harness's code, and the other projects (Scope Out);
- `spec/roadmap.md:827`;
- the `.agents/harness/...` fixture strings in `packages/core/test/roles.test.ts` and `packages/projects/test/project-options.test.ts`;
- `README.md`'s status line (see Open questions).

The docs stay written for a fresh VPS: nothing in them names the harness or anything about this VPS.

## Not available directly
- A job cannot run the setup on the VPS. Its worktree guard (`docs/deploy.md`, Threat model, and the harness's own guard) refuses writes to `~/.config/systemd`, to the folder of `arthur.config.ts` and to `.env`. The bot comes from @BotFather on the owner's phone, and the secrets may not be pasted in a chat. I checked `docs/deploy.md` and `packages/telegram/docs/telegram.md`, "Setting it up".
  - Option 1: the coordinator runs the steps from its own session; the human makes the bot and fills `.env`; jobs only fix docs and code. Cost: about an hour of the coordinator and 10 minutes of the human. Risk: low, every step can be undone (`systemctl --user disable --now arthur`).
  - Option 2: the human runs every step by hand and reports each Check. Cost: about an hour of the human. Risk: low, but slower.
  - Option 3: a job with the guards loosened. Cost: a core change. Risk: high, it breaks the worktree-guard rule in the vision.
  - Recommendation: Option 1.

## Files
- `docs/setup.md`:
  - line 5: drop "in development … seven commands … `Not built yet`" and say every step's command exists;
  - step 4: clone only when `~/arthur/.git` is missing, written in the check-first style of step 2;
  - step 5: name the plugins that review and merge need (delivery, github, commit-rules, findings, session, schedule, manage), each with its docs page;
  - step 6: their variables, such as `ARTHUR_GITHUB_TOKEN`;
  - step 8: add `%h/arthur/node_modules/.bin` to the `PATH` if the coordinator under the service does not find `arthur` [INFERENCE: not checked; `packages/orchestration/src/coordinator.ts:118` starts `omp` with `arthur run`'s environment; AR0356 is about the same gap for jobs];
  - every other Check whose output differs from what the run printed.
- `docs/deploy.md`: line 5 ("Arthur is in development"), and whatever the run corrects.
- `.agents/harness/` (the five `criteria/*.md` and `project.json`): deleted.
- `test/arthur-criteria.test.ts`: the AR0297 test (lines 57 to 64) is removed, with its `HARNESS` constant and the `existsSync` import. The AR0272 and AR0273 tests stay (see Open questions).
- `arthur.config.example.ts:264`: the `prompts: { rolesDir: ".agents/harness/roles" }` line is removed. The defaults (`spec/vision.md`, `.agents/arthur/criteria`, `.agents/arthur/roles`) are what that line's comment already says; neither roles folder exists, so nothing changes at run time.
- `.agents/arthur/criteria/styleguide.md` and `review.md`, line 5: the "Until the switch … kept byte for byte in both" paragraph is removed. Scope In does not name these files, but the paragraph would point at a folder that no longer exists.
- Outside the repository, not committed: `~/arthur/arthur.config.ts`, the `ARTHUR_*` lines in `~/arthur/.env`, `~/.config/arthur.env`, `~/.config/systemd/user/arthur.service`, the `~/.bashrc` line, and the harness's list of repositories.

## Risks
- **Two coordinators on one board and one main during phase 1.** Arthur starts no job on AR, `manage` is off, and the handover needs a clean checkout and no harness job running on AR. `~/arthur` has an uncommitted `spec/build.json` today.
- **One Telegram bot polled twice.** It would answer `409` and both channels would go deaf. Arthur gets its own bot, and the chat is the owner's private chat with it: AR0364 says Telegram answers every member of a group.
- **The coordinator's first start runs `omp --continue` in `~/arthur`** (`coordinator.ts:114`) and may pick up an older conversation started in that folder [INFERENCE]. Check it at step 12 with `arthur attach`; if so, `/restart fresh`.
- **A test left a job scope in the real slice.** `arthur-job-2026-10-16-review-db348624.scope` runs in `arthur-jobs.slice` with a `/tmp/arthur-test-…` home. It counts against the real slice's limits. Stop it before step 9 and file a finding; it is not fixed here.
- **Both job slices on one VPS can promise more than the machine has.** The harness's slice and `arthur-jobs.slice` each get up to the cores minus one and 70% of memory. Keep `maxAgents` low until the other projects move.
- **Arthur's home created before AR0370 merges keeps the umask's modes** (AR0327: an existing home's mode is never changed). Run phase 1 after AR0370 merges, or `chmod 700 ~/arthur/.arthur`.
- **A failure after the merge.** `git revert` of the merge brings `.agents/harness/` back, the repository's line goes back into the harness's list, and the harness goes on. Before the merge, nothing on main changes.
- **The repository is public.** The plan, the docs and the commits name none of the harness's folders and no other project.

## How to test
- **Setup by `docs/setup.md`:** every step's Check, run on the VPS, prints what the merged doc says. The coordinator records the output in the job's task. Each code fix has its own ticket and test.
- **Service, Telegram, doctor:** `systemctl --user is-active arthur` prints `active`. `journalctl --user -u arthur -n 20` shows `arthur run: pid <pid> started …` (`packages/core/src/run.ts:70`). A message to the new bot gets the coordinator's answer within a minute. `arthur doctor` exits 0 with no `missing` line. `arthur setup` says `nothing` under Next.
- **One ticket end to end:** `arthur jobs` lists AR0307's worker and its review. The ticket folder has `review-1.md` with PASS and an `outcome.md`. `arthur merge` printed `AR0307 merged` and the github push line. The board shows `merged`, `CHANGELOG.md` was rebuilt, and `arthur prune` removed the jobs.
- **The cleanup:**
  - `test -e .agents/harness` fails;
  - `grep -n 'agents/harness' arthur.config.example.ts .agents/arthur/criteria/*.md test/*.ts` finds nothing;
  - `node --test test/arthur-criteria.test.ts` runs 2 tests, both passing (it ran 3 passing today).
- **A failure leaves the harness working:** through phases 1 and 2, `systemctl --user is-active h-coordinator` stays `active`, and the high-severity fixes merged by the harness in that time prove it still works this repository. Undoing phase 1 (disable `arthur`, put the line back in the list) is tried once before phase 3.
- **`npm test` and `npm run check`:** run in AR0307's worktree, then again on main by `arthur merge`. `npm run check` passes here today.

## Open questions
- The ticket says to delete `test/arthur-criteria.test.ts`, but the roadmap (line 827) and AR0297's decision delete only the test that compares the two copies. The file also holds the AR0272 and AR0273 tests, which still check real behaviour. The plan removes only the comparing test: is that right?
- Which tickets are "the high-severity fixes" that the switch waits for? The board has no severity field, and only some findings files record one. The coordinator should list them and add them to AR0307's `after`.
- `README.md:29` still says "in development, not usable yet (main on 2026-10-18)". It is outside Scope, so the plan leaves it: should it change at the switch?
