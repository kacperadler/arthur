# AR0467 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. Without a working python3, a read still deletes the clone, with a reason that hides why

- Kind: fix
- Found by: 2026-10-27-review-45bea179 (review), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts:80`
- What: when the `python3 -I` call that reads the attributes fails (not installed, killed, a one-time error), the change time of the `.git` folder counts again, so a step that only ran `git status` in an owner's clone removes it and its history, as before AR0467. The log gives the generic "would run its config outside any sandbox" and does not say python3 failed.
- Status: ticket AR0479

## F2. `-I` on the python3 call has no test

- Kind: test
- Found by: 2026-10-27-review-45bea179 (review), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts:80`
- What: removing `-I` fails no test; the reviewer showed the script imports only `os` and `sys`, so planted modules load either way.
- Status: dropped (no reachable effect: the script loads no planted module without `-I`)

## F3. The python3 call has no time limit

- Kind: fix
- Found by: 2026-10-27-review-45bea179 (review), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts:80`
- What: only a getxattr on a hung FUSE or network folder could block it, which would hang the `lstat` and `readdir` calls beside it too.
- Status: dropped (no new risk: the same folder walk already had no limit)

## F4. `index` is ignored at any depth, and a folder named `index` makes its parent a lock folder

- Kind: chore
- Found by: 2026-10-27-review-45bea179 (review), 2026-10-27
- Where: `packages/delivery/src/merge-checks.ts`
- What: neither an index file nor a folder of that name runs anything; the ticket's Goal allows it.
- Status: dropped (runs nothing, as the review says)
