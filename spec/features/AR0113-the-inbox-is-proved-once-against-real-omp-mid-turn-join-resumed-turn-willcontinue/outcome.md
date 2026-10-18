# AR0113 - Outcome

- Branch: h/2026-10-18-ar0113-inbox-live-smoke-a2a32e87

## What went in

- No code change: the live smoke below saw all three behaviours and the `ctx.hasUI` guard work, so `packages/orchestration/src/inbox-extension.ts` stays as AR0084 merged it.
- This file: the smoke's transcript.

## Live smoke, 2026-10-18

Run as AR0084's plan says (How to test, Live smoke), against omp 18.3.0 with Claude Haiku 4.5 (`--model haiku`), in a scratch tmux socket and folder under `/tmp`, started the way `coordinator.ts` starts the coordinator:

```
tmux -S <tmp>/tmux.sock new-session -d -s smoke -c <tmp>/work -e ARTHUR_ORCHESTRATION_FOLDER=<tmp>/orch \
  omp --session-dir <tmp>/sessions --auto-approve --model haiku \
  -e packages/core/src/env-guard.ts -e packages/orchestration/src/inbox-extension.ts -e <tmp>/probe.ts \
  --append-system-prompt packages/orchestration/roles/coordinator.md
```

- `probe.ts` was a throwaway extension that only notes each event with `ctx.hasUI` and the session id. Its log is below; times are UTC.
- Messages were queued the way `inbox.ts` queues them: `{ "channel": "telegram", "text": … }` written whole, then linked into `inbox/queued/<n>`.

### 1. A message joins after the next tool call: seen

- 07:26:05 queued 101: run `sleep 15 && echo slept` with bash, then reply in one line answering every message.
- 07:26:11 queued 102, `Also: what is 2+2?`, during the sleep (bash `tool_call` 07:26:09, `tool_result` 07:26:24).
- The session file, in order: user `[via telegram] Smoke test…`, assistant calls bash, toolResult `slept`, user `[via telegram, sent during this turn] Also: what is 2+2?`, assistant `Smoke test passed; 2+2=4.`
- `outbox/`: `{"text":"Smoke test passed; 2+2=4.","answers":[101,102],"channels":["telegram"]}`. `inbox/answered/` held 101 and 102.

### 2. A message after the reply resumes the turn through `session_stop`: seen

- 07:26:44 queued 103: without any tool, write a 400-word story about a lighthouse keeper, then answer any other message in one last line.
- 07:26:48 queued 104, `And what is the capital of France?`, while the story streamed (`agent_start` 07:26:46, no tool call in the turn).
- `session_stop` at 07:26:55.196 returned the continuation; the session file holds a `custom_message` `session-stop-continuation` between the first story and a second one. The model's thinking in the pane: "The user is telling me that my previous reply hasn't been sent yet … They want me to write ONE reply".
- `outbox/` got one reply for the turn: `answers` `[103,104]`, channels `["telegram"]`, 2448 characters, its last line `The capital of France is Paris.` The first story was never written to `outbox/`.
- The continuation's text is not shown in the pane, only the model's thinking about it, as the plan's Risks say.

### 3. `agent_end.willContinue`: seen

- 07:26:55.197, after the continuation: `agent_end` with `willContinue: true`, followed 1 ms later by `agent_start` of the resumed turn.
- The final `agent_end` (07:26:59.972) and every other one carried the key `willContinue` with no value (the probe saw the key in `Object.keys(event)`; `JSON.stringify` dropped it). The extension's `event.willContinue === true` reads both right, and the fake agent sends the same `undefined`.

### 4. A `task` subagent does not take the inbox: seen

- 07:27:40 queued 105: start one subagent with the task tool that runs `sleep 20 && echo done`; reply after it returns.
- 07:27:53 queued 106, `And what is 3+3?`, while the subagent's bash ran (07:27:48 to 07:28:08).
- The subagent's events all came with `hasUI: false` in its own session: `session_start`, `agent_start`, `tool_result` (bash at 07:28:08.831, yield), `agent_end`. 106 stayed in `queued/` through them (`ls` every 3 s: `queued=106` until 09:28:08 local).
- It joined the coordinator after its `wait` tool's result (07:28:10.649): `[via telegram, sent during this turn] And what is 3+3?`. Reply: `{"text":"Subagent ran the command successfully and output \"done\"; 3+3=6.","answers":[105,106],"channels":["telegram"]}`.
- Only the coordinator's session file holds `3+3`; the subagent's (`AbundantMacaw.jsonl`) does not.
- The guard removed once (`if (ctx.hasUI)` cut from the `tool_result` handler, in a copy under `/tmp`), same two messages (201, 202): the subagent's bash `tool_result` took 202, which landed in the subagent's session file as `[via telegram, sent during this turn] And what is 3+3?`. The coordinator's reply answered `[201]` only, and 202 stayed in `inbox/turn/` with no reply. So the guard is what keeps the inbox out of a subagent.

### Probe log (coordinator run)

```
07:25:55.526 session_start  hasUI=true  coordinator
07:26:06.569 agent_start    hasUI=true  coordinator
07:26:09.267 tool_call      hasUI=true  coordinator bash
07:26:24.316 tool_result    hasUI=true  coordinator bash
07:26:25.953 session_stop   hasUI=true  coordinator
07:26:25.953 agent_end      hasUI=true  coordinator last=assistant/stop
07:26:46.066 agent_start    hasUI=true  coordinator
07:26:55.196 session_stop   hasUI=true  coordinator
07:26:55.197 agent_end      hasUI=true  coordinator willContinue=true last=assistant/stop
07:26:55.198 agent_start    hasUI=true  coordinator
07:26:59.972 session_stop   hasUI=true  coordinator
07:26:59.972 agent_end      hasUI=true  coordinator last=assistant/stop
07:27:42.135 agent_start    hasUI=true  coordinator
07:27:45.838 tool_call      hasUI=true  coordinator task
07:27:45.846 tool_result    hasUI=true  coordinator task
07:27:45.903 session_start  hasUI=false subagent
07:27:46.960 agent_start    hasUI=false subagent
07:27:47.891 tool_call      hasUI=true  coordinator wait
07:27:48.822 tool_call      hasUI=false subagent bash
07:28:08.831 tool_result    hasUI=false subagent bash
07:28:10.643 tool_call      hasUI=false subagent yield
07:28:10.644 tool_result    hasUI=false subagent yield
07:28:10.647 agent_end      hasUI=false subagent last=toolResult
07:28:10.649 tool_result    hasUI=true  coordinator wait
07:28:12.880 session_stop   hasUI=true  coordinator
07:28:12.880 agent_end      hasUI=true  coordinator last=assistant/stop
```

Proved on omp 18.3.0 only; the pane offered 18.12.1.

## Left open

- none
