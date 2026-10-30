# AR0591 - Review 1

- Job: 2026-10-30-review-1de23042
- Branch: arthur/2026-10-30-worker-063d5147
- Commit reviewed: fd1a57d413590b82f43d161eb2ccadb35dffedca
- Verdict: PASS

## Final message

I found nothing that blocks the merge: a `python3` that exits 127 on its own is now refused, a real missing agent still starts bare, and every Done means point holds.

- **The fix** (`packages/core/src/job-sandbox.ts:99,103`): the probe's shell now runs `command -v "$1" || { echo missing; exit 127; }`. `noSandbox` counts the agent as missing only when the exit status is 127 and stdout is exactly `missing\n`. Any other failure falls through to the stderr reason, so `sandboxed()` refuses it unless `unsandboxed` is on. `SCRIPT` writes nothing to stdout, so the marker can't be faked by the sandbox setup itself.
- **The new test** (`packages/core/test/sandbox.test.ts:160-171`): with `job-sandbox.ts` set back to the base, it fails with `Missing expected exception.`; on the tip it passes. It covers both the refusal without the opt-in and the bare start, with the reason logged, when opted in.
- **A real missing agent still starts bare:** the existing test passes, and a smoke run with the real `python3` gave `["/nonexistent/omp",["-p"]]` and logged `no sandbox: the agent /nonexistent/omp is not there; ...`. A real agent with the real `python3` still gets the sandbox.
- **Line budget:** `job-sandbox.ts` is 146 lines on both base and tip, so the core's net change is 0. The budget in `structure.test.ts` is untouched at 6518, and the structure test passes.
- **Scope:** only the two files the ticket allows are changed, in one commit: `fix(AR0591): ...`.
- **Worker's claims:** they match what I saw: the base failure message, the mutation of the marker, the refusal of the exact shim from the ticket, and the line count.

## Notes
- (minor) packages/core/src/job-sandbox.ts:103: a looser stdout match is not caught by the tests. Changing `probe.stdout === "missing\n"` to `probe.stdout.includes("missing")` still passes all three sandbox tests. A broken `python3` would have to print `missing` on stdout to exploit it, which is unlikely.
- (minor) packages/core/src/job-sandbox.ts:103: the limit the worker named is real. A `python3` that prints exactly `missing` and exits 127 would still pass as a missing agent.

## Checks
- `npm ci`, then `npm run check && npm test` (timeout 1800 s): `tsc` clean, `ℹ fail 0`.
- New test against the base `job-sandbox.ts`: 1 fail (`Missing expected exception.`), 2 pass. Restored.
- Mutation M1, the stdout check removed: the new test fails. Restored.
- Mutation M2, the `echo missing` marker removed: the missing-agent test fails. Restored.
- Mutation M3, the stdout check inverted: both tests fail. Restored.
- Mutation M4, `includes("missing")` instead of the exact match: no test fails (the note above). Restored.
- Smoke with the ticket's shim `exec /opt/gone/bin/python3 "$@"` first in `PATH`: refused with `no sandbox: .../python3: 2: exec: /opt/gone/bin/python3: not found; set core.jobs.unsandboxed: true ...`.
- Smoke with the real `python3`: a missing agent starts bare, and `sh` gets the sandbox.
- `git status --short`: clean afterwards.

PASS