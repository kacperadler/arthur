# AR0463 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A step can plant a repository under a name other than `.git`, or a symlink to one, which the sweep does not see

- Kind: security
- Found by: 2026-10-26-worker-8e0940d9 (worker), 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts`, `repositories`
- What: Git takes a folder holding `HEAD`, `objects/`, `refs/` and `config` as a repository's Git folder whatever its name, and follows a symlink in the path. A throwaway script (temporary folder, `git init --bare src/cache`, then `core.bare false`, `core.worktree` and `core.fsmonitor` set; and a symlink `src/link` to a repository elsewhere with `core.fsmonitor` set) printed `bare repository in a folder ran fsmonitor: true` for `git -C src/cache status` and `symlink to a repository ran fsmonitor: true` for `cd src/link && git status`. The sweep removes only entries named `.git`, so a step that writes either below the checkout's top still leaves a command for the owner's next git call in that folder.
- Suggestion: run the steps in a mount namespace where the checkout's subfolders are a copy (F1 of AR0457's route), or have the sweep also remove symlinks a step made and folders that hold a `HEAD` file and an `objects` folder; telling the owner to set `safe.bareRepository explicit` in `~/.gitconfig` closes the first case for his own git calls. Out: the `.git` sweep this ticket made.
- Status: ticket AR0466

## F2. A `.git` folder there before the merge keeps what a step writes inside it

- Kind: security
- Found by: 2026-10-26-worker-8e0940d9 (worker), 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts`, `repositories`; `packages/core/src/job-sandbox.ts:120`
- What: the sweep keeps a `.git` folder that was there, the same folder, before the first step (a submodule's from before Git 1.7.8 absorbed them, a clone of the owner's inside the checkout), and the step sandbox lets a step write below the checkout's top, that folder's `config` and `hooks` included. So a step can set `core.fsmonitor` in such a folder's `config` in place, and the owner's next git call there runs it. [INFERENCE] from the sandbox's rule (job-sandbox.ts:120-123: only the checkout's own Git folder is closed); not run.
- Suggestion: close every `.git` folder below the top that is there before the first step as the checkout's own is closed (writable only in `objects`, `refs`, `logs` and `index`), in `checkout` of job-sandbox.ts, which reads its entries once before the first step anyway.
- Status: fixed in ff559ccc

## F3. A check that runs git inside an owner's clone deletes that clone's `.git`, history included

- Kind: security
- Found by: AR0463's reviews, 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts` (review-2 note 6 and the worker)
- Status: ticket AR0467

## F4. On a filesystem without birth times, a `.git` re-created on a reused inode keeps its key

- Kind: security
- Found by: AR0463's reviews, 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts` (review-1 note 3)
- Status: fixed in ff559ccc (the stamp no longer uses birth time)

## F5. Without a systemd scope, a step's background process can plant a `.git` after the sweep

- Kind: security
- Found by: AR0463's reviews, 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts` (review-2 note 1)
- Status: dropped (only in the bare case, which already prints that what a step leaves is not killed; this host makes a scope)

## F6. A clone with an unreadable folder inside its `.git` before the merge keeps a step's change

- Kind: security
- Found by: AR0463's reviews, 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts` (review-2 note 2)
- Status: dropped (needs the owner's own unreadable folder there first; rare)

## F7. The tests do not catch removing `ino` from the stamp or changing the unreadable constant, nor a symlink named `.git`

- Kind: security
- Found by: AR0463's reviews, 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts` (review-2 notes 3 and 4)
- Status: dropped (the reviewer's own judgement: the change time catches every replacement, and a symlink takes the tested file path)

## F8. The sweep adds the owner's own permission bits to unreadable folders and to a removed `.git`'s parent

- Kind: security
- Found by: AR0463's reviews, 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts` (review-2 note 5)
- Status: dropped (it only adds the owner's own bits, on his own folders)
