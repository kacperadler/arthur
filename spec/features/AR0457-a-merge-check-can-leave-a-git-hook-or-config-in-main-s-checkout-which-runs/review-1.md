# AR0457 - Review 1

- Job: 2026-10-26-review-dd38fc6a
- Branch: arthur/2026-10-26-worker-c3335bc0
- Commit reviewed: 4fd015b329c5ad6d2f939ef5de2564ab591f9433
- Verdict: PASS

## Final message

The branch meets the ticket's Done means, and I found no way left for a merge step to write `.git/hooks`, `.git/config`, `.git/info`, Arthur's home, `arthur.config.ts` or the env file. One related git hole is still open: a step can plant a whole new repository in a subfolder (note 1). It is outside the ticket's literal Done means, so it is a note, not a finding.

## Findings

None that block the merge.

## Notes

1. **A nested repository is still possible.** The ticket's goal is a `core.fsmonitor` that the owner's next git call in this checkout runs outside the sandbox. A step can still plant one in a new repository inside any writable subfolder. In a throwaway repository, a step ran `git init -q packages/core && git -C packages/core config core.fsmonitor "touch …/PWNED"` with exit 0. When I then ran `git status` from `packages/core` outside the sandbox, the planted `touch` ran and `PWNED` appeared. The nested `.git` is untracked, so the `git reset --keep` after a failed check leaves it in place. A `src/.git` file that points to a repository in `$TMPDIR` also wrote with exit 0. Landlock cannot refuse a write by file name, so this needs the mount-namespace route F1 already suggests. It needs a planning ticket.
2. **F1 is acceptable as recorded.** A step can no longer create, rename or remove anything at the top level of main's checkout. That follows from how Landlock works: permission to add files in the checkout's folder would also cover `.git/hooks`. When it bites, the merge fails `Permission denied` and main is reset, so no work is lost. The limit and its fix are in `merge.md`, and the coordinator saw `npm ci` and `npm run check` pass inside a step. Projects whose checks create `dist/`, `coverage/` or `tsconfig.tsbuildinfo` in a clean checkout will now fail the merge until that entry exists. The same applies to the reinstall after a reset, which uses the list of entries read once per merge. Leave F1 open for a planning ticket.
3. **The `.git/index` grant is untested and does nothing for git** (`job-sandbox.ts:132`, `join(own, "index")`). Removing it leaves the new test passing. Git updates the index through `index.lock`, which is refused, so the grant only allows a direct overwrite of `.git/index`. The Done means read "objects, refs, logs, index" as an upper bound, so this does not block.
4. **`.git/objects/info/alternates` is writable** because it sits under the `objects` grant (`echo /tmp > .git/objects/info/alternates`, exit 0). It changes where git looks up objects; it does not run code.

## Checks I ran
- **`npm run check`:** no errors.
- **`node --test packages/core/test/sandbox.test.ts packages/delivery/test/merge-checks.test.ts`:** 16 tests, 12 passed, 0 failed, 4 skipped. The new merge-step test and the merge-checks test both ran; they were not among the skipped.
- **Bypass probes:** a throwaway repository outside the sandbox's temporary folder, `stepSandbox` from this branch. A first run had the repository under `/tmp`, which the sandbox allows, so I redid it with `TMPDIR` moved.

  | Probe | Result |
  |---|---|
  | `echo x > made` (new top-level file) | refused |
  | `ln .git/config src/cfg` | refused, `Invalid cross-device link` |
  | `mv .git/hooks src/hooks` | refused |
  | write `.git/HEAD` | refused |
  | write `.git/hooks/post-commit` | refused |
  | symlink in `.git/logs` pointing to `../hooks`, then write through it | refused |
  | `echo x > src/b` | written |
  | write `objects/info/alternates` | written (note 4) |
  | nested repository and `.git` file | written (note 1) |

- **Mutations of `checkout()`**, each restored with `git checkout -- packages/core/src/job-sandbox.ts`:

  | Mutation | New test |
  |---|---|
  | Keep symlinks | fails |
  | Drop `.git` from the paths kept out | fails |
  | Remove the home-is-the-checkout case | fails |
  | Pass no kept paths | fails |
  | Remove the guard for a missing folder | fails |
  | Add `hooks` to the Git folders allowed | fails |
  | Remove the `index` grant | passes (note 3) |

- **Docs:** `packages/delivery/docs/commands/merge.md` and `docs/deploy.md` say what a step may write, as the Done means ask.
- **Line counts:** `job-sandbox.ts` 141, `plugin-host.ts` 135, `testing.ts` 200, all within the 200-line limit. The core budget raise to 6321 is recorded under AR-D94.
- **Not run by me:** I did not run `npm ci` or the full `npm test`, as you asked. The 1178-test run with 0 failures is the coordinator's.

PASS