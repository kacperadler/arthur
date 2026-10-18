# session

The `session` plugin: the coordinator's one long conversation, compacted at set times during the day so it never overflows its context (roadmap entry 35). It needs `orchestration`, which runs the coordinator. The fresh start at night, `/restart` and the restart guard are roadmap entries 36 and 37.

## Options

In `session({ ... })` in `arthur.config.ts`; every key optional:

| Option | Meaning |
| --- | --- |
| `compactAt` | The times of day the coordinator's conversation is compacted, each `"HH:MM"` (00:00 to 23:59) in `core.timeZone`. Default `["08:00", "13:00", "18:00"]`; `[]` never compacts. |
| `compactWaitSeconds` | How long a compaction waits for the coordinator to be idle, a whole number of seconds of at least 1. Default 1800. |

Refused at load (and by `arthur config check`), naming the option: a `compactAt` that is not a list, an entry that is not `"HH:MM"` (`compactAt[<index>]: expected a time "HH:MM" from 00:00 to 23:59, got <value>`), a `compactWaitSeconds` that is not a whole number of at least 1, and any other option, `freshAt` and the other options of entries 36 to 38 included, until those entries are built.

## Compaction during the day

`arthur run` looks at the clock every 500 ms. At each `compactAt` time it asks the coordinator for a compaction, in `<home>/session/compact.json`. The compact extension, `packages/session/src/compact-extension.ts`, which orchestration loads into the coordinator's agent (`arthur coordinator --help`, `coordinator.extension`), then:

1. Waits until the agent is idle with nothing queued: no turn running and no message waiting in omp, for 2 s in a row, longer than the coordinator's inbox takes to hand over what it queued. Running jobs do not hold it back.
2. Asks the coordinator, as a message from Arthur, to write its handoff to `<home>/session/handoff.md`, replacing what it holds: the work in progress, the next steps, and every question to the owner still unanswered, with when it was asked. Its reply goes to nobody, unless an owner's message joins that turn.
3. When that turn has ended and the agent is idle, and the handoff is new (its modification time changed since step 2), compacts the conversation with omp's own compaction, as `/compact` does.
4. Gives the compacted conversation the handoff, as a message from Arthur that holds its text, so the first turn after the compaction starts by reading it. An empty handoff (only blanks) is not read back.

`arthur run` prints the outcome, one line:

- `session: compact: done; the compacted conversation starts by reading the handoff`, or `session: compact: done; the handoff is empty, so nothing is read back`.
- `session: compact: skipped, session busy for <n> s`: the agent was not idle with nothing queued within `compactWaitSeconds` of the slot. The handoff is not asked for.
- `session: compact: skipped, handoff not written: <reason>`: the conversation is left as it was, not compacted. Reasons: `no new handoff when the coordinator's turn ended`, with omp's error in brackets when the turn ended in one; `no turn started within 30 s` after the request was handed over; `the request did not reach the agent: <error>`.
- `session: compact: failed: <omp's error, first line>`: omp's compaction threw; nothing is read back.

When it happens:

- No coordinator running at a slot: nothing happens and nothing is printed. The request is dropped once `compactWaitSeconds` have passed without an agent taking it, so a coordinator that starts later does not compact late; one that starts within that time does compact.
- A slot that passed while `arthur run` was down is skipped, not run late: the next slot is counted from the start, and a request left by the previous run is dropped at the start.
- Two slots close together never queue two compactions: a slot that comes while a compaction is still asked for or running is dropped, and slots passed together (a clock that jumped, a machine that slept) ask once.
- Daylight saving days: a time the spring gap skips (02:30 in Warsaw) comes at the first minute after the jump (03:00); a time the autumn repeat shows twice compacts at its first pass only.
- The coordinator restarting during a compaction: its request is dropped without a word once the agent that took it is gone.
- A `compact.json` that is not a request (edited by hand) is dropped: `session: <home>/session/compact.json is not a compaction request, so it is dropped: <its first 200 characters>`.

The extension acts only in the coordinator's own session, one with a UI, never in a `task` subagent.
