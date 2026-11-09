# AR0513 - Review 1

- Job: 2026-11-09-review-32655a3c
- Branch: arthur/2026-11-09-worker-a8a24a62
- Commit reviewed: 5a411c70433669295c193e157eb173b9898414b6
- Verdict: PASS

## Final message

No blocking findings. The branch meets every point of the ticket's Done means. `unread()` in `packages/core/src/job-sandbox.ts:124-125` hides these, in the account's home and in `$HOME`, whether they exist or not:
- `~/.git-credentials`
- `~/.config/git/credentials`
- `~/.config/gh`
- `$XDG_CONFIG_HOME/git/credentials`
- `$XDG_CONFIG_HOME/gh`
- `$GH_CONFIG_DIR`

Both `hidden()` (a job's install and agent) and `stepSandbox()` (merge checks) use the list. The final message explains why the merge checks are included: they run the branch's code. `docs/deploy.md:48` names the hidden stores and what stays readable (a key an `IdentityFile` names outside `~/.ssh`), and says to keep no such credential for Arthur's user. The other docs that listed what the sandbox hides were updated too (`spawn.md`, `merge.md`, `plugin-api.md`, the `Host.sandbox` comment). A search found none still giving the old list.

`job-sandbox.ts` goes from 189 to 194 physical lines and stays yellow at 214 counted lines. The final message gives a reason: it was already yellow, and the new list sits beside its two callers. The core line budget goes from 7438 to 7444. That is not a red file, so no Decisions entry is needed; the raise shows in outcome.md.

## Notes
- (security) packages/core/src/job-sandbox.ts:125: `~/.netrc` is not hidden. [INFERENCE] Git's HTTPS transport (libcurl, netrc optional) reads it, and so does `curl`, so a token there still lets a job push. The `deploy.md` advice to keep no credential elsewhere covers it, but the line could name it.
- (risk) packages/core/src/job-sandbox.ts:125: other stores stay readable, and `deploy.md:48` only covers them as "a token in a file of your own": Git Credential Manager's plaintext store (`~/.gcm/store`), `hub`'s `~/.config/hub`, a token in a remote URL in a main checkout's `.git/config`, or an inline helper in `~/.gitconfig`.
- (minor) packages/core/src/job-sandbox.ts:125: `$GH_CONFIG_DIR` and `$XDG_CONFIG_HOME` are hidden whole without the `holds(…, kept/own)` check, as `~/.ssh` already is. A value that holds the job's worktree, record or `~/.omp` would break the job, not leak anything.
- (minor) packages/core/test/sandbox.test.ts:635-636: the sandboxed run reads the real account's credential stores. It only counts bytes and expects 0, the same pattern as the existing AR0508 `account-read` test.

## Checks (on 5a411c70)
- **`npm run check && npm test`:** tsc clean; 1656 tests, 1592 pass, 0 fail, 64 skipped.
- **The AR0513 tests and the two AR0593 sandbox tests alone:** 11 pass, 0 skipped, so the real-sandbox test ran here.
- **`npm run mutate`:** 25 mutants, 25 caught, 0 survived.
- **Hand mutations of `unread`** (sed, AR0513 tests, `git checkout --`): each one makes tests fail.

  | Mutation | Fail / pass |
  |---|---|
  | `.git-credentials` removed | 9 / 0 |
  | `.config/git/credentials` removed | 9 / 0 |
  | `.config/gh` removed | 8 / 1 (the real-sandbox test shows `~/.config/gh/hosts.yml read`) |
  | `$XDG_CONFIG_HOME/git/credentials` removed | 4 / 5 |
  | `$XDG_CONFIG_HOME/gh` removed | 4 / 5 |
  | `$GH_CONFIG_DIR` removed | 4 / 5 |
  | `stepSandbox` back to `sshFolders()` | 1 / 8 |
  | `isAbsolute` filter removed | 6 / 3 |

  `git status` was clean afterwards.
- **Store created after the sandbox started** (throwaway smoke, temporary `HOME`): `cat ~/.git-credentials` and `cat ~/.config/gh/hosts.yml`, both made by the parent 200 ms after the start, gave `Permission denied`.
- **End-to-end smoke:** `git -c credential.helper=store credential fill`, with a temporary `HOME` holding a fake `.git-credentials`, exits 0 outside the sandbox with username and password. Inside `stepSandbox` it exits 128 with `could not read Username for 'https://example.com'`.
- **`node --test test/structure.test.ts`:** `packages/core/src/job-sandbox.ts: 214 lines, yellow (over 200)`; the test passes.
- **`npx arthur spawn --help`:** prints the new "Nor can Git's and `gh`'s stored credentials…" sentence and `<the credential stores above>`.

PASS