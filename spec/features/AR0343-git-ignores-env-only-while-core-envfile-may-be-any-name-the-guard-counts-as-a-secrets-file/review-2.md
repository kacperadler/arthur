# AR0343 - Review 2

- Job: 2026-10-27-review-8456ad9f
- Branch: arthur/2026-10-27-worker-2a49ca52
- Commit reviewed: ebc807b2c1b80a954827062a52882fcac5d87a34
- Verdict: PASS

## Final message

**Findings:** none. Round 2 fixes the review-1 finding: the new test catches the mutation, and both checks I ran pass.

**Round 2 (`ebc807b2`)**
- `packages/core/test/doctor.test.ts:226-240` adds a new test, "the env file's own folder decides whether it lies in a Git checkout, not the folder arthur runs in". It calls `coreRequirements` and `doctor` directly. With `process.chdir` it covers both directions:
  - Arthur runs in a plain folder and the env file sits in a Git repository: the line is `missing: … lies in the Git checkout <repo>, …`.
  - Arthur runs inside a repository and the env file is outside every checkout: the line is `ok`.
- `t.after` puts the working directory back.
- The core-requirements test has a new title (`doctor.test.ts:138`). Its old title called the env file's place not critical, which the new critical `env ignored` line made wrong.

**The ticket, checked against the code from round 1**
- `packages/core/src/requirements.ts:100-113` has the critical `env ignored` requirement. It runs `git -C <dirname> rev-parse --show-toplevel` and then `check-ignore -q -- <basename>`. Passing `--` means a file name that starts with `-` cannot be read as an option. If `check-ignore` fails with a fatal error (exit 128), the line reports `missing`, so it fails closed.
- `.gitignore` now has `.env.*`.
- Ticket decision AR-D116 says `arthur run` must refuse to start while the env file is in a Git checkout that does not ignore it. That holds because the requirement is critical: `printAtStart` (`doctor.ts:75-80`) refuses the start on any critical miss.
- The `doctor.test.ts` test the ticket asks for is there (`:200`). It covers an `env` file that is not ignored, one that is, a `.gitignore` that ignores only `.env`, a file Git already tracks, a subfolder, and a file outside any checkout.

**Notes (not blocking)**
- If the env file's folder does not exist yet, the line is `ok`. The worker reported this and left it as it is; the next `doctor` or `run` checks again.
- You asked me to run only the two test files, so I did not run `npm run check`. Your host run of `npm test` on `4e0cfb23` gave 1180 pass, 0 fail, 6 skipped.

**Checks I ran**
- `node --test packages/core/test/doctor.test.ts packages/core/test/setup.test.ts`, in the foreground: 28 tests, 28 pass, 0 fail, 0 skipped.
- **Mutation 1:** I removed `"-C", folder` from the `rev-parse` call in `requirements.ts`. With `--test-name-pattern="Git checkout"` on `doctor.test.ts`: 1 pass, 1 fail, and the failing test is the new one. The mutation is caught. I restored the file with `git checkout --`, and `git status` is clean.
- **Mutation 2:** I removed `critical: true` from the `env ignored` requirement (`requirements.ts:112`). The same command gave 1 pass, 1 fail, so this one is caught too. I restored it the same way, and `git status` is clean.

PASS