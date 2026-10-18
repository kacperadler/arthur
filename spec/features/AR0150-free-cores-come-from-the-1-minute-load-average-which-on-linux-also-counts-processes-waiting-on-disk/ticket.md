# AR0150 - Free cores come from the 1-minute load average, which on Linux also counts processes waiting on disk

```json
{
  "id": "AR0150",
  "title": "Free cores come from the 1-minute load average, which on Linux also counts processes waiting on disk",
  "date": "2026-10-18"
}
```

## Description

free cores are `availableParallelism() - loadavg()[0]`, as Node's `os` gives them. Linux's load counts tasks in uninterruptible sleep (disk or NFS waits), so a machine busy with IO but idle CPU reads as having few free cores, and a burst shows a minute late. [INFERENCE] from Linux's documented load average; not measured here.

## Goal

Free CPU reflects processes that really use the CPU, so a machine busy only waiting on disk is not counted as full.

- Kind: risk

Evidence:
- `packages/resources/src/machine-free.ts` (`measure`)
- Found by: 2026-10-18-ar0142-29f3b669 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: if it refuses spawns on idle CPUs in practice, sample `os.cpus()` idle times twice, a second apart, on each machine instead; out: memory, which `freemem()` reads as MemAvailable on Linux.
- `npm test` and `npm run check` pass.

## Scope

In:
- if it refuses spawns on idle CPUs in practice, sample `os.cpus()` idle times twice, a second apart, on each machine instead; out: memory, which `freemem()` reads as MemAvailable on Linux.

## Decisions

- 2026-10-18: Source: F2 of AR0142
