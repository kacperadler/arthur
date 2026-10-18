# AR0118 - The setup guide has an optional Tailscale step for other machines

```json
{
  "id": "AR0118",
  "title": "The setup guide has an optional Tailscale step for other machines",
  "date": "2026-10-18"
}
```

## Description

The vision and roadmap reach other machines (entry 30), model providers (entry 82) and the panel (entry 77) over Tailscale, but `docs/setup.md` never says how to set Tailscale up. An owner following the guide finds out only when entry 30 is built.

## Goal

The setup guide covers every network piece the plan assumes, so a newcomer can prepare a VPS and a second machine in one pass.

- Kind: improvement
- Model: haiku

## Done means

- `docs/setup.md` has an optional step, after the service steps, "Other machines (optional): Tailscale": install it on the VPS and each machine (`curl -fsSL https://tailscale.com/install.sh | sh`, `sudo tailscale up`), turn on MagicDNS, add each machine as a `Host` in `~/.ssh/config` by its Tailscale name, and its Check: `ssh <name> true` exits 0 without a password prompt. It says the step is needed only for jobs on other machines (entry 30), model providers on them (82) and the panel (77), and that a single VPS needs none of it.
- Roadmap entry 94 (`arthur setup`) names the Tailscale check among the tools it finds.
- `npm test` and `npm run check` pass.

## Scope

In:
- `docs/setup.md`: the optional step.
- `spec/roadmap.md`: entry 94's tool list.

Out:
- Any code: entry 30 builds the machine checks.

## Decisions

- 2026-10-18: The owner asked whether Arthur's setup covers Tailscale; it does not; proposed by the coordinator, waits for approval.
