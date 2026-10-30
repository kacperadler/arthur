# AR0585 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A job's MCP servers would be named as leftover processes

- Kind: fix
- Found by: 2026-10-30-worker-3a3e2dc3 (worker), 2026-10-30
- Where: `packages/delivery/src/processes-extension.ts:35`
- What: the reminder names every process of the job but the agent and its wrapper. A job whose role has MCP servers (`<record>/mcp/.mcp.json`, passed with `--plugin-dir`) has omp start each stdio server as its own child, so [INFERENCE, not run: no MCP role was tried] every run of such a job ends with one reminder naming them, an extra turn paid for, and an agent may stop a server it still needs before its final message. Jobs without MCP servers are not affected: in this job's scope only the wrapper and omp ran (`cat .../arthur-job-2026-10-30-worker-3a3e2dc3.scope/cgroup.procs`).
- Suggestion: run a job with an MCP role under the extension and look at what it names; if the servers show, leave out the processes the agent already had before its first tool call (a list taken at `session_start`, or at the first `tool_call`). Killing anything stays out.
- Status: deferred (client summary)

## F2. no test checks that `processes-extension.ts` is registered

- Kind: fix
- Found by: 2026-10-30-review-a44e1e4c (review), 2026-10-30
- Where: `packages/delivery/src/delivery.ts:114`
- What: I removed it from the loop (mutation: `["./checks-extension.ts"]`) and all delivery tests still passed: 110 pass, 0 fail. `processes.test.ts` loads the extension by its own path, so it never goes through the registration. This gap was already in 1b4fe68, which passed review 1.
- Status: deferred (client summary)
