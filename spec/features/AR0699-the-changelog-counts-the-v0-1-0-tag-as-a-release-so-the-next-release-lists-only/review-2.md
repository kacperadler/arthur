# AR0699 - Review 2

- Job: 2026-11-16-review-0f587a25
- Branch: arthur/2026-11-13-worker-c147cfc8
- Commit reviewed: d5b8d200bac31c1d0406cb2c6f1ba94d241d7847
- Verdict: FAIL

## Final message

**Findings**

1. **`packages/delivery/src/changelog.ts:131-135` (`fetchTags`): when the merge runs in a terminal, the fetch can still prompt.** This contradicts the branch's own claim.
   - **What the branch claims.** The worker's "What went in" says the fetch runs "with no prompt". The new `docs/commands/changelog.md` "Releases" line says "it runs no prompt, askpass, hook or fsmonitor". The code comment points to `github-git.ts` as its model.
   - **What the code does.** The env guards are there: `GIT_TERMINAL_PROMPT=0`, empty `GIT_ASKPASS`, `SSH_ASKPASS_REQUIRE=never`. But `spawnSync` keeps git in the merge's own session, with its controlling terminal. github's `gitAway` runs `detached: true` for exactly this reason: "in a session of its own with no terminal to ask on". So ssh, which git runs for a `git@…` origin, can still open `/dev/tty` and ask there.
   - **Reproduced with a throwaway probe:**
     - Setup: origin `git@example.invalid:acme/shop.git`, and `GIT_SSH_COMMAND` set to a script that opens `/dev/tty` and reads a passphrase from it.
     - Under `script` (a pty): the script got the tty, printed `Enter passphrase for key: ` and waited. `writeChangelog(..., true)` returned after 60081 ms with `tags not fetched from origin: timed out after 60 s`.
     - Under `setsid -w`: the script logged `notty` and the call returned in 23 ms.
   - **Why it matters.** Real ssh asks on `/dev/tty` the same way, for an unknown host key or a key passphrase [INFERENCE: not run against a real sshd]. Arthur's own origin is reached over ssh: `spec/quality/2026-11-13.md:18` records `git ls-remote` failing on host key verification. So a merge started from a terminal can stop at a stray prompt for up to 60 s, and the documented "no prompt" does not hold.
   - **Fix.** Give the fetch a session of its own, as github does: either `setsid --wait git …` or an async `spawn` with `detached: true`. Add a test under a pty that fails without it.

## Notes
- (risk) `packages/delivery/src/changelog.ts:138`: no test reaches the `timed out after 60 s` branch. `npm run mutate` leaves `FETCH_MS / 999` and `/ 1001` alive. The probe above is the only run of that path.
- (minor) `packages/delivery/src/changelog.ts:138`: `ran.error` is not only a timeout. It is also set for `ENOBUFS` (stderr over `maxBuffer`) or a missing `git`, and those are still reported as `timed out after 60 s`.
- (minor) `packages/delivery/src/changelog.ts:111`: `%(*objectname)` peels one level only. A tag of an annotated tag is skipped, not counted as a release.

## Checks (on d5b8d200)
- **`npm run mutate`, two calls.**
  - First call: 91 mutants, 87 caught, 4 survived, 9 not run (time), 10 not run (--max 100).
  - Second call: 100 mutants, 95 caught, 5 survived, 10 not run (--max 100).
  - Survivors:
    - `merge-command.ts:165` cut to `ticket === undefined`, and to `folder === undefined`. Both are equivalent: the two values are set together.
    - `changelog.ts:138` `FETCH_MS / 999`, and `/ 1001`.
    - `changelog.ts:132` `core.fsmonitor=true`, which is equivalent on Linux.
- **Hand mutations** on `changelog-fetch.test.ts` + `changelog.test.ts`. Each was caught (1 fail of 9) and restored with `git checkout --`:
  - `.filter(Boolean)` on the `package.json` log removed;
  - `--sort=v:refname`;
  - `GIT_TERMINAL_PROMPT` removed;
  - `--no-prune` removed;
  - `|| each.at === at` removed.
- **`npm run check`:** tsc passed.
- **`npm test`, run twice.**
  - First run: its counts were lost to a grep. The structure test passed, and `merge-command.ts` is at 220, yellow, which it already was at the base.
  - Second run: 1872 tests, 1807 pass, 1 fail, 0 cancelled, 64 skipped. The failure is `models.test.ts` "a job on a provider model gets the provider…", a file the diff does not touch. Run alone, that file gave 21 tests, 21 pass, 0 fail, so it does not count against the branch.
- **tty probe** (throwaway file in `packages/delivery/test/` and a temp folder in `/tmp`, both removed): results as in finding 1. The checkout is clean.

FAIL