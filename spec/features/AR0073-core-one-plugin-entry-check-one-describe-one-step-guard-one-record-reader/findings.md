# AR0073 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. `arthur config check` still reports two plugins of one name twice

- Kind: cleanup
- Found by: 2026-10-16-ar0073-core-dedup-and-co-0a7f996f (worker), 2026-10-16
- Where: `packages/core/src/env.ts:50-58`, `packages/core/test/config-check.test.ts:78-81`, `packages/core/test/env.test.ts:126-140`
- What: `[orchestration, telegram, telegram]` prints the host's `plugins[2]: a second plugin named telegram; the first is plugins[1]` and then `checkEnv`'s `ARTHUR_TELEGRAM_ is the prefix of both plugin telegram and plugin telegram`: one mistake, two lines. AR0073 skips only the entries `asPlugin` refuses, since both tests pin the second line and the ticket asks for no behaviour change.
- Suggestion: `checkEnv` also skips a second plugin of a name already seen (one line in its `plugins` filter), and the two tests drop the prefix line for that case; a prefix shared by two different plugins or instances stays refused.
- Status: open
