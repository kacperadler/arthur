# AR0388 - Review 1

- Job: 2026-10-27-review-00b1a106
- Branch: arthur/2026-10-27-worker-d82779fe
- Commit reviewed: 002688f5135a6fd129bcc627bb31dea3979a8377
- Verdict: PASS

## Final message

No findings. The branch adds the `$XDG_CONFIG_HOME/systemd` guard line that the ticket asks for, and the tests catch both mutations I tried.

**What the change does (`packages/core/src/job-place.ts:22-26`):** `guardedPlaces` now adds a second `systemd` line for `$XDG_CONFIG_HOME/systemd`, next to the existing `gitxdg` line, whenever `XDG_CONFIG_HOME` is set. A `Set` removes the extra lines when `XDG_CONFIG_HOME` points at `~/.config`, so a line appears only when the path differs, as the ticket asks. A relative `XDG_CONFIG_HOME` gives a relative path, which the existing `isAbsolute` check in `guarded()` already drops. The file is 81 lines.

**Tests (`packages/core/test/worktree-guard.test.ts:703-704, 717-721`):** with `XDG_CONFIG_HOME` set, the test checks that both a `write` and a `bash cp` into `$XDG_CONFIG_HOME/systemd/user` are refused as "the user's systemd folder". It also checks the exact `systemd`/`gitxdg` lines for five values: the variable set elsewhere, empty, equal to `~/.config`, `~/.config/`, and unset.

**Docs:** `docs/deploy.md:35` and `packages/core/docs/commands/spawn.md:20` both mention the new guarded place.

**Line budget:** core goes from 6325 to 6328 (`test/structure.test.ts:746`). That matches the +7 −4 on `job-place.ts`, and the ticket's 2026-10-27 decision pre-approves raising the budget by what the fix needs.

## Notes
- The budget comment cites AR-D117, but the ticket's decision cites AR-D63. The raise is covered either way.

## Checks run
- `npm run check` (`tsc`): no errors.
- `node --test packages/core/test/worktree-guard.test.ts`: 11 pass, 0 fail.
- **Mutation 1:** I removed the `["systemd", join(xdg, "systemd")]` entry. The test failed (10 pass, 1 fail) because the write to `$XDG_CONFIG_HOME/systemd/user/arthur.service` was no longer refused. Restored.
- **Mutation 2:** I removed the `Set` that drops duplicate lines. The test failed (10 pass, 1 fail) at `XDG_CONFIG_HOME=<home>/.config`. Restored, and `git status` is clean.
- As you instructed, I did not run the full suite. Your host run covers it: on the tip, the structure and develop tests pass (52 pass, 0 fail).

PASS