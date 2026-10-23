# AR0307 - The switch: Arthur runs on the VPS and takes its own tickets

```json
{
  "id": "AR0307",
  "title": "The switch: Arthur runs on the VPS and takes its own tickets",
  "date": "2026-10-23"
}
```

## Description

Every roadmap entry before the switch (1 to 83, with 96 to 98) is merged. This ticket is the switch itself (`spec/roadmap.md`, "The switch, and the rest of the first version"): Arthur runs on the VPS under `docs/setup.md` and takes its own tickets with Telegram as its channel, instead of the harness.

## Goal

- Plan: tak
- Kind: improvement

Evidence: `h ticket --all` shows Roadmap 60 to 69, 80, 82, 83, 97 merged; `docs/setup.md:5` still says Arthur is in development and lists only seven commands as existing, though no step there says `Not built yet` any more.

## Done means

- Arthur is set up on the VPS by following `docs/setup.md` step by step, each step's Check passing; a step that fails or is missing is fixed in the doc or in the code, with its test.
- `arthur run` runs as the systemd user service, the coordinator answers on Telegram, and `arthur doctor` reports nothing missing.
- One real Arthur ticket goes through Arthur end to end: spawn, review, merge, after-merge.
- At the switch, `.agents/harness/` is removed, `test/arthur-criteria.test.ts` deleted, and `arthur.config.example.ts` stops naming `.agents/harness/roles` (AR0297).
- A failure on the way (a step's Check fails, the service does not start, Telegram does not answer) leaves the harness working this repository as before.
- `npm test` and `npm run check` pass.

## Scope

In:
- `docs/setup.md`, `docs/deploy.md`: corrected by the real run.
- `.agents/harness/`, `test/arthur-criteria.test.ts`, `arthur.config.example.ts`: the switch cleanup.

Out:
- Other projects: they follow after this one.
- Voice (81), Discord (89, 90), Docker (70 to 72): right after the switch, their own tickets.

## Decisions

- 2026-10-23: Created by the coordinator when the human asked how much is left before moving from the harness to Arthur; waits for the human's approval.
