# AR0378 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The harness still reads the old kinds in this repository until the switch

- Kind: fix
- Found by: 2026-10-23-ar0378-ticket-kinds-2c588335 (worker), 2026-10-23
- Where: `/home/kacper/harness/src/board.ts:24`, `/home/kacper/harness/src/finding-tickets.ts:6`, `/home/kacper/harness/src/autopilot.ts:10`, `/home/kacper/harness/src/changelog.ts:7`
- What: `h` runs this repository and hardcodes the old kinds. With `spec/features/_template/ticket.md` now listing the new kinds: `h ticket status <id> planned` no longer refuses a ticket that keeps the template's Kind line (its GUIDANCE phrase is `Kind: bug | risk | cleanup | improvement`); `h merge` no longer writes a finding's Kind into the ticket it makes (its KIND line does not match); `h ticket status --autopilot` refuses every `fix`/`refactor` ticket (it accepts only `bug`, `cleanup`); `h changelog`, run at each `h merge`, puts every migrated ticket of `CHANGELOG.md` under `### Other`.
- Suggestion: either accept this until the switch, or have the harness read the kinds from the project's template; the human ruled out harness changes on 2026-10-23 (AR0378 Decisions), so this needs his word.
- Status: open
