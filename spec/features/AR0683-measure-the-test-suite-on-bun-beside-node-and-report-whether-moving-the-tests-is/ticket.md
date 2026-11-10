# AR0683 - Measure the test suite on Bun beside Node, and report whether moving the tests is worth it

```json
{
  "id": "AR0683",
  "title": "Measure the test suite on Bun beside Node, and report whether moving the tests is worth it",
  "date": "2026-11-10"
}
```

## Description

The owner asked (2026-11-10) whether a faster runtime than Node, Bun for example, would run Arthur's tests faster, and to move to it if so. This ticket only measures and reports; any move is the owner's decision afterwards, because the vision says Arthur runs on Node and the styleguide says tests use `node:test`.

## Goal

AR0671 cuts the suite's time on Node (real waits, splits, CI shards) and measures before and after; it does not compare runtimes. Bun 1.4.2 is installed on this server (`~/.local/bin/bun`). Questions to answer with numbers:

- How long does the whole suite take on Bun (`bun test`, which runs `node:test` files through its compatibility layer) against `npm test` on Node, on this server, back to back, with the load noted?
- How many test files and tests run and pass on Bun unchanged, and which fail, grouped by cause (an API Bun lacks or differs on: `t.mock.timers`, `--test-shard`, `--import` of the test kit, `process.getBuiltinModule`, child processes, `node:` modules)?
- What a move would cost: files to change, and the risk of testing on a runtime other than the one Arthur runs on in production.

- Kind: chore

## Done means

- `spec/features/AR0683-.../report.md` with the times (three runs each, Node and Bun, same commit, same load window), the pass/fail counts, the failure groups with one example each, and a recommendation: stay on Node, move the tests, or move Arthur itself, with what each changes.
- No change to Arthur's code, config or CI. The worker ends with the report's numbers in its summary.

## Scope

In:
- `spec/features/AR0683-.../report.md` only.

Out:
- Moving anything to Bun (a later ticket, on the owner's word and a vision change).
- The speed-up work itself (AR0671).

## Decisions
- 2026-11-10: AR0683 approved; the owner: "AR-D615 - yes" (AR-D615)
