# AR0342 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The push's refusal prints a credential git names without `://`

- Kind: security
- Found by: 2026-10-25-worker-3de620ca (worker), 2026-10-25
- Where: `packages/github/src/github-git.ts:49`
- What: the push replaces quoted words and `\S+://\S+` in git's line, but git 2.43 does not always print a URL: for a `git://` origin with userinfo it says `fatal: unable to look up arthur:s3cret@127.0.0.1:1 (port 9418) (Name or service not known)` (seen with `git clone --quiet -- git://arthur:s3cret@127.0.0.1:1/acme/shop.git <folder>`), with neither quotes nor `://`, so the credential would reach the push's refusal. The clone's refusal (AR0342) replaces every word holding an `@` instead.
- Suggestion: add `\S*@\S+` to the push's replacement, with a test pushing to such an origin; nothing else changes.
- Status: open
