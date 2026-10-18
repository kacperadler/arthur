# AR0118 - Outcome

- Merged: 2026-10-18, `74729e0`
- Branch: h/2026-10-18-ar0118-tailscale-step-c5b112ac
- Reviews: review-1.md PASS
- Cost: worker $0.00, reviews $0.19; review rounds 1

## What went in

- `docs/setup.md`: new optional step 11, Tailscale for other machines (install, `tailscale up`, MagicDNS, a `Host` in `~/.ssh/config`, Check `ssh <name> true`); later steps renumbered 12 to 15.
- `spec/roadmap.md` entry 94: `arthur setup` lists `tailscale` among the tools.
- Review ran `tailscale version` and `tailscale status` on the VPS; the example version 1.78.1 in entry 94 is illustrative (note dropped).

## Checks on main

- `npm run check`: passed.
- `npm test`: 389/389 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
