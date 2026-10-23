# AR0091 - An ssh that exits before reading its input fails as EPIPE instead of with ssh's own line

```json
{
  "id": "AR0091",
  "title": "An ssh that exits before reading its input fails as EPIPE instead of with ssh's own line",
  "date": "2026-10-17"
}
```

## Description

under `npm test`, the test "offline mid-job: stop, steer and continue are refused naming the machine; …" failed in 3 of 4 full runs on this branch (a docs-only change) and passed 3 of 3 runs alone (`node --test --test-name-pattern="offline mid-job: stop" packages/core/test/machine.test.ts`). The failure: `jobs.stop` rejects with `machine gpu: ssh: spawnSync ssh EPIPE` instead of `machine gpu: ssh gpu: kacper@gpu: Permission denied (publickey).`. [INFERENCE] The fake ssh, set to refuse, exits 255 before reading stdin; under load the write of the input to its pipe loses the race and `spawnSync` reports EPIPE, which `ssh()` throws before it reads the exit code and stderr. A real ssh refused by the server can do the same, so the owner would see EPIPE instead of ssh's reason.

## Goal

When ssh to another machine is refused or the machine is unreachable, the owner sees ssh's own line ("Permission denied", "unreachable") instead of a bare EPIPE, even when ssh exits before reading its input; and the "offline mid-job" test in machine.test.ts stops failing under load, so the full suite is green again.

- Kind: fix

Evidence:
- `packages/core/src/job-machine.ts:99` (`ssh()`: `spawnSync` with `input`, and `run.error` thrown first at line 100); seen in `packages/core/test/machine.test.ts:224`
- Found by: 2026-10-17-ar0090-plain-words-rule-7d89946a (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: in `ssh()`, when `run.error` is `EPIPE` and `run.status` is set, go on to `failure(...)` with the status and stderr, as the async runner at line 83 already does ("A command that ends without reading its input: its exit code tells what happened"), so the unreachable or refused line is said; keep the test as the regression check. Out: the fake ssh itself.
- `npm test` and `npm run check` pass.

## Scope

In:
- in `ssh()`, when `run.error` is `EPIPE` and `run.status` is set, go on to `failure(...)` with the status and stderr, as the async runner at line 83 already does ("A command that ends without reading its input: its exit code tells what happened"), so the unreachable or refused line is said; keep the test as the regression check. Out: the fake ssh itself.

## Decisions

- 2026-10-17: Source: F1 of AR0090
- 2026-10-17: The owner approved it.
- 2026-10-17: Merged by the coordinator after review PASS and green checks, per the human 2026-10-16 (K0253: the coordinator merges Arthur branches itself).
