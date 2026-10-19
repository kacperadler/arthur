# AR0160 - Outcome

- Merged: 2026-10-19, `c51c1ce`
- Branch: h/2026-10-19-ar0160-restart-clears-re-0903b6ec
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $4.40, reviews $1.30; review rounds 2

## What went in

- While a restart is due, `/restart` (and `arthur restart`) restarts the coordinator after its handoff, then ends `arthur run`, and its service (`Restart=always`) starts it again on the new code, which clears the restart due; the next notice reads `Restarted. (arthur run restarted)`.
- Only an `arthur run` that is the service's main process ends itself; one started by hand says the restart stays due. The nightly fresh start never ends `arthur run`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 574/574 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
