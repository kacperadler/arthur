# AR0118 - Review 1

- Job: 2026-10-18-review-ar0118-tailscale-658e3f30
- Branch: h/2026-10-18-ar0118-tailscale-step-c5b112ac
- Commit reviewed: ff1371faa16132a331c82833437b71cc41cf6b98
- Verdict: PASS

## Final message

Scope matches exactly: only `docs/setup.md` and `spec/roadmap.md`, as worker claimed and ticket specified.

Verification performed:
- `npm ci`: clean install, 7 packages added, no errors.
- `npm run check`: `tsc` clean, no errors — matches worker's claim.
- `npm test`: 385/385 pass, 0 fail — matches worker's claim exactly.
- `tailscale version` / `tailscale status` run directly on this VPS (per task's Focus): `tailscale version` prints `1.102.4` as its first line, confirming the doc/roadmap's description "its version (the first line its version command prints)" holds for the real binary; `tailscale status` lists peers in the expected `IP  name  user  os  status` shape, consistent with the doc's reliance on MagicDNS names. No `tailscale up`/`down` or state-changing command was run, per instruction.
- Read full `docs/setup.md` step 11 and confirmed it matches every ticket bullet: install commands, `sudo tailscale up`, MagicDNS mention, `Host` block in `~/.ssh/config` keyed by Tailscale name, and the exact Check wording (`ssh <name> true` exits 0 without a password prompt). Confirmed placement directly after steps 9–10 (the service / cgroup steps), old steps 11–14 renumbered to 12–15 consistently, including the cross-reference "terminal of step 12" and the roadmap entry 94 tool list.
- Confirmed roadmap entry 94's tools list and worked example both gained `tailscale`, worded as the ticket requires ("names the Tailscale check among the tools it finds").

Notes (non-blocking):
- The `tailscale` row's version in the roadmap's worked example (`1.78.1`) doesn't match this VPS's real `1.102.4`, but the worker flagged it as illustrative/`[INFERENCE]`, consistent with the other illustrative rows (`node v24.21.0`, etc.) already in that table before this diff.

No code was touched; all Done-means points are satisfied end-to-end; diff stays within the ticket's declared scope; checks reproduce exactly as claimed.

PASS
