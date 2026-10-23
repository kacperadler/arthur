# AR0370 - Review 1

- Job: 2026-10-23-review-ar0370-home-umask-0336d94d
- Branch: h/2026-10-23-ar0370-home-umask-acf62907
- Commit reviewed: 40d4226d02a29efe4e3bc384ea52080ac1f0075b
- Verdict: PASS

## Final message

- `npm ci`: ok.
- `npm run check`: `tsc` clean, no errors.
- `npm test`: 1069/1069 pass.
- Mutation M2 (literal `chmodSync(home, 0o700)` per ticket text instead of masked): reproduced the exact break the worker described — `arthur run with a home it cannot write: the refusal is printed only` fails because the read-only home becomes writable.
- Mutation M8 (`ownHome` call removed from `host.ts` `loadPlugins`): reproduced the exact break the worker described — the new host umask test fails (home stays `0755`/493 instead of `0700`/448... wait mode comparison showed 493 vs 448 decimal = 0755 vs 0700 octal).
- `ownHome("/tmp")` (root-owned) throws `EPERM`, matching `doctor.md`'s updated line and `requirements.ts`'s catch-and-report behavior.
- Diff scope: only `packages/core/`, `docs/setup.md`, `test/structure.test.ts` touched — no plugin boundary crossed.
- File sizes: all changed/new files ≤155 lines, well under the 200-line cap; no new runtime deps, no class/enum.
- Ticket's Decisions (as held by `main`) explicitly record all three items the worker flagged for confirmation (masked chmod, `host.ts` call, budget 5889→5905): branch matches those decisions exactly.
- Docs (`setup.md` `UMask=0077`, `doctor.md`, `remote-job.md`) updated accurately and consistent with code behavior verified above.

PASS
