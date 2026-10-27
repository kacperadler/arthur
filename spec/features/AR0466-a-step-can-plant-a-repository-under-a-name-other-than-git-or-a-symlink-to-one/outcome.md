# AR0466 - Outcome

- Merged: 2026-10-27, `dcef9252`
- Branch: arthur/2026-10-27-worker-cae1ba87
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.17, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/merge-checks.ts`: the sweep after each merge step also removes, with the same one line as a `.git`, a folder below the checkout's top that holds a `HEAD` (Git reads any such folder as a Git folder, whatever its name; not the checkout's top itself) and a symlink that leads outside the checkout or into its `.git`, judged by where it really ends up (a dangling one by its nearest existing folder). Symlinks to a file and to a folder inside the checkout stay, so an install's own links survive. The snapshot before the first step records every symlink, so an owner's link that is unchanged stays whatever its target became.
- `packages/delivery/test/merge-checks.test.ts`: a planted bare repository with `core.fsmonitor` is removed; of six symlinks a step makes, the three that lead out or into `.git` are removed; the owner's bare repository, outward link and file link stay, also after their target is removed or replaced; a `HEAD` at the checkout's top does not make the checkout a repository.
- `packages/delivery/docs/commands/merge.md`: "Checks on main" names the new forms, what stays, and that a link an install makes to a folder outside the checkout is removed.
- `test/structure.test.ts`: delivery's line budget +27 (AR-D159, AR-D160).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1135/1202 passed.

## Left open

- Tickets from findings: AR0490 (F1, with review-2's note on an owner's link to a file a step can write).
- Review notes F2 to F4: dropped (findings.md).
