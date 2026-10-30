# AR0572 - Review 1

- Job: 2026-10-30-review-bcfa24c6
- Branch: arthur/2026-10-30-worker-27752479
- Commit reviewed: d0679941e411d78f85d426da478b3eda5737156c
- Verdict: PASS

## Final message

**Verdict: PASS.** No finding blocks the merge. Every point in your steer holds and every check reproduces. One security hole, which I reproduced, goes under the notes: a broken `python3` lets a job run without the sandbox even though the option is off.

How each point you asked about holds:
- **Refusal on this machine:** `job-sandbox.ts:91` refuses with `no sandbox: <why>; set core.jobs.unsandboxed: true in arthur.config.ts …` unless the option is on. In `wrapper.ts`, the install's refusal is caught at :123 and the agent's at :128. Either way the job ends `failed: no sandbox: …` (`job-ending.ts:12`) before the install or the agent starts. Test: `sandbox.test.ts:195`.
- **Refusal on another machine:** the option goes in the job data sent to the other machine (`jobs.ts:178`), and `remote-job add` writes it into the record there (`remote-job.ts:47`). A record without the field needs the sandbox. Test: `machine.test.ts:283`.
- **Merge steps:** `stepSandbox` passes `true` (`job-sandbox.ts:121`), so they still run without a sandbox.
- **Missing agent:** `the agent <agent> is not there` is exempt, so the agent still starts outside the sandbox and fails as before.
- **Doctor line:** `core sandbox` has no `critical`, so the test asserts `false` and `printAtStart` doesn't refuse `arthur run`. With the option on, the line reads `ok (…)`.
- **Tests opt in:** the test kit's runner (`testing.ts:128`) and the core tests' runners and CLI configs turn the option on. On this host the sandbox works, so turning it on changes nothing here. I didn't run the worker's simulated bare host; their figure is 121 pass / 0 fail.
- **`.base-sim/`:** no `.base-sim/` or `.bare-sim/` path is in the tree, and `git status` is clean.
- **Core budget:** 6518 in `test/structure.test.ts`, as AR-D387 decided.
- **Plan:** the files beyond the plan's list (`requirements.ts`, `remote-job.ts`, `jobs.ts`, `config.ts`, `testing.ts`, three docs) follow from the Done means (doctor names the option) and the plan's Risks line about remote machines. The worker's message explains them.

## Notes
- (security) packages/core/src/job-sandbox.ts:91,103: a `python3` that exits 127 itself gets past the refusal. The check reads exit status 127 as "the agent is not there", whoever produced it. A broken wrapper or shim does the same, for example `exec /opt/gone/bin/python3 "$@"`, or a pyenv shim with no Python version. I reproduced it with `unsandboxed=false`: `sandboxed()` returned `["sh",["-c","echo ran"]]`, so the agent would run without a sandbox, and the log said `no sandbox: the agent sh is not there`. Fix: check the agent's absence apart from python3's own exit, e.g. a marker the probe's shell prints.
- (minor) packages/core/src/requirements.ts:117: doctor checks with `noSandbox([], "sh")`, not a job's real paths and agent. A failure tied to one path or to the agent can show `ok` in doctor while the job is refused.
- (minor) packages/core/test/sandbox.test.ts:326,354,373,499,540,597: tests that already skip on a host without the sandbox also turn the option on. They don't need it, and running them with the default would cover the production path.

## Checks
- `npm ci`: exit 0.
- `npm run check`: tsc clean.
- `npm test`, in one call: 1368 tests, 1306 pass, 0 fail, 62 skipped. This matches the worker. `limits.test.ts` passed in the full run.
- Python 3.12.3 is present, and `noSandbox([], "sh")` and `noSandbox(["/tmp"], "sh")` both return `undefined` (the sandbox sets up here).
- 15 code changes, each run against `sandbox.test.ts`, `machine.test.ts`, `doctor.test.ts` or `config.test.ts` and restored with `git checkout`. Tests failed for every one:

| Change | Failing tests |
|---|---|
| Always refuse, option ignored | 3 |
| Never refuse | 3 |
| Missing-agent exemption removed | 1 |
| `stepSandbox` stops opting in | 1 |
| Wrapper always opts the agent in | 2 |
| Wrapper always opts the install in | 1 |
| Install `.catch` removed | 1 |
| `remote-job add` always writes `true` | 1 |
| `addThere` always sends `true` | 1 |
| Record always writes `"true"` | 2 |
| `job-ending` keeps the "the agent did not start" prefix | 1 |
| Doctor's opted-in branch inverted | 1 |
| Doctor line made critical | 1 |
| Config default flipped to true | 2 |
| Option's type check removed | 1 |

- Broken `python3` (exit 127) with `unsandboxed=false`: no refusal, and the agent's command came back without the sandbox (the security note above).

PASS