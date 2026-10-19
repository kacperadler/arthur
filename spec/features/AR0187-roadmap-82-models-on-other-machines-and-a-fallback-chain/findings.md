# AR0187 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. `arthur continue` of a job on a provider model starts the agent without its provider

- Kind: bug
- Found by: 2026-10-19-ar0187-models-d5226cf4 (worker), 2026-10-19
- Where: `packages/core/src/job-control.ts` (`continueJob`, which calls `launch` without variables), `packages/core/src/remote-job.ts` (`continue`)
- What: the variables a `prepare` returns (`OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `ARTHUR_AGENT_MODEL`) reach the wrapper's environment at the spawn only; they are in no file of the record, by design. `arthur continue` runs no `prepare`, so the continued agent gets `--model mac/qwen3-coder` (the record's name, which omp does not know) and no provider variables, and fails. [INFERENCE: read from the lines; no test runs a continue on a provider model.]
- Suggestion: have `continueJob` run the prepares' variable part again (a `prepare` called with the job read from its record, its returned variables passed to `launch`, on another machine through `remote-job continue`'s stdin as `launch` does), with a test that continues a job on a provider model. Out: writing the variables into the record.
- Status: open

## F2. The 30 s reuse of a probe holds in one process only, so two `arthur spawn` commands each probe

- Kind: improvement
- Found by: 2026-10-19-ar0187-models-d5226cf4 (worker), 2026-10-19
- Where: `packages/models/src/probe.ts` (`probes`, a `Map` of the process)
- What: one probe per provider at a time and its 30 s reuse hold for the spawns of one process (`arthur run`, a test); the coordinator spawns with `arthur spawn`, a process each, so each spawn probes again, and two at once make two requests. The usage report is kept in `<home>/models/usage.json` and is shared; the probes are not.
- Suggestion: keep each answer with its time in `<home>/models/probes.json`, written whole (temporary name and rename), and take `@arthur/core/lock` around a probe so a second process waits for the first one's answer; a test with two processes and the request count of the fake server.
- Status: open

## F3. The roadmap's Tailscale IPv6 range and the machines plugin's disagree

- Kind: cleanup
- Found by: 2026-10-19-ar0187-models-d5226cf4 (worker), 2026-10-19
- Where: `spec/roadmap.md` entry 82 (`fd7a:115c:a1e5::/48`), `packages/machines/src/machine-check.ts` (`PRIVATE.addSubnet("fd7a:115c:a1e0::", 48, "ipv6")`, and `fd7a:115c:a1e1::1` counted public in `packages/machines/test/machines.test.ts`)
- What: entry 82 names Tailscale's IPv6 range `fd7a:115c:a1e5::/48`, the machines plugin uses `fd7a:115c:a1e0::/48`. The models plugin accepts all of `fc00::/7`, as entry 82 lists it, which holds both, so a provider is not affected; a machine's address in `a1e5` would be refused by the machines plugin.
- Suggestion: check Tailscale's documented range and correct whichever of the two is wrong, the roadmap's text or the machines plugin's subnet and its test.
- Status: open

## F4. The doctor checks omp's `models.yml` on this machine only

- Kind: improvement
- Found by: 2026-10-19-ar0187-models-d5226cf4 (worker), 2026-10-19
- Where: `packages/models/src/model-doctor.ts` (`omp models.yml`)
- What: a job on another machine runs that machine's omp, whose own `~/.omp/agent/models.yml` may configure `ollama` or `lm-studio` and so replace the provider the job's environment sets; `arthur doctor` reads only the local file.
- Suggestion: a doctor line per registered machine that reads its `models.yml` through `host.jobs.run` (`cat`, absent is ok), critical as the local one. Out: the provider probes, which already run from the job's machine at spawn.
- Status: open
