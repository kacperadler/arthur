# AR0343 - Review 1

- Job: 2026-10-27-review-b5256d62
- Branch: arthur/2026-10-27-worker-2a49ca52
- Commit reviewed: 4e0cfb23ec5d3f629cd70bfaca004e92598f1032
- Verdict: FAIL

## Final message

I'm failing this branch on one test gap. The check itself works when I run it, and `npm run check` and the two test files pass. But the tests don't fix which folder Git looks in to decide whether the env file is inside a checkout.

## Findings

1. **`packages/core/src/requirements.ts:103` / `packages/core/test/doctor.test.ts:200-226`: an important mutation goes uncaught.**
   - **Mutation:** I removed `"-C", folder` from the `rev-parse --show-toplevel` call, so Git ran in the process's working directory instead of the env file's folder. The new test and the core-requirements test still passed (pass 2, fail 0).
   - **Why the tests miss it:** every case in the new test puts the env file inside the folder `arthur doctor` runs in (`cwd: folder` in `project()`).
   - **Why it matters:** I called `coreRequirements` directly from a folder outside any checkout, with `envFile` in a separate Git repo that does not ignore it.
     - The code as committed returns `missing: the env file …/repo/env lies in the Git checkout …/repo, which does not ignore it`.
     - The mutated code returns `ok`, so `arthur run` would start with an env file that a commit there would pick up.
     - The reverse case is not tested either: the working directory is a repo and the env file lies outside every checkout.
   - **Why this is the core of the ticket:** what the ticket checks is whether the env file's own folder lies in a checkout. The existing `core env` test already covers an env file in another project's checkout (`shop`), so the same setup could cover this.

## Notes (not blocking)

- The `.env.*` line in `.gitignore` is present. I could not confirm it with `git check-ignore`: the secrets guard refused that command too, as it did for the worker.
- If the env file's folder does not exist yet, the line reads `ok`, because `git -C` fails. There is no file to commit then, and the next `doctor` or `run` would flag it once the folder exists.
- In the core-requirements test, PATH holds no `git`, so `core env ignored: ok` there only comes from Git not being found. That test's title ("the env file's place, not" critical) no longer fits the new line, which is critical.
- Everything else matches the ticket and its decisions:
  - **AR-D116:** the line is critical, so `arthur run` refuses to start.
  - **Line budget:** core goes to 6340, with the reason recorded in `test/structure.test.ts`. You say that number is under policy AR-D115; the ticket I read only names AR-D63.
  - **Docs:** `doctor.md` and `config.md` are updated.
  - **Edge cases tested:** a file Git already tracks, a `.gitignore` holding only `.env`, and an env file in a folder below the checkout's top.

## Checks run

- `npm ci`: ok.
- `npm run check`: tsc clean, exit 0.
- `node --test packages/core/test/doctor.test.ts packages/core/test/setup.test.ts`: 27 tests, 27 pass, 0 fail, 0 skipped. This matches the worker's numbers. Per your instruction I did not run the full suite; you reported 1186 tests, 1180 pass, 0 fail, 6 skipped.
- Mutations, each run against the new test plus the core-requirements test:
  - outside a checkout, return `missing` instead of `ok`: caught (fail 2).
  - invert the `ignored.ok` result: caught (fail 1).
  - `critical: true` changed to `false` at line 112: caught (fail 1).
  - `check-ignore` run on a fixed wrong name: caught (fail 1).
  - `rev-parse` without `-C folder`: **not caught** (pass 2, fail 0). This is the finding above.
- Every mutation was restored with `git checkout --`, and `git status --short` is clean.

FAIL