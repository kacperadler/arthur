# AR0387 - The harness still reads the old kinds in this repository until the switch

```json
{
  "id": "AR0387",
  "title": "The harness still reads the old kinds in this repository until the switch",
  "date": "2026-10-23"
}
```

## Description

`h` runs this repository and hardcodes the old kinds. With `spec/features/_template/ticket.md` now listing the new kinds: `h ticket status <id> planned` no longer refuses a ticket that keeps the template's Kind line (its GUIDANCE phrase is `Kind: bug | risk | cleanup | improvement`); `h merge` no longer writes a finding's Kind into the ticket it makes (its KIND line does not match); `h ticket status --autopilot` refuses every `fix`/`refactor` ticket (it accepts only `bug`, `cleanup`); `h changelog`, run at each `h merge`, puts every migrated ticket of `CHANGELOG.md` under `### Other`.

## Goal

The harness reads this repository's ticket kinds correctly until the switch, or the gap is accepted (it was, 2026-10-23).

- Kind: chore

## Done means

- The fix, with a test that proves it: either accept this until the switch, or have the harness read the kinds from the project's template; the human ruled out harness changes on 2026-10-23 (AR0378 Decisions), so this needs his word.
- `npm test` and `npm run check` pass.

## Scope

In:
- either accept this until the switch, or have the harness read the kinds from the project's template; the human ruled out harness changes on 2026-10-23 (AR0378 Decisions), so this needs his word.

## Decisions

- 2026-10-23: Source: F1 of AR0378
- 2026-10-23: Coordinator: dropped; the human accepted the harness reading old kinds here until the switch on 2026-10-25.
