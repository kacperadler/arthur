# AR0634 - Outcome

- Merged: 2026-11-06, `fff4f07d`
- Branch: arthur/2026-11-06-worker-907f43d7
- Reviews: review-1.md PASS
- Cost: worker $2.11, reviews $0.39; review rounds 1

## What went in

- `site/scripts/roadmap.ts`: reads each entry's `- Tickets:` lines. An entry's ticket is one titled `Roadmap <N>:` or one its Tickets line names. A malformed id or a ticket not on the board fails the build. Named tickets are left out of "Other open tickets".
- `site/test/roadmap.test.ts`: tests for the Tickets line. It ties an entry to a ticket of any title and is read only inside an entry. A named open ticket stands for the entry until one is merged. A bad id and an id missing from the board are refused.
- `spec/roadmap.md`: "How to read an entry" explains the `- Tickets:` key. Entries 81, 102, 89, 90 and 103 name the tickets that built them.
- `README.md`: the Status paragraph gives main on 2026-11-05, Discord as the channel (Telegram still available), a link to the roadmap page, and what comes next in the roadmap's order.
- `site/README.md`: says how the roadmap page links an entry to its ticket, and the two new ways the build fails.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1503/1574 passed.

## Left open

- Findings: none; no findings.md on this ticket.
