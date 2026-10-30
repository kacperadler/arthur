# AR0572 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. a `python3` that exits 127 itself gets past the refusal

- Kind: security
- Found by: 2026-10-30-review-bcfa24c6 (review), 2026-10-30
- Where: `packages/core/src/job-sandbox.ts:91,103`
- What: The check reads exit status 127 as "the agent is not there", whoever produced it. A broken wrapper or shim does the same, for example `exec /opt/gone/bin/python3 "$@"`, or a pyenv shim with no Python version. I reproduced it with `unsandboxed=false`: `sandboxed()` returned `["sh",["-c","echo ran"]]`, so the agent would run without a sandbox, and the log said `no sandbox: the agent sh is not there`. Fix: check the agent's absence apart from python3's own exit, e.g. a marker the probe's shell prints.
- Status: deferred (client summary)
