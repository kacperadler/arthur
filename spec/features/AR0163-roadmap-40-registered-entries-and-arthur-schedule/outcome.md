# AR0163 - Outcome

- Merged: 2026-10-19, `f3e9ecc`
- Branch: h/2026-10-18-ar0163-a0544f1a
- Reviews: review-1.md PASS, review-2.md PASS; merged unreviewed (--unreviewed): no PASS on d692bee (last PASS: 8d611ec, 1 commits since)
- Cost: worker $6.68, reviews $1.87; review rounds 2

## What went in

- `packages/schedule/src/register.ts`: a plugin calls `host.call("schedule.register", host.name, entries)`; ids become `<plugin>.<id>`; a bad entry or a clashing id refuses the whole call naming the plugin; registrations live in memory, so a disabled plugin's entries vanish at the next load. A registered procedure must be an absolute `.md` inside that plugin's own package folder (normalized, no `..`, symlink held at sweep); config and file entries keep the relative rule (closes AR0162).
- `arthur schedule [list|add|remove]`: list shows each entry's source and next run; `add` refuses a bad time or a taken id, never overwrites a file that is not a JSON list, and writes under the core's lock (`@arthur/core/lock` exported); `remove` refuses registered and config entries and clears the removed entry's run state.
- Budget schedule 497; `docs/commands/schedule.md`, README, `arthur.mmd`, the coordinator role: entry 40 built, the schedule plugin complete. CI failed once on the merge commit and passed on the rerun with the same code.

## Checks on main

- `npm run check`: passed.
- `npm test`: 548/548 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0168 (F1), AR0169 (F2).
