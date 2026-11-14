# AR0712 - Review 1

- Job: 2026-11-14-review-a7e747b8
- Branch: arthur/2026-11-14-worker-51369211
- Commit reviewed: 156eb7b35e151ad0980844589fa6e79ec5f6a6a6
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0712 asks. A folder upload leaves out every path with a part that starts with a dot. Its `said` line and its refusal end `, leaving out N dot-path files`. A dotfile named by its own path, a ready `.zip`, and a top folder whose own name starts with a dot all go as before. The dot test is decided on the path relative to the folder given, so a dot in a parent folder's name changes nothing.

The ticket's Scope names `packages/dokploy/docs/dokploy.md` for the doc line, but the worker put it in `packages/dokploy/docs/commands/dokploy.md`. Its final message gives the reason: that page holds the upload details, and the one-line summary on the other page is still true. The old sentence "A folder goes as it is, `.env` or `.git` in it included" is removed, and nothing else in the docs or code still says it. The roadmap entry is updated, the files stay green, and the structure test passes on the dokploy line budget.

Ways around the filter I checked: a nested dot-folder (`assets/.cache/`), a symlink inside a dot-folder, names with a dot inside them (`app.env.ts`, `assets/a.b.js`, which are correctly kept), an empty dot-folder, and a folder holding only dot-paths. None gets past it. A file with a token under a name that does not start with a dot still goes, which is what the owner chose (option a).

## Notes
- (minor) packages/dokploy/src/dokploy-zip.ts:26: the count calls everything it leaves out "files". A symlink or FIFO inside a dot-folder is counted as a "dot-path file", so the number can include entries that are not regular files.
- (minor) packages/dokploy/src/dokploy-zip.ts:25: a FIFO or other special file inside a dot-folder is now left out, but no test covers it; only the symlink case is tested. The worker's message says so.
- (minor) packages/dokploy/src/dokploy-zip.ts:7: the comment still says a symlink or special file in the folder "is refused". The next sentence and the new behaviour leave out one that sits inside a dot-folder.

## Checks (all on 156eb7b3)
- `npm run check`: `tsc` clean.
- `npm test`: tests 1849, pass 1785, fail 0, cancelled 0, skipped 64. The structure test passed, and no dokploy file is in yellow.
- `npm run mutate`: 24 mutants, 24 caught, 0 survived.
- Hand mutations, each tested with the `dot` test of `packages/dokploy/test/dokploy.test.ts` and restored with `git checkout`. Each one failed that test (pass 0, fail 1):
  - dot-folders counted as left-out files;
  - the symlink check run on every listed path instead of only the kept ones;
  - the regex cut to `^\.`, so only top-level dot-paths are left out.
- New test on the base: with `dokploy-zip.ts` checked out at `1c76a7f7`, it fails (pass 0, fail 1), and the zip holds `.dev.vars.example`, `.git/config` and `assets/.cache/a.js`. The file was restored afterwards and `git status` is clean.

PASS