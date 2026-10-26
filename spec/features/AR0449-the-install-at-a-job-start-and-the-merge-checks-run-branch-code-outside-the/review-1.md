# AR0449 - Review 1

- Job: 2026-10-26-review-47ad9a71
- Branch: arthur/2026-10-26-worker-bed8b28b
- Commit reviewed: f719e659ee12757402a32eb954b9fa4a7c5d008d
- Verdict: PASS

## Final message

No blocking findings. The branch meets every Done means point. Both new tests run under Landlock here and fail when I remove what they protect. The worker's claims match what I see.

**Findings (non-blocking, worth a findings.md entry)**

1. **A merge check can leave a git hook behind in main's checkout.** `packages/core/src/job-sandbox.ts:114` (`stepSandbox`) makes all of main's checkout writable (`root`, from `merge-command.ts:124`), and that includes its `.git/hooks` and `.git/config`. The agent's sandbox writes only the objects, refs and logs of `.git`, not its config or hooks. I ran a throwaway script: inside a step sandbox that was set up (no `no sandbox:` line), a step wrote `.git/hooks/post-commit` and set `core.fsmonitor`, exit 0, and both were still there afterwards. `git reset --keep` after a failed check does not undo them. The owner's next own `git status` or `git commit` in that checkout then runs the planted code outside any sandbox, where it can read `arthur run`'s environment and the env file.
   - It matches the ticket's literal "writable only in the merge's worktree", it is no worse than the unsandboxed steps before this branch, and `docs/deploy.md` already accepts that a job can write the Git config, guarding only Arthur's own git calls. So it is not a FAIL, but it falls short of the "same sandbox the agent gets" in the Description.
   - Where `core.home` or `arthur.config.ts` sit inside the checkout (Arthur merging into itself), the step can write those too.
2. **The install can switch off the agent's env-file hiding.** At `packages/core/src/wrapper.ts:123` the install's writable paths include the job record (`writable(folder, …)`). The agent's sandbox re-reads `hidden(folder)`, which comes from the record's `guarded` file, after the install (`wrapper.ts:128`). An install lifecycle script that removes the `env /…` line from `guarded` leaves the env file readable to the agent and to every tool call the job runs afterwards (for example a dependency's code during `npm test`).
   - The agent could already do this across a `continue`, and the unsandboxed install before this branch could read the file directly, so it is not a regression.
   - Simple fixes: compute `hidden(folder)` once before the install and reuse it, or leave the record out of the install's writable paths. I did not run this one; it follows from the two lines above.

**Notes**
- The scope path at `merge-checks.ts:33` (`...sandbox(command).flat()`) could not run in my checkout: `systemd-run` fails there, so stepRunner fell back to bare steps, and only that path ran. The owner's host run covers the scope path.
- Findings F1 to F3, which the worker recorded (shared caches carry code out of the sandbox, a missing cache stays closed, the agent's own `npm ci` cannot write `~/.npm`), are accurate and open.
- `packages/core/test/sandbox.test.ts` is 384 lines, but it is a test file and was already over 200 before this branch.

**Checks run**
- `npm run check` (`tsc`): no errors.
- `merge-checks.test.ts`: 1 pass, 0 fail, 0 skipped. Landlock was active, not skipped.
- `sandbox.test.ts`, filtered to the install, plugin-sandbox and runner-environment tests: 3 pass, 0 fail, 0 skipped.
- I did not run the full suite, as you asked; I relied on your host results.
- Source files touched: `wrapper.ts` is 200 lines, the others are 135 or fewer.

**Mutations** (each run alone, then restored with `git checkout`; the tree is clean):

| Mutation | Result |
|---|---|
| Install runs bare: `(command) => ["sh", ["-c", command]]` in `wrapper.ts:123` | install test fails |
| Install hides nothing: `hidden(folder)` → `[]` | install test fails |
| Install loses the caches: `...caches()` dropped | install test fails |
| Merge step runs bare `sh -c` in both branches of `merge-checks.ts` | merge-checks test fails |
| Step sandbox hides nothing: `[envFile]` → `[]` | merge-checks test fails |
| Step sandbox passes every line to `note`, not only `no sandbox:` lines | merge-checks test fails (an extra line in the merge output) |

PASS