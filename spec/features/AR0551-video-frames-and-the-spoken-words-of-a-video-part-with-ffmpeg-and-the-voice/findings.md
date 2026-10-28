# AR0551 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A video's frames stay in .arthur/video/ forever

- Kind: chore
- Found by: 2026-10-28-worker-b14d6e94 (worker), 2026-10-28
- Where: `packages/video/src/video.ts:41`
- What: each video gets a folder `.arthur/video/<uuid>/` of up to `maxFrames` PNG files, kept for the coordinator to open, as the ticket asks. Nothing ever removes them, so the folder grows with every video the owner sends. Reproduce: send two videos; both folders stay after the coordinator's turn and after a restart.
- Suggestion: the video plugin removes, at `start`, its own folders older than a number of days (an option such as `keepDays`), or answers manage's daily prune through a provided name; the frames of the current conversation stay.
- Status: open

## F2. With maxFrames reached, the end of a long video has no frame

- Kind: ux
- Found by: 2026-10-28-worker-b14d6e94 (worker), 2026-10-28
- Where: `packages/video/src/ffmpeg.ts:29`
- What: ffmpeg keeps the first `maxFrames` frames in time (`-frames:v`), as the ticket says. At the defaults (a frame every 5 s, at most 12) a video longer than about a minute shows the coordinator only its first minute; a 10-minute screen recording's last 9 minutes have no frame. Reproduce: a 120-s video gives frames at 0 to 55 s only (`packages/video/test/video.test.ts`, the test "other kinds of part ... at its default" asserts the 12).
- Suggestion: widen the step to `max(everySeconds, seconds / maxFrames)` once the length is known, so the frames spread over the whole video; scene changes stay as they are.
- Status: open
