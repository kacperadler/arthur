# AR0643 - Review 1

- Job: 2026-11-12-review-d55b44c3
- Branch: arthur/2026-11-12-worker-39557d5f
- Commit reviewed: 9a1193bd5e361720f33042793195360176d36e64
- Verdict: FAIL

## Final message

The branch can't merge as it is: its code and tests are sound, but four places in the docs and comments still say plugins register schedule entries only from their own options. The review criteria count that as a FAIL.

## Findings

1. **packages/schedule/docs/commands/schedule.md:5**: stale text. The branch adds the first registered entry that no option makes, `manage.release` with `option: "enabled"`. The worker rewrote line 35 of this file to say plugins also register "those it always makes (manage's release notice)". Line 5 of the same file is the `arthur schedule --help` page, and it still says: "Entries come from the config, from other plugins, which register theirs from their own options, and from the `file` option". The same out-of-date claim is in three more places:
   - **packages/schedule/docs/schedule.md:3**: "from other plugins, which register theirs from their own options (orchestration's morning report, manage's audit and retro)".
   - **docs/setup.md:71**: "`schedule`: … the entries other plugins register from their own options, such as `manage`'s audit".
   - **packages/schedule/src/register.ts:6-7**, a code comment: "The entries another plugin registers from its options … `option`, the path of the plugin's option that makes it". The `enabled` convention the branch adds is not in it.

   The ticket's Scope Out names none of these files. Each one tells a user the schedule shows nothing a plugin makes by default, and a plain `arthur schedule list` now shows `manage.release`.

## Notes
- (risk) packages/manage/src/release-notice.ts:19: `git ls-remote` runs with the inherited environment. Unlike `github-git.ts`'s `quiet()` (`GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`), an origin that asks for credentials can open a prompt on a tty and wait until the 30 s cut. The prompt can't hang forever. Git hides credentials in an HTTPS URL in its error line (tested here on git 2.43), so I saw no secret leak.
- (minor) packages/manage/src/manage.ts:79: `arthur schedule remove manage.release` will say "change or turn off that option in arthur.config.ts" with the option `enabled`. That is accurate only as "turn off manage". The schedule doc's new line 44 covers it.
- (minor) packages/manage/src/release-notice.ts:42,49: four of the five surviving mutants change nothing a user can see, as the worker says: the `HEAD` argument removed, `> 0` changed to `>= 0` or `> -1`, and `core === undefined` deleted, which runs `git -C undefined`, fails and gives the same "not checked" path. The fifth, `|| error.message` dropped on line 21, only matters when git fails with an empty stderr; the tests can't produce that without faking git.

## Checks (all on 9a1193bd)
- `npm run check`: tsc exited 0.
- `npm test`: tests 1802, pass 1738, fail 0, cancelled 0, skipped 64. The structure test passes with `manage: 1597`; no manage file is yellow.
- `npm run mutate`: 82 mutants, 77 caught, 5 survived: release-notice.ts:21 (`|| error.message` dropped), :41 (`if (core === undefined) return` deleted), :42 (`HEAD` dropped), :49 (`> 0` changed to `>= 0`, and to `> -1`).
- `git ls-remote` against origin URLs with `user:s3cr3t@` in them (an unresolvable host, a refused port, a scp-like form): git's error lines did not include the credentials.

FAIL