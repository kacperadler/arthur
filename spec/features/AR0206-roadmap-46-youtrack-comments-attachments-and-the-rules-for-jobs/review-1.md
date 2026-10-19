# AR0206 - Review 1

- Job: 2026-10-19-review-ar0206-youtrack-60dd2d76
- Branch: h/2026-10-19-ar0206-youtrack-285a58cd
- Commit reviewed: 435adbc0a3b081a30d49d58c473d37275f3e1f3a
- Verdict: PASS

## Final message

Findings, notes, checks below.

**Notes (non-blocking)**

- `packages/youtrack/src/youtrack-attachments.ts:22`: the name-sanitizing regex `[/\\\u0000-\u001f\u007f]` has no dedicated test for its NUL/control-character branch. Mutation: stripped that character class down to `[/\\]` (keeping `/` and `\` handling, dropping NUL/control chars) and ran `packages/youtrack/test/youtrack.test.ts` — all 23 tests still passed. Verified it isn't an actual folder-escape (no `/`/`\` involved) and that Node's own `fs` calls already reject embedded NUL bytes (`writeFileSync` throws `ERR_INVALID_ARG_VALUE … without null bytes` independent of the app-level regex), and the command's `text()` wrapper strips the same control-character range before printing. So the mutation doesn't open a real escape or injection path; it's redundant defense-in-depth that happens to be untested. Worth a one-line test for completeness, not a merge blocker.
- No dedicated test for an absolute-path attachment name (e.g. `/etc/passwd`) or a pre-planted symlink at the destination name. Manually confirmed the same regex path (exercised by the existing `../../climb.sh` test) sanitizes `/etc/passwd` → `_etc_passwd` safely. A pre-planted symlink at the target isn't reachable through this feature's threat model: the plugin only ever writes regular files (never creates symlinks), and a job can't write into `.arthur/youtrack/` itself (blocked by the worktree guard), so there's no path for an attacker to plant one before a save runs.

**Checks run**

- `npm ci` — clean.
- `npm run check` — clean, no errors.
- `npm test` — 661/661 passed (full suite, in this worktree, not the main checkout).
- `packages/youtrack/test/youtrack.test.ts` alone — 23/23 passed.
- Mutation tests (throwaway edits, restored with `git checkout --` before verdict, worktree confirmed clean):
  - Removed the `ARTHUR_JOB` write-refusal block in `youtrack-command.ts` → "inside a job, every write to YouTrack is refused" test failed as expected (caught).
  - Removed the "another server" check in `youtrack-attachments.ts` → "an attachment on another server … refuses the whole save" test failed as expected (caught; it instead tried to reach the fake off-server host and got ENOTFOUND).
  - Removed the NUL/control-char portion of the attachment-name regex → no test failed (see note above; confirmed not a real escape via manual check of Node's fs NUL guard and the `text()` output stripper).
  - Confirmed no `DELETE` HTTP method appears anywhere in `youtrack-api.ts`/`youtrack-comments.ts`; comment delete is a POST with `{ deleted: true }`.
- Verified AR0204 (`issue update`/`issue get` `version:` check), AR0205 (coordinator role line + its test in `context.test.ts`), roadmap/README/`arthur.mmd` entry-46-built updates, and the line-budget bookkeeping in `test/structure.test.ts` (464 lines, matches `wc -l packages/youtrack/src/*.ts`).
- Confirmed plugin boundaries: all `packages/youtrack/src/*.ts` imports are either same-package relative imports or `@arthur/core` published exports — no cross-plugin or core-internal imports.
- Confirmed fake-server tests use loopback (`127.0.0.1`), OS-assigned port 0, and `await once(..., "listening"/"close")` — no fixed-time waits.
- Diff scope matches the ticket's Scope section exactly (`packages/youtrack` + docs/tests, orchestration coordinator role, README, `arthur.mmd`, `test/structure.test.ts`); nothing else touched.

All of entry 46's Delivers/Done means, AR0204, and AR0205 are implemented and covered by tests that fail when the behavior is removed (verified by direct mutation on the three highest-risk behaviors named in the review focus). The one coverage gap found (NUL/control-char attachment-name sanitization) is not an actual exploitable escape once checked against Node's own guards and the output sanitizer, so it doesn't rise to a blocking finding.

PASS
