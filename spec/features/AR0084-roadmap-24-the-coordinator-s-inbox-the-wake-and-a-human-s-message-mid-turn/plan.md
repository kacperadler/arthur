# AR0084 - Plan

- Job: 2026-10-17-plan-ticket-spec-feature-878a224b
- Planned at: 96e8006d0e625344d237251a21bdce8cad4193c3

## Approach

Messages for the coordinator get a file inbox under `<home>/orchestration/`. The `orchestration` plugin fills it. A new OMP extension inside the coordinator's own `omp` decides when each message goes into the conversation. The plan follows the recommended options under Not available directly. The answers the ticket asks for come first, each with the choice and the reason.

1. **Where a mid-turn message enters: both ways, in layers.**
   - If another tool call comes, the message joins after it. The extension hands it to omp on `tool_result` with `deliverAs: "aside"`. omp's docs say an aside is "injected at the next agent step boundary without interrupting the current tool batch".
   - I chose aside over `steer` because of omp 18.3.0's bundle. In its default interrupt mode, a queued user steer skips the rest of a tool batch ("Skipped due to queued user message…"). That could cut off a coordinator command halfway.
   - If no tool call comes, the message is held to the turn's end and the turn is resumed. The extension's `session_stop` handler returns `{ continue: true, additionalContext }` with the waiting messages. omp documents this, with a cap of 8 continuations per turn.
   - Why not only one of the two: joining only at the end lets a long turn act for minutes on a plan the human already changed. Joining only after a tool call misses the turn that has none left.
2. **How a turn knows what it answered.** Each message is one file named by its event's sequence number. It moves through `inbox/queued/`, then `inbox/turn/` once it has been handed to the agent, then `inbox/answered/` once the turn's reply is written.
   - The reply goes to `outbox/` as `{ text, answers: [numbers], channels }` before the files move.
   - The plugin emits each reply as `coordinator-replied` with the same fields, then moves it to `outbox/sent/`.
   - The model knows from marks: `[via telegram]`, `[via telegram, sent during this turn]`, `[via telegram, sent during this turn, after your last tool call]`. The role rule tells it what to do with them.
3. **A turn that already wrote its reply.**
   - If the turn has not ended yet, `session_stop` resumes it. Its continuation text says: "Your reply above has not been sent; write one reply that answers this together with everything your reply above answered." Only the last reply is emitted.
   - If the reply already went out, the message becomes the next turn, delivered as soon as the session is idle. It is never lost, because it stays in `queued/` until it is handed over.
4. **A turn with no tool call left.** Same path: `session_stop` resumes it with the waiting messages.
5. **A message that changes or cancels what the turn is doing.** It joins after the running tool call and never kills it. The role says such a message comes first: the coordinator stops that work and says in the reply what was already done and what it stopped. Stopping jobs at once stays `/stopall`, which answers without the model (entry 15, already merged).
6. **Several messages in a row.**
   - While idle, a turn starts only once the queue has not grown for 1 s, so a burst becomes one turn.
   - During a turn, all messages waiting at one tool call join as one aside, in order. All messages waiting at the end resume the turn as one continuation.
   - Each message keeps its own marked line.
7. **A wake or a schedule message.** It never joins a turn. It waits in `queued/` until the session is idle. At idle, everything queued goes as one turn in order, so two jobs ending together make one message, followed by one instruction line saying the message is from Arthur, not the owner. If the turn holds a human's message, it is user-attributed; otherwise agent-attributed.
   - The wake gives the job's state and reason, the first 15 lines of its result (from the new `host.jobs.result(id)`), the project when it is not the main one (`host.board.projects()[0]`), and the lines plugins add through `collect("coordinator.wake", job)` (a kind's procedure).
   - Schedule and other plugins send through a new event, `coordinator-message` `{ text }`. Channels send `message-received` `{ channel, text }`.
8. **A coordinator restart mid-turn.**
   - At `session_start`, a file left in `turn/` that a reply in `outbox/` or `outbox/sent/` lists is moved to `answered/`.
   - Every other file left in `turn/` is delivered once more as the first turn, marked `sent before a restart; no reply to it was sent`. The role tells the coordinator to check the conversation (it runs with `--continue`) before redoing anything.
   - Nothing is lost, and nothing is answered twice, because only a written reply moves a file to `answered/`.
   - A failed hand-over (`sendUserMessage` throws) leaves the files in `turn/` and is retried on every tick (500 ms). The third failure in a row emits one `notice`.
   - A turn that ends in an error or is aborted answers nothing; its files are delivered again, marked.

How the queue stays safe:
- A queued file is written whole and linked in. It is skipped when its number is already in `queued/`, `turn/` or `answered/`, checked in that order. So one event delivered twice queues once: once by a command's process (`arthur spawn` can emit `job-ended`) and once by `arthur run`, or again after `arthur run` restarts.
- Only the extension moves files forward, never back.
- The extension acts only in a session with a UI (`ctx.hasUI`), so a `task` subagent never takes the inbox.
- The footer: the plugin writes `footer` (`arthur · N running: <short ids>`) on `job-started`, `job-state` and `job-ended`. The extension shows it with `ctx.ui.setStatus`.

Core changes:
- `host.jobs.result(id)`.
- The fake agent learns an interactive session:
  - `session_start` with a ctx: `isIdle`, `hasUI`, timers, `ui.setStatus`/`notify` noted in `ui.jsonl`.
  - A `{ prompt: true }` step that waits idle for the next message an extension sends, then emits `agent_start`.
  - An `{ end: true }` step that asks the `session_stop` handlers. A continuation is noted and play goes on with `agent_end` `willContinue: true`; otherwise it emits `agent_end` with the turn's messages.
  - Each sent message noted with the step it came in.
  - `failSends: n`.

Line budgets, decided by this plan's approval, numbers in `test/structure.test.ts`:
- orchestration: 300 → 560.
- core/testing: 276 → 340, moved from core: 4804 → 4740.

Left alone:
- Workers' steer (entry 14).
- Telegram and schedule (not built; this defines the events they use).
- The coordinator's context (25).
- Job states in the wake and footer (27).
- Compaction and handoff (35, 36).
- `/stopall`.

## Not available directly

- **A job's final message for the wake.** No published host API gives a plugin a job's `result`. I checked `Jobs` in `packages/core/src/jobs.ts` and `Host` in `plugin.ts`. The record reader `field` in `job-state.ts` is internal.
  - Option 1: `host.jobs.result(id)` in the core, which checks the id and reads the record's `result` - cost ~8 core lines, risk low (host API is not frozen until entry 51).
  - Option 2: put the first 15 lines into the `job-ended` data at its 4 emitters (`wrapper.ts`, `job-scope.ts`, `job-records.ts`, `machine-sync.ts`) - cost ~8 lines spread over 4 files, risk: every subscriber and the event log carry result text, and process-gone ends have none.
  - Option 3: the plugin reads `<home>/jobs/<id>/result` by path - cost 1 line, risk: ties a plugin to the core's record layout, against the vision's boundary.
  - Recommendation: Option 1.
- **"The procedure the kind's plugin names".** `Kind` has no procedure, and `job-ended` comes from the wrapper's process, which has no kind registry. I checked `jobs.ts`, `wrapper.ts:174`. No kind besides `worker` exists yet.
  - Option 1: `collect("coordinator.wake", job)`: a kind's plugin answers with its procedure - cost ~4 lines, no core change, risk low.
  - Option 2: `Kind.procedure?: URL` plus a new `host.jobs.kind(name)` reader - cost ~10 core lines, risk: core API for something with no user yet.
  - Recommendation: Option 1.
- **`agent_end.willContinue`** (needed to tell a resumed turn from a finished one) is not in `omp://extensions.md`. It is in omp 18.3.0's bundle (`#Un(…, { willContinue })` after `#zn`, the `session_stop` call).
  - Option 1: read it; if it is missing, treat `agent_end` as the turn's end - cost 0, risk: a future omp without it sends a superseded reply too.
  - Option 2: count our own `session_stop` continuations instead - cost ~5 lines, risk: misses omp's own continuations (retries).
  - Recommendation: Option 1.

## Files

- `packages/orchestration/src/inbox.ts` (new): the plugin side.
  - Handlers for `message-received` (checks `{ channel, text }` and logs a line for anything else), `coordinator-message`, and `job-ended` (builds the wake text).
  - The idempotent write into `inbox/queued/<seq>`.
  - The footer file.
  - The `outbox/` sweep, every 500 ms in `start()`: emits `coordinator-replied` and `notice`, then moves the file to `outbox/sent/`.
- `packages/orchestration/src/inbox-extension.ts` (new): the OMP extension.
  - `session_start`: reconciles `turn/`, prunes `answered/` and `outbox/sent/` older than 7 days, starts the tick (idle delivery with the 1 s settle, retries, the footer).
  - `agent_start` and `agent_end` (writes the reply, moves files to `answered/`).
  - `tool_result` (the aside) and `session_stop` (the continuation).
- `packages/orchestration/src/coordinator.ts`: the start command gains `-e <inbox-extension.ts>`, and tmux gets `-e ARTHUR_ORCHESTRATION_FOLDER=<folder>`.
- `packages/orchestration/src/orchestration.ts`: subscribes the inbox in `setup`, starts and stops the sweep.
- `packages/orchestration/roles/coordinator.md`: the reply rule:
  - A reply answers every owner message since the last reply, including those marked sent during the turn, and names any question it leaves open.
  - A changing or cancelling message comes first, and the reply says what was done and what was stopped.
  - `before a restart` means check the conversation before redoing.
  - `[Arthur]` messages are not from the owner.
- `packages/orchestration/docs/commands/coordinator.md`: a new section, "The coordinator's inbox": what reaches the coordinator and when, the marks, the folders, the events consumed and emitted, restart behavior; step 4 shows the new `-e`.
- `packages/orchestration/test/inbox.test.ts` (new): the cases under How to test.
- `packages/orchestration/test/coordinator.test.ts`: the start-arguments assertion gains the inbox `-e`.
- `packages/core/src/jobs.ts`, `packages/core/src/plugin.ts`: `result(id)` on `Jobs`, refused for an id that is not a job id.
- `packages/core/src/fake-agent.ts`: the interactive session described in Approach.
- `packages/core/src/testing.ts`: the `{ prompt }` and `{ end }` steps, `failSends`, and the doc comment. The file is at the 200-line cap, so its comments are tightened to make room.
- `packages/core/test/job-control.test.ts`, `packages/core/test/machine.test.ts`: their `messages.jsonl` assertions follow the added `step` field.
- `test/structure.test.ts`: the budgets above, with one comment line naming AR0084.
- `spec/roadmap.md`:
  - Entry 24's Delivers and Done means rewritten to the answers above.
  - `result` added to the host API paragraph.
  - Entry 39 names `coordinator-message`; entry 47 names `message-received` `{ channel, text }`.
- `README.md`: one clause in the status line on the inbox, the wake and the reply.

## Risks

- **omp behavior a fake cannot prove:** the aside joining at the next step boundary, the `session_stop` continuation, and a message sent while a turn settles becoming the next turn. That last one is omp's queued-message drain in the bundle. The worker runs one live smoke (How to test) and reports it in the outcome.
- **The same event delivered twice** (a command's process and `arthur run`, or after a restart of `arthur run`). The write is named by sequence number, linked in exclusively, and checked against all three folders in order. Files only move forward.
- **A redelivered message after a restart can make the coordinator repeat an action** it took before dying (a spawn, say). The mark, `--continue`, and the role rule cover it. `maxAgents` and board refusals catch some repeats.
- **`arthur run` crashing between emitting a reply and moving it** sends that reply twice on the channels. This is accepted, because a lost reply is worse. This is `arthur run`'s crash, not the coordinator restart the ticket names.
- **A message delivered through `session_stop` is hidden context** (omp records it `display: false`). The human watching through `arthur attach` does not see it in the transcript, but the model does.
- **Subagents:** parent-loaded extensions may run in omp's `task` subagents [INFERENCE from `omp://extensions.md`, "Restricted children retain parent-loaded hooks"]. The extension acts only when `ctx.hasUI`, and omp's headless sessions have no UI.
- **Line limits:** `testing.ts` is at exactly 200 lines and core/testing at exactly its budget. Orchestration is at 276 of 300. The budget raises above are part of this plan, and per-file limits hold by keeping the extension and `inbox.ts` separate.
- **Existing contract tests change:** the coordinator's start arguments and `messages.jsonl` entries. They are updated, not re-pinned to anything incidental.

## How to test

`packages/orchestration/test/inbox.test.ts`, using the fake host and the fake agent as `omp` in a tmux socket inside the test's folder, as `coordinator.test.ts` does:
- **Idle delivery:** one human message while idle starts one turn with `[via telegram] …`. Its reply is emitted as `coordinator-replied` with its number and channel.
- **Mid-turn, after the next tool call:** a message emitted while the fake waits before tool 1 arrives as an aside noted at tool 1's step, before tool 2. It carries the mark. The reply's `answers` lists both numbers.
- **Two in one tool call:** both arrive as one aside, in order.
- **No tool call left / reply already written:** a message arriving after the reply step is handed back through `session_stop`, and `agent_end` comes with `willContinue: true`. Only the second reply is emitted, answering both. The first is never emitted.
- **Turn already ended:** a message emitted after `agent_end` becomes the next turn, unmarked.
- **Changes or cancels:** the joined message is sent with `deliverAs: "aside"`, not `steer`, so omp does not cut off the running tool batch.
- **Several in a row while idle:** three messages 100 ms apart make one turn, in order.
- **Wake and schedule wait:**
  - A `job-ended` (a real job run with a fake agent, then `fake.emit`) and a `coordinator-message` emitted mid-turn are not in any aside or continuation. They are the next turn.
  - Two job ends queued together make one message, with one instruction line, the result's first 15 lines, the project line for a non-main project, and a test provider's `coordinator.wake` line.
- **Failed delivery:** with `failSends: 3`, the third failure emits exactly one `notice`, and the next try delivers once.
- **Restart mid-turn:**
  - The test kills the session at a `waitFor` inside a turn. After the restart, the message is delivered once, marked, then answered. No third delivery.
  - A prepared folder where a reply in `outbox/sent/` lists a file left in `turn/`: after the start, that file is in `answered/` and is not delivered.
- **Repeated event:** queueing the same event twice, then once more after its file moved to `turn/` and to `answered/`, leaves one file.
- **Footer:** set while a job runs, cleared when none runs.
- **Edge:** a malformed `message-received` (no text, a non-string channel) queues nothing and logs one line.

Elsewhere:
- **Role rule:** read in review against `roles/coordinator.md` (entry 24's Done means). There is no text test.
- **Live smoke** (reported in the outcome):
  - Real `omp` with a cheap model in a scratch tmux socket, `ARTHUR_ORCHESTRATION_FOLDER=<temporary folder>`, `-e packages/orchestration/src/inbox-extension.ts`.
  - Ask it to run `sleep 10` and drop a queued file during the sleep: the message joins after that tool call.
  - Drop one while it writes a reply with no tools: the turn resumes, and `outbox/` holds one reply.
- **Checks:** `npm run check` and `npm test` pass, including the structure test with the new budgets. Both pass on HEAD today: I ran `npm run check` and the 11 orchestration tests.

## Open questions

- none
