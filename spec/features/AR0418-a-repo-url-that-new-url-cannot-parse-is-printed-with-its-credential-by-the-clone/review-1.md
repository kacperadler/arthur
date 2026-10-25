# AR0418 - Review 1

- Job: 2026-10-25-review-d95ffa7a
- Branch: arthur/2026-10-25-worker-12f4ff21
- Commit reviewed: d454f79b70076c2910c505dd33b1f527ccfd2e34
- Verdict: FAIL

## Final message

The branch fixes the ticket's own example but still prints a credential in one case, and that blocks the merge.

## Findings

1. **`packages/projects/src/clone.ts:27`: a password containing a space still gets printed.** The new mask is `url.replace(/\/\/[^/\s]*@/, "//")`. Because `\s` is excluded, the match stops at the first space. When a URL fails to parse and its userinfo holds a space, the `@` is never reached and nothing is removed. I called `projectFolder` directly with the repo `https://u:my pass@host:99999/x.git` and got:
   `project bad: git clone https://u:my pass@host:99999/x.git failed: fatal: unable to access 'https://host:99999/x.git/': URL rejected: …`
   Git's own part of the line strips `u:my pass`, so Git reads it as userinfo, the credential it would send. Yet our refusal prints it whole. This breaks the ticket's Goal ("never prints a credential from `repo`, parsed or not") and its Done means ("a URL that does not parse has only its userinfo after `//` removed"). It also meets the review criterion "a value printed in an error". The ticket's own examples already count an unparsable URL with a space in scope (`exa mple.com`). The likely fix is `[^/]*@`: in my mutation run it passed the same test, so the `git@` row did not need `\s` excluded.
2. **`packages/projects/test/projects.test.ts:134-139`: no test has whitespace in the userinfo.** Widening or narrowing the class is not caught: changing `[^/\s]*@` to `[^/]*@` still passes. A row like `https://u:my pass@host:99999/x.git` would pin the fix from finding 1.

## Notes

- `shown("git@host:a//b@c")` gives `git@host:a//c`. The regex also matches a `//…@` inside an scp-style path, which changes the printed path. It does not leak anything.
- `https://u:a/b@host:99999/x` is printed as it is. A raw `/` ends the authority for both Git and `new URL`, so `a/b` is not userinfo there.
- The rest of the worker's claims match: the diff is `clone.ts` 2 lines plus 11 test lines, and the `git@` row expects the exact message.

## Checks

- `npm ci`: added 22 packages.
- `npm run check` (`tsc`): no errors.
- `timeout 900 npm test`: 1108 tests, 1050 pass, 0 fail, 58 skipped.
- Mutations, each run with `--test-name-pattern="credential"` on `projects.test.ts`:
  - Unparsable branch set back to `: url`: caught (unparsable row fails).
  - `shown` masking with `\S*@\S+` → `the repo`: caught (unparsable row fails first).
  - `[^/\s]*@` changed to `[^/\s:]*@`: caught.
  - `[^/\s]*@` changed to `[^/]*@`: not caught, 1 pass (see finding 2).
- Probe with `node -e` on `shown` with 11 inputs: the space-in-password input leaks, the others are as described above.
- Probe through `projectFolder` with the space-in-password repo: the leak is confirmed in the real refusal (quoted in finding 1).
- `clone.ts` was restored with `git checkout --` after each mutation; `git status` is clean at `d454f79b`.

FAIL