# AR0022 - Review 1

- Job: 2026-10-16-review-ar0022-env-guard-7c4d57e9
- Branch: h/2026-10-16-ar0022-env-guard-8ff85c28
- Commit reviewed: 0445f22a7c029185187dfdc69cf7919bcede5515
- Verdict: PASS

## Final message

Clean, 210/210, no stray files.

**Findings:** none that block merge.

**Notes (non-blocking):**
- `envRefusal`'s raw-text pre-check (`namedFile(value, cwd)` run before shell-word splitting) means heredocs, input redirects (`<`, `<<<`), and `source`/dot-builtin forms collapse to the same already-tested "literal `.env` substring anywhere in the command" path; not separately tested, but not a distinct code path either β€” verified by reading `namedFile`/`NAME`'s lookbehind (`/[^\s"'`=<>|;&()[]*$/` operand-start search, and `(?<![\w.])` before `\.env`), which matches regardless of preceding redirect/heredoc/`source` token.
- Symlinks are explicitly out of scope for entry 19 (only entry 20's worktree guard mentions symlinks) and the worker documents this as a known limit in the code's comments and final message β€” correctly not hidden.
- `sed -i -e '...' .env`, multi-flag (`-e`/`;w`/`/e`) variants are not explicitly in the test table, but `SET_KEY`'s anchored regex rejects all of them (confirmed by tracing the pattern), and they fall through to the generic `.env`-mention block, which the existing "sed -i … /w /dev/stdout" and "…/p" rows already exercise for the "exempt-form-must-match-exactly" behavior.
- F1 in `findings.md` (coordinator not yet wired to load the guard) is correctly filed as open risk, matches that entry 23/the coordinator doesn't exist yet; doesn't contradict any ticket Decision.

**Checks run (in this worktree, range `856b8c22..0445f22`):**
- `npm ci`: clean.
- `npm run check` (tsc): clean.
- `npm test`: 210/210 pass, matches worker's claim.
- `wc -l` on `env-guard.ts` (128), `shell-words.ts` (126), `env-guard.test.ts` (121), `wrapper.ts` (162): all under the 200-line cap; core `src/` total 3246 lines, under the 4000-line package budget.
- `wrapper.ts`/`wrapper.test.ts`/`package.json` diffs: confirmed one-line wrapper change plus matching two test-assertion updates, no AR0015 conflict potential beyond that line.
- Mutation testing (throwaway edits in this worktree, each reverted via the saved original, `git status --short` clean afterward):
  - `setsOneKey` forced to `false` β†’ "the one sed -i the guard lets through…" and the OMP-extension test fail.
  - Dropped the `.example` negative lookahead from `NAME` β†’ both table tests fail (`.env.example`/`.envrc`-adjacent rows).
  - Disabled `namedGlob` call β†’ table test fails (glob rows).
  - Inverted the `.env/`-folder `statSync` check (always return path) β†’ table test fails (VENV allowed rows).
  - Removed `"read"` from `GUARDED` β†’ table test fails (`read` rows no longer refused).
  - Disabled `braces()` (returns `[word]`) β†’ table test fails (`.{env,x}` row).
  - Removed the `key === "i"` skip β†’ table test fails (the two `i`-field rows the worker says were added after this exact mutation).
  - All seven mutations caught by the existing test file; none required a new test.
- `omp --version` in this environment: `18.3.0`, matching the worker's claimed smoke-test version (did not re-run the live `.env`-reading smoke test myself: this review session's own bash tool is wrapped by a pre-existing production env-guard that refuses any command whose text names a `.env`-family file, including inside throwaway scripts meant only to probe the branch's code in isolation β€” direct evidence the control family works, but it blocked further live-`omp` reproduction from this session).

PASS
