# AR0720 - Review 1

- Job: 2026-11-18-review-2fe6f780
- Branch: arthur/2026-11-17-worker-f36680a2
- Commit reviewed: f5148a4ba084168561178959cb5875fac4e4d46f
- Verdict: PASS

## Final message

No finding blocks the merge. The branch does what AR0720 asks: an image a job builds or commits gives a container from it neither of the job's two marks, `arthur.container` and compose's `com.docker.compose.config-hash`, so the prune and the sweep leave the owner's containers from those images and still remove the job's own.

- **Build** (`docker-label.ts:79-80`): every build spelling gets `--label arthur.container= --label com.docker.compose.config-hash=` after the job's label. Every word the job gives that sets either key, or `arthur.job`, is dropped. Its two other names, `builder build` and `buildx b`, were not labelled at all before; the worker's message gives the reason for adding them.
- **Commit** (`docker-label.ts:73-78`): the two `--change 'LABEL …=""'` words go after the job's last option and right before the container. Docker reads no option after the container, so the placement is right. Twice covers a job's change that ends in a line continuation.
- **Reading** (`docker-look.ts:49-50`, `docker-cleanup.ts:24-27`): an empty mark now counts as none. The `{{if .Label …}}` format leaves blank lines, which `sections()` already skips.
- **The `--label-file` test**: the ticket asks for an image built with a `--label-file`, but `docker build` has no such flag. The worker tested `run --label-file`, then a commit, instead, and said so in its message and in `docs/docker.md`. That is the only way such a file reaches an image.
- **Line budget**: the docker budget rises from 720 to 745 in `test/structure.test.ts`, with the reason in the final message. The styleguide allows a raise; it must show in the merge's outcome.md. The changed source files stay green (88, 91 and 94 lines).
- **Docs**: `docs/docker.md`, `docs/commands/docker.md` and roadmap entries 70 and 71 match the change. A search for the changed command lists and mark wording found nothing stale.

## Notes
- (security) packages/docker/src/docker-label.ts:26: adds to F4. A Dockerfile that names its own frontend (`# syntax=<image>`) receives the `--label` values as frontend options and may ignore them, so a job's build can keep `LABEL` marks on purpose. Inference from how buildkit passes labels; not run.
- (minor) packages/docker/test/cleanup.test.ts:133: the ticket's "built with a `--label-file`" case is covered by `run --label-file` plus `commit`, since a build takes no `--label-file`. The coordinator should confirm this replacement, as the worker asked.

## Checks (all on `f5148a4b`)
- `npm run check`: `tsc` printed no error.
- `npm test`: 1902 tests, 1838 pass, 0 fail, 0 cancelled, 64 skipped.
- `npm run mutate`, four calls until none was left unrun. The last summary: `100 mutants, 100 caught, 0 survived; 45 not run (--max 100)`.
- Base source with the branch's tests: I put `packages/docker/src` back to `26b3814c` and ran `cleanup.test.ts` and `sweep.test.ts`. Both new tests fail (27 pass, 2 fail); `src` restored.
- Hand mutations, applied together:
  - in `docker-look.ts`, any config-hash counts again, the empty one included (`"com.docker.compose.config-hash" in labels`);
  - in `docker-cleanup.ts`, the compose container listing prints every container again (`made='{{json .}}'`).

  The cleanup, sweep and look tests gave 25 pass, 4 fail; the two new tests are among the failures. Restored with `git checkout -- packages/docker/src`, and `git status` was clean.

PASS