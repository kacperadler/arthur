# AR0515 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A user id with no account entry now fails every spawn and merge step

- Kind: fix
- Found by: 2026-10-29-worker-f9484a41 (worker), 2026-10-29
- Where: `packages/core/src/job-place.ts:18` (`sshFolders`, `os.userInfo()`)
- What: `os.userInfo()` throws a `SystemError` when the process's uid has no passwd entry (Node's docs for `os.userInfo`), as in a container run with `--user <uid>` and `HOME` set. `sshFolders` runs for every job's record (`guardedPlaces`), its sandbox (`hidden`) and each merge step (`stepSandbox`), so there each of them now throws, where before `homedir()` read `$HOME`. Not reproduced: this host refuses a user namespace (`unshare --user --map-user=54321` gives `cannot open /proc/self/uid_map: Permission denied`), the only unprivileged way to get such a uid. OpenSSH itself refuses to run there, `No user exists for uid` (an inference from its source, not run), so `$HOME`'s `.ssh` alone would do.
- Suggestion: catch the `SystemError` of `userInfo()` in `sshFolders` and keep `$HOME`'s `.ssh` alone, with a test that runs under a uid without an account (a user namespace, where the host allows one).
- Status: open
