# AR0192 - The roadmap's Tailscale IPv6 range and the machines plugin's disagree

```json
{
  "id": "AR0192",
  "title": "The roadmap's Tailscale IPv6 range and the machines plugin's disagree",
  "date": "2026-10-19"
}
```

## Description

entry 82 names Tailscale's IPv6 range `fd7a:115c:a1e5::/48`, the machines plugin uses `fd7a:115c:a1e0::/48`. The models plugin accepts all of `fc00::/7`, as entry 82 lists it, which holds both, so a provider is not affected; a machine's address in `a1e5` would be refused by the machines plugin.

## Goal

The roadmap and the machines plugin accept the same Tailscale IPv6 range, so an address is either allowed by both or by neither.

- Kind: cleanup

Evidence:
- `spec/roadmap.md` entry 82 (`fd7a:115c:a1e5::/48`), `packages/machines/src/machine-check.ts` (`PRIVATE.addSubnet("fd7a:115c:a1e0::", 48, "ipv6")`, and `fd7a:115c:a1e1::1` counted public in `packages/machines/test/machines.test.ts`)
- Found by: 2026-10-19-ar0187-models-d5226cf4 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: check Tailscale's documented range and correct whichever of the two is wrong, the roadmap's text or the machines plugin's subnet and its test.
- `npm test` and `npm run check` pass.

## Scope

In:
- check Tailscale's documented range and correct whichever of the two is wrong, the roadmap's text or the machines plugin's subnet and its test.

## Decisions

- 2026-10-19: Source: F3 of AR0187
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
