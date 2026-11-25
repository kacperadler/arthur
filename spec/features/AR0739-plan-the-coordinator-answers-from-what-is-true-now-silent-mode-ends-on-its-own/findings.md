# AR0739 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A silent state file that does not parse still stays on for good

- Kind: fix
- Found by: 2026-11-24-worker-e5312a48 (worker), 2026-11-24
- Where: `packages/orchestration/src/silent-end.ts:63`
- What: the mode's own end reads `until`, or `since`, from `silent.json`. A file that does not parse has neither, so `silentEnd` leaves it, as the approved plan says ("A broken state file stays as today"): replies and notices stay held until someone runs `arthur silent off`. Only the context's `## Silent` line says so, to the agent, each turn; the owner is not told. `packages/orchestration/test/silent.test.ts`, "a state file that does not parse ... never ends on its own", holds it 30 days on.
- Suggestion: end a broken state too, 24 hours after the file's own mtime, with a notice that says what happened meanwhile is unknown; or send the owner one notice the first time `arthur run` sees it.
- Status: deferred (client summary)

## F2. The loop stop rests on omp's `isError`, not seen on the tool loop that prompted it

- Kind: test
- Found by: 2026-11-24-worker-e5312a48 (worker), 2026-11-24
- Where: `packages/core/src/agent-stream.ts:73`
- What: a call counts as failed when omp's `tool_execution_end` carries `isError: true`. That omp 18.18.7 prints the field on that event is read from its binary (`type: "tool_execution_end", toolCallId, toolName, result, isError`). Not checked: whether the calls of the loop in the ticket's evidence (AR0738's worker, "Nothing applied; retrying the same edit as the tool says.") carried `isError: true`, or came back as a result that only says nothing was applied. A job's sandbox hides the other jobs' records, so the worker could not read that job's session. If omp reports such a result as no error, that loop is not stopped. Also not seen on a real stream: whether `args` of `tool_execution_start` still holds the intent `i`; the code leaves `i` out of the comparison either way.
- Suggestion: read the session of AR0738's worker for the repeated call's `isError`; if it is false there, count a call whose result text equals the one before it as well.
- Status: deferred (client summary)

## F3. A worker cannot run the 39 orchestration tests that need tmux, and this branch changed what 18 of them expect

- Kind: test
- Found by: 2026-11-24-worker-e5312a48 (worker), 2026-11-24
- Where: `packages/orchestration/test/unix-socket.ts:5`
- What: the job sandbox refuses every new Unix socket, so each test marked `{ skip: NO_UNIX_SOCKET }` is skipped in a worker's and a reviewer's run (39 of orchestration's 253 here). This branch puts a line under every reply the sweep emits, and so changed the expected `coordinator-replied` text of 18 of them, in `inbox.test.ts` (10 expectations), `hand-over.test.ts` (10), `inbox-start.test.ts` (2) and `silent.test.ts` (1), without being able to run them; the same sweep is exercised here without tmux by `silent.test.ts`, `voice-reply.test.ts` and `project-routing.test.ts`.
- Suggestion: run `npm test` outside a job's sandbox before the merge, as the merge's own checks do; and move the inbox tests that only need the sweep, not the agent's session, onto `routed` of `project-routing.test.ts`, which needs no tmux.
- Status: deferred (client summary)

## F4. Autopilot's default budget of $1 and cap of $3 are under what a fix usually costs

- Kind: chore
- Found by: 2026-11-24-worker-e5312a48 (worker), 2026-11-24
- Where: `packages/orchestration/src/autopilot.ts:11`
- What: `arthur stats budget` over this repository's merged tickets prints `fix: 89 tickets, median $2.28, 9 in 10 within $9.87`. A ticket pre-approved with `--autopilot` gets the budget that command prints, $1 by default (`AUTOPILOT_BUDGET`) and at most $3 (`AUTOPILOT_CAP`), so about every second autopilot fix stops at its budget and comes back to the owner as a budget question, the round this ticket is meant to save. The plan left it as an open question (AR0726, the words that lift the cap, is out of scope), and the role's new budget rule excepts autopilot tickets.
- Suggestion: the owner decides whether the default and the cap follow the 9-in-10 figure of the ticket's kind, or stay as a deliberate limit on what runs without him.
- Status: deferred (client summary)

## F5. A crash between taking the silent state and telling leaves the mode off and the owner not told

- Kind: fix
- Found by: 2026-11-24-worker-e5312a48 (worker), 2026-11-24
- Where: `packages/orchestration/src/silent-end.ts:47`
- What: `turnOff` renames `silent.json` to `silent.json.<pid>`, reads it and removes it; `silentEnd` emits the notice after. A process killed between the rename and the notice (a few synchronous lines) leaves the mode off, a `silent.json.<pid>` file behind when it died before the removal, and no notice: the replies go out again, but what was held meanwhile is never summed up. Not reproduced; read from the order of the calls.
- Suggestion: at `arthur run`'s start, take a `silent.json.<pid>` whose pid is gone as an end that was not told, and tell it.
- Status: deferred (client summary)

## F6. the leftover processes the worker asked to file as F6 came back in this review

- Kind: fix
- Found by: 2026-11-25-review-90dd7c88 (review), 2026-11-25
- Where: `test/mutate.ts`
- What: After my 4 `npm run mutate` calls, 4 processes of this checkout were still running: 2 `wrapper.ts` and 2 `omp --continue` coordinator sessions (one for agent `blog`), all under `/tmp/arthur-test-*`. I stopped them with `kill`, and `ps -p` then printed nothing. F6 is not in `findings.md` yet. [INFERENCE] they are left when mutate cuts or kills a test run partway; this repeats the worker's guess.
- Status: deferred (client summary)
