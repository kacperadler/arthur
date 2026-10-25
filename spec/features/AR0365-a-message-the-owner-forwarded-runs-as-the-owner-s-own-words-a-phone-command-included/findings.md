# AR0365 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A forwarded file without a caption reaches the coordinator unmarked

- Kind: security
- Found by: 2026-10-25-worker-1423c4c9 (worker), 2026-10-25
- Where: `packages/telegram/src/media-in.ts:36`
- What: the forward mark goes on a forwarded message's text or caption only, as the ticket asks. A forwarded photo, video, voice note or file with no caption becomes its file part alone, with nothing telling the coordinator that someone else made it; a screenshot of instructions or a forwarded voice note reads as the owner's own. Reproduce: push `{ text: undefined, photo: [...], forward_origin: { type: "user", ... } }` to the fake Bot API; `message-received` holds the photo part and no text.
- Suggestion: when a forwarded message has no text or caption, add one text part holding the mark alone (`[forwarded from <sender>]`); costs about 2 source lines in media-in.ts, so it needs a telegram budget raise or a cut. Out: the files themselves stay unread by the channel.
- Status: open
