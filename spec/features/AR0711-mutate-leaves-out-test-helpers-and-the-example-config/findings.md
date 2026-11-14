# AR0711 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. An activity log test passes only on 2026-11-13 in Europe/Warsaw

- Kind: test
- Found by: 2026-11-13-worker-d804912a (worker), 2026-11-13
- Where: `packages/activity/test/log-command.test.ts:211`
- What: "what arthur run wrote reads back: the owner's message and the reply on his word, each cut at textChars" mixes two clocks. `load` gives the fake host a fixed `now` of 2026-11-13T10:00Z (line 12, 82), so `arthur log`'s default day is 2026-11-13; but `fake.emit` stamps the events with the real time, and `activity.ts:53` files them under that time's date in Europe/Warsaw. Once the real date in Warsaw is no longer 2026-11-13 the events go to another day file and the command prints `no activity to show on 2026-11-13`. Seen at 2026-11-13 23:22 UTC (00:22 in Warsaw): `node --import @arthur/core/testing --test packages/activity/test/log-command.test.ts` gives 10 pass, 1 fail, and `npm test` fails with it; from this day on it fails every day, on main too.
- Suggestion: have the test read back the day the events were filed under (`--day` with `fake.host.clock.local(new Date(message.time)).date`), or emit the events at the fake's `now`. Nothing in `src/` changes.
- Status: fixed in d9c8a727
