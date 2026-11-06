# AR0603 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A ready .zip is sent unchecked, symlink entries included

- Kind: security
- Found by: 2026-11-06-review-53a48921 (review), 2026-11-06
- Where: `packages/dokploy/src/dokploy-zip.ts:18`
- What: a file named `.zip` that starts with `PK\x03\x04` goes to Dokploy as it is, as the AR0588 plan approves, so "the zip holds regular files only" holds only for a zip the plugin writes. A ready zip may hold symlink or device entries. Dokploy v0.30.10's `unzipDrop` (`packages/server/src/utils/builders/drop.ts`, `isDangerousNode`) refuses symlink, block, char and FIFO entries itself, so the server is not reached by them [INFERENCE: from that source, not run against a server].
- Suggestion: read the ready zip's central directory and refuse an entry whose Unix mode is not a regular file or folder, naming it, before any request; or refuse ready zips and always zip a folder. The plan's choice to send a ready zip as it is stays the owner's.
- Status: open

## F2. A file between 2 and 4 GiB is refused as unreadable, not by its size

- Kind: ux
- Found by: 2026-11-06-review-53a48921 (review), 2026-11-06
- Where: `packages/dokploy/src/dokploy-zip.ts:36`
- What: the size check refuses only a zip of more than 4 GiB, but `readFileSync` cannot read a file of more than 2 GiB, so such a file is refused as `cannot be read (ERR_FS_FILE_TOO_LARGE)`, still before any request. The whole zip, up to 4 GiB, is also built in memory.
- Suggestion: refuse a single file over 2 GiB by its size in the same check, naming the limit, and say so in `docs/commands/dokploy.md`; or stream the zip into the form instead of building it in memory.
- Status: open
