# AR0712 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. An unreadable dot-folder still refuses a folder upload it would leave out

- Kind: ux
- Found by: 2026-11-14-worker-51369211 (worker), 2026-11-14
- Where: `packages/dokploy/src/dokploy-zip.ts:24`
- What: the folder is listed with `readdirSync(path, { recursive: true })`, which also descends into dot-folders before they are left out, so a dot-folder the owner cannot read (say `.cache/` at mode 000) refuses the whole upload with `cannot be read (EACCES)`, though none of it would be sent. Nothing leaks; the upload is refused where it could go. Inferred from the test of an unreadable sub-folder in `packages/dokploy/test/dokploy.test.ts` (`chmodSync(join(root, "site", "sub"), 0)` refuses with `EACCES`), not run against a dot-folder.
- Suggestion: list the folder one level at a time and skip a dot-named folder without reading it; keep the refusal for an unreadable folder that is not a dot-path.
- Status: open
