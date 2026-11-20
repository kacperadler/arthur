# AR0731 - The roadmap page counts a ticket titled `(roadmap N)` as entry N's

```json
{
  "id": "AR0731",
  "title": "The roadmap page counts a ticket titled `(roadmap N)` as entry N's",
  "date": "2026-11-20"
}
```

## Description

The public roadmap page counts a ticket titled `(roadmap N)` as entry N's, so entries built by such tickets no longer show as not built. Eight entries (70, 72, 85, 108 to 112) show as built.

## Goal

the hand-written `Tickets:` line was missed in 8 of 13 tickets titled `(roadmap N)`, so the public roadmap is wrong for 8 entries. Reading the title removes the step. I dry-ran the regex below over `spec/build.json`: it finds AR0550, AR0602, AR0644–AR0647, AR0649–AR0653 and AR0705–AR0708, and every entry they name exists.

Evidence:
- AR0708 review-1.md, finding 2: entry 88 had no `- Tickets: AR0708` line.
- AR0705 passed review-3 with entry 85 still missing its `Tickets:` line; it is still missing today.
- I ran `joinBoard` on `188c298e`: entries 70, 72, 85 and 108–112 show no ticket, so the page shows them as not built. Their tickets (AR0645, AR0647, AR0705, AR0649–AR0653) are all merged and titled `(roadmap N)`.

- Kind: fix

## Done means

- `entryOf` in `site/scripts/roadmap.ts` matches both `Roadmap N:` at a title's start and `(roadmap N)` or `(roadmap N, <words>)` at its end; a range names none.
- A test of the roadmap script gives a board with each form and a range, and asserts each entry's tickets; it fails with the old regex.
- `npm run check && npm test` pass.

## Scope

In:
- `site/scripts/roadmap.ts`, `entryOf`

Before:
> const entryOf = (ticket: Ticket) => /^Roadmap (\d+):/.exec(ticket.title)?.[1];

After:
> // A ticket names its entry at its title's start (`Roadmap <N>:`) or end (`(roadmap <N>)`, `(roadmap <N>, core half)`); a range names none.
> const entryOf = (ticket: Ticket) => (/^Roadmap (\d+):/.exec(ticket.title) ?? /\(roadmap (\d+)(?:, [^)]*)?\)$/.exec(ticket.title))?.[1];

Out:
- Any other role, criteria or script change of the retro: its own ticket.

## Decisions

- 2026-11-20: Source: retro spec/retro/2026-11-20.md
