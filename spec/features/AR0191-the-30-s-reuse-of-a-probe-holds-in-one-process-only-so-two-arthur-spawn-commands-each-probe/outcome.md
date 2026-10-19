# AR0191 - Outcome

- Merged: 2026-10-19, `06fa19c`
- Branch: h/2026-10-19-ar0190-models-jobs-batch-f89d6b5b
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.48, reviews $1.58; review rounds 2

## What went in

- Probe answers are shared across processes in `probes.json` under a lock, so two `arthur spawn` commands probe a model once (AR0191).
- The roadmap's Tailscale IPv6 range is `fd7a:115c:a1e0::/48`, as the machines plugin has it (AR0192).
- `arthur doctor` reads omp's `models.yml` on each machine, not only this one (AR0193); an unreachable machine shows `ok (not reached)`.
- A plugin's prompt section may add warnings to the spawn (AR0198).
- A job record emptied file by file ends the wrapper with its one line instead of a crash (AR0202).

## Checks on main

- `npm run check`: passed.
- `npm test`: 718/718 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
