# AR0467 - Review 2

- Job: 2026-10-27-review-45bea179
- Branch: arthur/2026-10-27-worker-bdb8c92f
- Commit reviewed: 636a20210725c437a65c5fb07aa8e55146cb614e
- Verdict: PASS

## Final message

**Findings**

None block the merge. The branch meets the ticket's Done means. A merge step that runs `git status` or `git log` in the owner's clones (including a split index and a linked worktree) keeps them and their history. A step that writes a hook or `core.fsmonitor` there still gets that `.git` removed. Both cases are tested in `packages/delivery/test/merge-checks.test.ts`.

**The python3 attribute call (`packages/delivery/src/merge-checks.ts:80`)**

- **Trust.** `python3` is found on Arthur's own PATH, and the call passes no env and no cwd, so it runs with Arthur's process environment. No step can change either. The core's job sandbox (`packages/core/src/job-sandbox.ts:91`) starts python3 the same way, so this adds no new trust. The paths passed are absolute and below a `.git` that `lstat` showed is a real folder. The recursive `readdirSync` does not follow symlinks, so no lock path points through one.
- **What `-I` adds.** It is extra protection that no step can currently get around. No test fails when it is removed (mutation M3 below). I checked whether a planted file could matter without it: in a temporary folder holding `os.py`, `sitecustomize.py`, `usercustomize.py` and an `encodings/` folder, the exact `ATTRIBUTES` script run without `-I` loaded none of them. It printed `/tmp/rv-pyI.… []` and exited 0. The script imports only `os` and `sys`, which Python has already loaded at startup. That makes the untested `-I` a note, not a finding.
- **Time limit.** The call has none, while the step itself has `limitSeconds`. The only ways it could hang are a `getxattr` on a FUSE or network folder. Those would hang the `lstatSync` and `readdirSync` calls in the same function too, and those already had no limit. The other housekeeping calls in this file (`chmod`, `systemctl stop`) have no limit either. This is not a new risk.
- **When it fails.** If python3 exits with any other status than 0 (not installed, killed, an output above the 1 MiB default buffer, an argument list too long, an attribute that disappears while it reads), `held` is empty. Every folder's change time then counts again and the attribute output is left out. Every way it can fail ends with the clone removed, never with an ACL or `chgrp` missed. A step can only make the second reading fail, because the first one is taken once, before the first step. The test with a failing `python3` first on Arthur's PATH covers this, and mutation M1 below proves it does.

**Notes**

- On a host without a working python3, a step that only reads a clone with git removes it again, as before AR0467. The log line still gives the generic reason ("would run its config outside any sandbox") and does not say python3 was missing. `merge.md` step 2 documents this. A python3 failure that happens only once would also remove a clone that was only read: no security risk, but its history is lost.
- `index` at any depth is ignored, and a folder named `index` also makes its parent a lock folder. Neither can run anything; the ticket's Goal allows this.
- The `chgrp` test is skipped for a user in only one group. It ran here (groups `1000 4 24 …`).
- Budget: `cat packages/delivery/src/*.ts | wc -l` prints 1564, which matches `test/structure.test.ts` and AR-D148 on main.

**Checks**

- `npm run check`: `tsc` exited clean.
- `node --test test/structure.test.ts packages/delivery/test/merge-checks.test.ts`: 25 tests, 25 pass, 0 fail, 0 skipped. This matches the worker's claim. I did not run the full `npm test`, as you asked.
- I ran each mutation against `merge-checks.test.ts` and restored the file after each one with `git checkout --`. `git status --short` is empty at the end.

| Mutation | Result |
|---|---|
| M1: lock folders exempt even when python3 fails (`new Set(locks)`) | caught by test 9 (python3 fallback) |
| M2: python3's attribute output left out of the fingerprint | caught by test 7 (ACL) |
| M3: `-I` removed | no test fails; I showed above it can't be exploited |
| M4: the change-time exemption removed | caught by test 6 (git read keeps the clone) |
| M5: owner and group left out of the fingerprint | caught by test 8 (`chgrp`) |

PASS