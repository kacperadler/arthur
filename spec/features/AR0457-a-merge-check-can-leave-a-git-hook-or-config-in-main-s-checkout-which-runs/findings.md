# AR0457 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A merge check cannot make, rename or remove an entry at the top of main's checkout

- Kind: ux
- Found by: 2026-10-26-worker-c3335bc0 (worker), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts` (`checkout`, called by `stepSandbox`)
- What: Landlock only grants, and a right on a folder holds for all beneath it, so a step that may make an entry in the checkout's own folder may also make `.git/hooks/post-commit`. AR0457 therefore grants each top-level entry but `.git` (and Arthur's home, config and env file), not the checkout's folder itself: a check that makes a new top-level folder or file (`dist/`, `coverage/`, `tsconfig.tsbuildinfo`), or removes or renames one, fails with `Permission denied` (seen in a throwaway run: `mkdir dist` and `rm -r src` refused in a step, a write into `src/` passed). The list is read once per merge, so after a failed check's `git reset --keep` the reinstall cannot write a top-level folder the reset brought back. `docs/commands/merge.md` says so and names the remedy (`mkdir dist` once outside a step).
- Suggestion: if a project needs it, run each step in a mount namespace with `.git/config`, `.git/hooks`, `.git/info`, the home and the config bind-mounted read-only (needs unprivileged user namespaces, which some hosts turn off), or let a project's config name the top-level folders the checks make, which `arthur merge` creates before the first step. Out: changing Landlock's model.
- Status: ticket AR0462

## F2. A merge step can plant a nested repository whose fsmonitor runs at the owner's next git call there

- Kind: security
- Found by: 2026-10-26-review-dd38fc6a (reviewer), 2026-10-26
- Where: any writable subfolder of main's checkout (`packages/core/src/job-sandbox.ts`, `checkout`)
- What: the reviewer ran, in a step, `git init -q packages/core && git -C packages/core config core.fsmonitor "touch .../PWNED"` (exit 0); a later `git status` from `packages/core` outside the sandbox ran it. The nested `.git` is untracked, so `git reset --keep` after a failed check leaves it. A `src/.git` file pointing to a repository in `$TMPDIR` also wrote. Landlock cannot refuse a write by file name.
- Suggestion: after each step, remove any untracked `.git` (folder or file) below the checkout's top, or run steps in a mount namespace (F1's route).
- Status: ticket AR0463

## F3. The `.git/index` grant is untested and does nothing for git

- Kind: fix
- Found by: 2026-10-26-review-dd38fc6a (reviewer), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts:132`
- What: git updates the index through `index.lock`, which is refused, so the grant only allows a direct overwrite of `.git/index`; removing it fails no test.
- Suggestion: none.
- Status: dropped (AR-D53: no risk; the Done means named it as an upper bound)

## F4. `.git/objects/info/alternates` is writable under the objects grant

- Kind: security
- Found by: 2026-10-26-review-dd38fc6a (reviewer), 2026-10-26
- Where: `packages/core/src/job-sandbox.ts`
- What: it changes where git looks up objects; it runs no code.
- Suggestion: none.
- Status: dropped (AR-D53: runs no code)
