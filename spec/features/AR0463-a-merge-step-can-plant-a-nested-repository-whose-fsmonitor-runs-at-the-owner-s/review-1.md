# AR0463 - Review 1

- Job: 2026-10-26-review-38416670
- Branch: arthur/2026-10-26-worker-8e0940d9
- Commit reviewed: f6b07a2842bf42e0be21cbcd298660b4eea69e78
- Verdict: FAIL

## Final message

I reviewed the AR0463 branch at f6b07a28 and it fails on two counts. The sweep keeps a `.git` folder that a step changed in place, which the AR-D101 decision says to remove. And no test covers the folder side of the sweep.

## Findings

1. **`packages/delivery/src/merge-checks.ts:56-61` (`repositories`): a `.git` folder that existed before the first step is never removed after a step changes it in place.** The decision is to remove "every .git a merge step made or changed". The code identifies a folder only by its inode and birth time, so any write inside it goes unnoticed. The step sandbox lets a step write below the checkout's top, and that includes a nested repository's `config`. Only the checkout's own Git folder is closed (`packages/core/src/job-sandbox.ts:118-123`).
   - I ran it with a throwaway `stepRunner` script: a checkout with an owner's clone at `tools/scratch`, then the step `git init -q tools/scratch && git -C tools/scratch config core.fsmonitor "touch …"`. This is the AR0457 reviewer's attack aimed at a folder that already holds a repository.
   - Result: the step exited 0 and the merge printed no `removed` line. A later `git status` in `tools/scratch`, run outside any sandbox, created the `pwned` file.
   - The worker filed this as F2 in `findings.md`, marked `[INFERENCE]` and not run. It is now reproduced. Logging it as an open finding leaves the decided "changed" half of the rule undone, and this is a security ticket.

2. **`packages/delivery/src/merge-checks.ts:61`: replacing the folder's key with a constant (`` `folder` `` instead of `` `folder ${stat.ino} ${stat.birthtimeMs}` ``) still passes all 3 tests in `merge-checks.test.ts`.** No test has a step that replaces or changes a `.git` folder that was there before. Both tests only swap a `.git` file (`vendor/lib/.git`) or plant new folders.
   - The code itself does catch a replacement: `rm -rf tools/scratch/.git && git init -q tools/scratch` was removed with one line in my script. The gap is only in the tests, so removing that behaviour would go unnoticed.

## Notes (not blocking)

- F1 in `findings.md` holds up: a bare repository under another name, set to `core.bare false`, `core.worktree ..` and `core.fsmonitor`, ran its fsmonitor at `git status` (I reproduced this with `pkg/evil`). The Done means only names `.git` folders and files, so this is outside the branch's literal scope, but it is still an open hole in the ticket's goal.
- The budget raise to 1500 matches AR-D103. `merge-checks.ts` is 158 lines. The docs in `merge.md` and `deploy.md` were updated, and the tests use temporary folders only.
- On filesystems that report no birth time (`birthtimeMs` 0), a `.git` folder re-created on a reused inode would get the same key. This filesystem reports birth times, so I could not test that case.

## Checks run

- `npm run check`: tsc passed.
- `node --test packages/delivery/test/merge-checks.test.ts test/structure.test.ts`: 19 pass, 0 fail, 0 skipped. The sandboxed first test did run here.
- Following your instruction, I did not run the full `npm test`; your host run reported 1181 tests, 1175 pass, 0 fail, 6 skipped.
- Mutations on `merge-checks.ts`, each restored with `git checkout --` afterwards (the worktree is clean):

| Mutation | Caught? |
|---|---|
| Before-map skip removed | Yes, 2 fail |
| chmod of unreadable folders in `entries` removed | Yes, 1 fail |
| `chmod -R` in `remove` removed | Yes, 1 fail |
| Parent chmod in `remove` removed | Yes, 1 fail |
| File key without ctime | Yes, 1 fail |
| `folder !== root` dropped | Yes, 1 fail |
| Removal disabled | Yes, 2 fail |
| Folder key made constant | **No, 0 fail** |

- Throwaway bypass scripts in `$TMPDIR`: the in-place config change on an existing clone ran its fsmonitor (finding 1). The bare-repository plant ran its fsmonitor (F1). Replacing an existing `.git` folder was removed by the code.

FAIL