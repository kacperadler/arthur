# AR0124 - Review 1

- Job: 2026-10-18-review-ar0124-machines-l-55254714
- Branch: h/2026-10-18-ar0124-machines-list-56a82238
- Commit reviewed: cd49e166779a7544c3783474d6495c6e26b97be5
- Verdict: PASS

## Final message

Clean. All verification complete.

**Findings:** none blocking.

**Notes (non-blocking):**
- `publicAddress`'s `ssh -G` call (`machine-check.ts:27`) has no `limitSeconds` passed to `host.jobs.run`; if `ssh -G` itself hung, the child would leak past the outer `within()` race (which only abandons the promise, doesn't kill it). `ssh -G` does no network I/O (pure local config evaluation), so this is not practically reachable; not tested, but low-risk and outside the ticket's named edge cases.
- DNS for `ssh -G`'s printed hostname is re-resolved independently at load and at each check round (not cached), so a rebind between load and connect is only a few-second window before the next round catches it offline; acceptable for a config-safety check, not an adversarial boundary per the ticket's wording ("Arthur reaches its machines only over the private network").

**Checks run:**
- `npm ci`: 8 packages added, clean.
- `npm run check`: `tsc` exits 0.
- `npm test`: 405/405 pass (matches worker's claim), ~225s.
- Boundary: `packages/machines/package.json` has no `dependencies`, exports only `.` → `src/machines.ts`; all imports are `@arthur/core` / `@arthur/core/plugin` published exports only, no plugin-to-plugin or core-internal-by-path imports. `structure.test.ts` boundary/budget tests pass (`machines: 280`, actual src 267 lines via `wc -l`).
- Mutation tests (throwaway edits, all restored, `git status --short` clean afterward):
  - Disabled the public-address-at-load refusal (`if (false && refused.length > 0)`) → test "a machine whose ssh resolves to a public address is refused at load…" fails as expected.
  - Removed the once-per-change dedup (`told.get(name) === report.online`) → "at start every machine is checked and told once…" fails with duplicate events, as expected.
  - Dropped `limitSeconds` passed from `checkMachine` into `host.jobs.run` → "ten machines that hang cost one check of 10 s, each cut and its ssh killed" times out waiting for ssh processes to die, as expected.
  - Disabled the labels-mismatch branch in `checkMachine` → "each way a machine is offline…" fails (mac reported `ok` instead of `missing: its labels say…`), as expected.
  - Disabled the core's `execute()` timeout kill (`job-machine.ts`) → new core test "jobs.run past limitSeconds kills the command…" fails (command finishes normally instead of being killed), as expected.
- Confirmed ssh invocation always carries `-o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10` (pre-existing core constant, reused correctly; asserted directly in the new machines tests via regex on `ssh.log`).
- Confirmed tests use only a fake `ssh` script on `PATH` with a per-test temp folder (`temporaryFolder()`), never a real host; no production resource names used.
- Spot-checked docs/README/`arthur.mmd`/`arthur.config.example.ts` consistency with the implementation; all match.
- F1 in `findings.md` is correctly scoped (roadmap text vs. deploy.md divergence), filed `open`, non-blocking, doesn't contradict any ticket Decision.
- Worker's final message claims (test counts, commands, smoke behavior, commit list) all match what's observed in the diff and test run.

PASS
