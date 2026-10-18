# AR0142 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The free-resources check runs on its own 60 s timer, not at each machines check

- Kind: improvement
- Found by: 2026-10-18-ar0142-29f3b669 (worker), 2026-10-18
- Where: `packages/resources/src/room.ts` (`CHECK_SECONDS`), `packages/machines/src/machines.ts` (`round`)
- What: entry 34 says free CPU and memory are read "at every machine check". The machines plugin emits an event only when a machine's state changes, and the resources plugin may not import it, so resources checks every machine itself at the start of `arthur run` and every 60 s (the default of `machines`' `check.everySeconds`), and again on demand when a check is 2 minutes old. A `check.everySeconds` other than 60 makes two cadences, two ssh calls per machine per round.
- Suggestion: one host-level hook per round (for example `collect("machines.checked", name)` from the machines plugin's round, or the round's command extended with the `node -e` numbers), so one ssh call per machine and round serves both; out: any change to how room is computed.
- Status: open

## F2. Free cores come from the 1-minute load average, which on Linux also counts processes waiting on disk

- Kind: risk
- Found by: 2026-10-18-ar0142-29f3b669 (worker), 2026-10-18
- Where: `packages/resources/src/machine-free.ts` (`measure`)
- What: free cores are `availableParallelism() - loadavg()[0]`, as Node's `os` gives them. Linux's load counts tasks in uninterruptible sleep (disk or NFS waits), so a machine busy with IO but idle CPU reads as having few free cores, and a burst shows a minute late. [INFERENCE] from Linux's documented load average; not measured here.
- Suggestion: if it refuses spawns on idle CPUs in practice, sample `os.cpus()` idle times twice, a second apart, on each machine instead; out: memory, which `freemem()` reads as MemAvailable on Linux.
- Status: open
