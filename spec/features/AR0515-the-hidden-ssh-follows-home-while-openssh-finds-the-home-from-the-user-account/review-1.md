# AR0515 - Review 1

- Job: 2026-10-29-review-0af893d9
- Branch: arthur/2026-10-29-worker-f9484a41
- Commit reviewed: 428af081730a1d7eed472f24fb934f1a05d68b13
- Verdict: PASS

## Final message

I found no blocking findings: the branch does what AR0515 asks.

Account home and `$HOME` are both `/home/kacper` on this host. Only the tests that set `HOME` elsewhere make the two differ.

**What the branch does**
- `sshFolders()` in `packages/core/src/job-place.ts:18` returns the `.ssh` in the user account's home (`userInfo().homedir`). It adds `$HOME`'s `.ssh` when that is a different absolute path, and drops duplicates and an empty `$HOME`.
- `hidden()` and `stepSandbox()` in `packages/core/src/job-sandbox.ts` and the `ssh` lines of `guardedPlaces()` all use it. So the `guarded` file names the same folders the sandbox hides, as Done means asks.
- The unit test sets `HOME` to a temporary folder, to the account's home, to the account's home with a trailing `/`, to empty, and unsets it. It checks both `hidden()` and the `guarded` file's `ssh` lines each time.
- The end-to-end test runs with `HOME` elsewhere. It shows that the install, the agent across a continue and a merge step read nothing from the account's real `.ssh`, and that both folders are hidden.
- `spawn.md` is updated. The core budget of 6448 matches the owner decision AR-D295 on main, and the merge commit changes only that one line in `test/structure.test.ts`.

**Notes (not blocking)**
- **Finding F1 is still open** (`packages/core/src/job-place.ts:18`). The worker recorded it in the findings file: `os.userInfo()` throws when the user id has no account entry, as in a container run with `--user <uid>`. Every spawn and merge step would then fail, where before it read `$HOME`. The ticket requires `os.userInfo().homedir`, and the finding is in the findings file, so the merge will turn it into a planning ticket. I could not reproduce it: the worker reports this host refuses the user namespace needed to get such a uid. [INFERENCE] Arthur running as a real login user never hits it.
- **The end-to-end test touches the real `~/.ssh`** of whoever runs it (`packages/core/test/sandbox.test.ts:474`). It only counts the bytes it can read and never copies them, which is the only way to prove the account's folder is hidden, since `userInfo()` cannot be faked. If the sandbox broke, the test would read the real key's bytes but store only their count.
- **Other ways around it:** a `.ssh` reached through a symlink is hidden twice, which is harmless. OpenSSH's other paths (`-F`, `/etc/ssh`) and other credentials belong to AR0513, which the ticket puts out of scope.

**Checks run**
- **`npm ci`**, then `npm run check && npm test` in one call: `npm ci` succeeded and `tsc` reported no errors. The first run's test summary was lost to a filter in my command, so I ran check and test again in one call. That run gave 1275 tests: 1213 passed, 0 failed, 0 cancelled, 62 skipped. This matches the worker's claim. No `limits.test.ts` timing test failed.
- **The two AR0515 tests on the unchanged branch:** both pass. Neither is skipped on this host.
- **Mutations**, each run alone against the two AR0515 tests and restored with `git checkout --`. Every one was caught:

| Mutation | Tests that fail |
|---|---|
| `sshFolders` without the account's `.ssh` | both |
| `sshFolders` without `$HOME`'s `.ssh` | both |
| `.filter(isAbsolute)` removed | unit |
| `Set` (dedup) removed | unit |
| `hidden()` back to `join(homedir(), ".ssh")` | both |
| `stepSandbox` back to `join(homedir(), ".ssh")` | end-to-end |
| `guardedPlaces` `ssh` line back to `join(user, ".ssh")` | unit |

- I first ran three mutations at once by mistake, so they overlapped. I threw those results away, cleaned the tree and ran each again alone; the table shows the solo runs. `git status --short` is empty at the end.

PASS