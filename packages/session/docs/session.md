# session

The `session` plugin: the coordinator's one long conversation, compacted at set times during the day so it never overflows its context (roadmap entry 35), started fresh at night once no job runs, and restarted on `/restart` (entry 36). Before each, the coordinator writes its handoff, and the next conversation reads it first. It needs `orchestration`, which runs the coordinator. The restart guard and the start notice are roadmap entries 37 and 38.

## Options

In `session({ ... })` in `arthur.config.ts`; every key optional:

| Option | Meaning |
| --- | --- |
| `compactAt` | The times of day the coordinator's conversation is compacted, each `"HH:MM"` (00:00 to 23:59) in `core.timeZone`. Default `["08:00", "13:00", "18:00"]`; `[]` never compacts. |
| `compactWaitSeconds` | How long a compaction waits for the coordinator to be idle, a whole number of seconds of at least 1. Default 1800. |
| `freshAt` | The time of day, `"HH:MM"` in `core.timeZone`, of the first try of the fresh start: a new conversation, without `--continue`, only once no job runs. Default `"23:00"`. |
| `freshRetryMinutes` | While a job runs, the fresh start is tried again this often, counted from `freshAt`; a whole number of minutes of at least 1. A try also waits this long for the handoff. Default 15. |
| `freshUntil` | The time of the last try, `"HH:MM"`; earlier than `freshAt` it is the next day, equal to it a single try. Default `"03:00"`. |

Refused at load (and by `arthur config check`), naming the option: a `compactAt` that is not a list, an entry, `freshAt` or `freshUntil` that is not `"HH:MM"` (`compactAt[<index>]: expected a time "HH:MM" from 00:00 to 23:59, got <value>`, `freshUntil: ...`), a `compactWaitSeconds` or `freshRetryMinutes` that is not a whole number of at least 1 (`freshRetryMinutes: expected a whole number of minutes of at least 1, got <value>`), and any other option, `restartGuard` and `probeLlm` of entries 37 and 38 included, until those entries are built.

## The handoff

`arthur run` asks the coordinator for a compaction or a restart in `<home>/session/request.json`, one request at a time. The handoff extension, `packages/session/src/handoff-extension.ts`, which orchestration loads into the coordinator's agent (`arthur coordinator --help`, `coordinator.extension`), takes it and:

1. Waits until the agent is idle with nothing queued: no turn running and no message waiting in omp, for 2 s in a row, longer than the coordinator's inbox takes to hand over what it queued. Running jobs do not hold it back.
2. Asks the coordinator, as a message from Arthur, to write its handoff to `<home>/session/handoff.md`, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when it was asked. Its reply goes to nobody, unless an owner's message joins that turn.
3. When that turn has ended and the agent is idle, and the handoff is new (its modification time changed since step 2), the handoff is written. A compaction then compacts the conversation with omp's own compaction, as `/compact` does, and gives the compacted conversation the handoff, as a message from Arthur that holds its text; a restart says `handoff written` in the request, and `arthur run` restarts the coordinator.

At every start of the coordinator's agent, the extension notes its pid in `<home>/session/agent`, and, when the handoff is newer than the last one a conversation read, gives it to the new conversation as its first message: `[Arthur] The coordinator just started again. Before that you wrote this handoff (<path>); go on from it:` and its text. So the handoff carries the work in progress and the unanswered questions across every way a conversation ends: a compaction, a fresh start, a `/restart`, a crash. A handoff of only blanks is never read back, and one read (its modification time is noted in `<home>/session/handoff-read`) is not read again. A read that fails to reach the agent stays unread, for the next start.

A `request.json` that is not a request (edited by hand) is dropped: `session: <home>/session/request.json is not a request, so it is dropped: <its first 200 characters>`. A request is replaced by a restart while a compaction is still asked for: the extension drops the compaction, which then prints nothing.

The extension acts only in the coordinator's own session, one with a UI, never in a `task` subagent.

## Compaction during the day

`arthur run` looks at the clock every 500 ms. At each `compactAt` time it asks for a compaction, and prints the outcome, one line:

- `session: compact: done; the compacted conversation starts by reading the handoff`, or `session: compact: done; the handoff is empty, so nothing is read back`.
- `session: compact: skipped, session busy for <n> s`: the agent was not idle with nothing queued within `compactWaitSeconds` of the slot. The handoff is not asked for.
- `session: compact: skipped, handoff not written: <reason>`: the conversation is left as it was, not compacted. Reasons: `no new handoff when the coordinator's turn ended`, with omp's error in brackets when the turn ended in one; `no turn started within 30 s` after the request was handed over; `the request did not reach the agent: <error>`.
- `session: compact: failed: <omp's error, first line>`: omp's compaction threw; nothing is read back.

When it happens:

- No coordinator running at a slot: nothing happens and nothing is printed. The request is dropped once `compactWaitSeconds` have passed without an agent taking it, so a coordinator that starts later does not compact late; one that starts within that time does compact.
- A slot that passed while `arthur run` was down is skipped, not run late: the next slot is counted from the start, and a request left by the previous run is dropped at the start.
- Two slots close together never queue two compactions: a slot that comes while a compaction or a restart is still asked for or running is dropped, and slots passed together (a clock that jumped, a machine that slept) ask once.
- Daylight saving days: a time the spring gap skips (02:30 in Warsaw) comes at the first minute after the jump (03:00); a time the autumn repeat shows twice compacts at its first pass only.
- The coordinator restarting during a compaction: its request is dropped without a word once the agent that took it is gone.

## The fresh start at night

Every night from `freshAt` to `freshUntil` (across midnight when `freshUntil` is the earlier time), `arthur run` tries to give the coordinator a new conversation:

1. A try at `freshAt`, then every `freshRetryMinutes` after it, and the last at `freshUntil` itself, also when it falls between two of those.
2. A try made while any job runs, of any kind (worker, review, plan, audit, ...: every job in a run, as `arthur stopall` counts them), waits for the next try, without a line. After the last try: `session: fresh: skipped, <n> job(s) running at <freshUntil>`, and that night is over; a job that ends later starts nothing until the next night's `freshAt`.
3. With no job running, it asks the coordinator for its handoff (above), waiting up to `freshRetryMinutes` for it. A handoff that is not written withdraws that try with one line, and the next try asks again: `session: fresh: try withdrawn, handoff not written: <reason>; next try at <HH:MM>`, or after the last try `session: fresh: skipped, handoff not written: <reason> at <freshUntil>`. Reasons: those of a compaction above, `session busy for <n> s`, `handoff not written within <n> s`, or `the coordinator ended`.
4. Once the handoff is written, the jobs are counted again: a job started during the wait makes it a try that waits for the next one, as in step 2. With none, the coordinator's session is ended through orchestration's `coordinator.restart` with `fresh: true`, and orchestration starts it again without `--continue` (`arthur coordinator --help`): `session: fresh: done; the coordinator restarts in a fresh conversation, which starts by reading the handoff`. The next try is the next night's `freshAt`.
5. With no coordinator running, no handoff is asked: the restart is made at once, so its next start is a fresh conversation (`..., with no handoff: no coordinator was running`).

A night whose `freshAt` passed while `arthur run` was down is skipped, not run late: the first try is counted from the start. A window that passed unseen (a clock that jumped, a machine that slept) is not tried late either. Times the spring gap skips and the autumn repeat shows twice are taken as for `compactAt`.

Once the next coordinator is up, one `Restarted.` notice goes to every channel, `Restarted. (fresh session)` after a fresh start: `arthur restart --help`, which also covers `/restart` and `/restart fresh`.

## Files

In `<home>/session/`: `request.json` (the request of the moment), `handoff.md` (the coordinator's handoff), `handoff-read` (the modification time of the last handoff read), `agent` (the pid of the coordinator's agent), `restarted.json` (a restart made, until the next coordinator is up; one that is not a restart's mark is dropped, named), and `after-restart.md` (the steps for the human after a restart, sent once with `Restarted.`).
