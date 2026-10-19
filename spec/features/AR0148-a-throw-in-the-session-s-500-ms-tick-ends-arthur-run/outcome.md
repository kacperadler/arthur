# AR0148 - Outcome

- Merged: 2026-10-19, `cee952c`
- Branch: h/2026-10-19-ar0148-daa7de8b
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $3.80, reviews $1.57; review rounds 2

## What went in

- `arthur run` survives a throw in any session tick (compaction, restart, turn notice): each tick runs in its own catch, prints `session: <what> failed: <first line>` once per distinct error, and the next tick runs as usual.
- A failed fresh-start request write is tried again at the next tick, and a night restart whose `restart()` throws is tried again the next night.
- A file that is not a request, or not a restart's mark, is removed before it is named, so an unwritable folder no longer repeats the line every 500 ms.

## Checks on main

- `npm run check`: passed.
- `npm test`: 566/566 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0175 (F1).
