# AR0090 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket AR0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: the merge turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket AR0000`.

## F1. An ssh that exits before reading its input fails as EPIPE instead of with ssh's own line

- Kind: bug
- Found by: 2026-10-17-ar0090-plain-words-rule-7d89946a (worker), 2026-10-17
- Where: `packages/core/src/job-machine.ts:99` (`ssh()`: `spawnSync` with `input`, and `run.error` thrown first at line 100); seen in `packages/core/test/machine.test.ts:224`
- What: under `npm test`, the test "offline mid-job: stop, steer and continue are refused naming the machine; …" failed in 3 of 4 full runs on this branch (a docs-only change) and passed 3 of 3 runs alone (`node --test --test-name-pattern="offline mid-job: stop" packages/core/test/machine.test.ts`). The failure: `jobs.stop` rejects with `machine gpu: ssh: spawnSync ssh EPIPE` instead of `machine gpu: ssh gpu: kacper@gpu: Permission denied (publickey).`. [INFERENCE] The fake ssh, set to refuse, exits 255 before reading stdin; under load the write of the input to its pipe loses the race and `spawnSync` reports EPIPE, which `ssh()` throws before it reads the exit code and stderr. A real ssh refused by the server can do the same, so the owner would see EPIPE instead of ssh's reason.
- Suggestion: in `ssh()`, when `run.error` is `EPIPE` and `run.status` is set, go on to `failure(...)` with the status and stderr, as the async runner at line 83 already does ("A command that ends without reading its input: its exit code tells what happened"), so the unreachable or refused line is said; keep the test as the regression check. Out: the fake ssh itself.
- Status: open
