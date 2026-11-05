# AR0634 - The roadmap page shows listen, video and Discord as not built, and the README status is from October

```json
{
  "id": "AR0634",
  "title": "The roadmap page shows listen, video and Discord as not built, and the README status is from October",
  "date": "2026-11-05"
}
```

## Description

The owner, 2026-11-05, reading https://kacperadler.github.io/arthur/roadmap/: "81 Listen: local transcription of voice notes ... and this is done or not? check the 'The switch, and the rest of the first version: 0 of 7 built' ... i think the readme and roadmap are not updated".

Evidence:
- The published page says "The switch, and the rest of the first version: 0 of 7 built". Of its 7 entries, 81 (listen: AR0550, renamed by AR0554), 102 (video: AR0551), 89 and 90 (Discord: the AR0592 plan's tickets, AR0602 "Discord T2 ... (roadmap 90)", AR0606) are merged and in use; only 70 to 72 (Docker, AR0604 planned) are not built.
- Cause: `site/scripts/roadmap.ts:49`, `entryOf`, ties a ticket to an entry only by a title that starts `Roadmap <N>:`. The tickets of those entries are titled `Voice: ... (roadmap 81)`, `Video: ...`, `Discord T2: ... (roadmap 90)`, so no entry finds its ticket and each shows "not started".
- `README.md:27`, the Status paragraph, still says "main on 2026-10-25", "with Telegram as its channel", and "Next: an agent per project ... (roadmap entries 85 to 88)": the owner's channel is Discord since AR0602, and the first version's remaining entries are Docker (70 to 72) and Dokploy's upload and deploy (AR0603).

## Goal

The roadmap page and the README say what is built: each roadmap entry whose ticket is merged shows built, and the README's Status paragraph matches the state of main.

- Kind: docs

## Done means

- Each roadmap entry finds the ticket that built it, whatever the title's wording: for example a `- Roadmap: <N>` line (or several) under the ticket's Goal, read by `site/scripts/roadmap.ts`, added to the merged tickets of entries 81, 102, 89 and 90 (and any other built entry the page shows as not started), or `spec/roadmap.md`'s entry naming its tickets; the worker picks the smaller change and says why. A ticket titled `Roadmap <N>:` still counts.
- The generated roadmap page shows "The switch, and the rest of the first version: 4 of 7 built" (81, 102, 89, 90 built; 70 to 72 not), and every other section's count is checked against the board; any other miscount found is fixed the same way and named in the final message.
- A test of `site/scripts/roadmap.ts` fails when the new way of naming an entry is removed.
- `README.md`'s Status paragraph: the date of main, Discord as the channel in use (Telegram still available), and "Next" naming what is next in `spec/roadmap.md`'s order. The feature list (`README.md:33-55`) checked against the board: dokploy partly built (upload and deploy: AR0603), docker planned.
- `npm run check` and `npm test` pass; the site builds (`site/`'s own build command).

## Scope

In:
- `site/scripts/roadmap.ts` and its test, `README.md`, `spec/roadmap.md` if the entries name their tickets there, the ticket files of the merged tickets of the entries above if the link goes there.

Out:
- The roadmap's content and order: unchanged.

## Decisions
- 2026-11-05: AR0634 approved: start it when a job slot frees, beside the Arthur queue; the owner: "AR-D50 - 1" (AR-D507)
