# AR0232 - Outcome

- Merged: 2026-10-20, `3526d40`
- Branch: h/2026-10-20-ar0232-bad-port-refused-0de6efe4
- Reviews: review-1.md PASS
- Cost: worker $0.96, reviews $0.43; review rounds 1

## What went in

- `packages/uptime/src/uptime-options.ts`: a site `url` on one of the 82 ports of the Fetch standard's bad-port list is refused at load, naming the port and that fetch never reaches it; default ports are never refused.
- `packages/uptime/test/uptime-options.test.ts`: the exact message, the refused and neighbouring ports, and every refused port checked against the real `fetch`.
- `packages/uptime/docs/uptime.md`: the new load refusal; `test/structure.test.ts`: uptime budget 288 → 292.

## Checks on main

- `npm run check`: passed.
- `npm test`: 794/794 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
