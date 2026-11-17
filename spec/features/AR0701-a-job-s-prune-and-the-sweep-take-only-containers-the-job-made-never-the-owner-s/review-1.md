# AR0701 - Review 1

- Job: 2026-11-17-review-de1b984c
- Branch: arthur/2026-11-17-worker-e60ea741
- Commit reviewed: f5856f0e1de5e46ed1d123b4f47ccef7983d7981
- Verdict: PASS

## Final message

No finding blocks the merge: the branch does what AR0701 asks, from start to end.

- **Done means 1:** `packages/docker/src/docker-label.ts:57` adds `--label arthur.container=<id>` after `run`, `create`, `container run` and `container create`. `KEY` at line 14 drops every word that sets `arthur.container`, in each spelling. The job's prune (`docker-cleanup.ts:23-24`) and the sweep and `arthur docker` (`docker-look.ts:46-48`) now find a job's container only by `arthur.container`, or by the compose project together with `com.docker.compose.config-hash`.
- **Done means 2:** the fake Docker's `run` and `create` (`packages/docker/test/fake-docker.ts:150-176`) make a container that takes its image's labels, its own labels winning. `fake-shapes.test.ts` checks both the label merge and that the new containers have the keys `ps` prints.
- **Done means 3:** two new tests, `cleanup.test.ts:109` and `sweep.test.ts:199`, run the owner's containers from images the job built, both a plain image and one its compose project built, some running and some stopped. The prune and the sweep leave them and their volumes, and still remove the container the job made. I did not re-run the worker's check that both tests fail on the old code; my two hand mutations below each make one of them fail.
- **Compose:** the worker extended the fix to compose containers, which the ticket did not name. The final message gives the reason: compose puts its project label on the images it builds, so an owner's container from one of them carried the job's project. Without this, the owner's container from a compose-built image would still be taken.
- **Docs:** `docs/docker.md`, `docs/commands/docker.md` and roadmap entries 70 and 71 are updated. The other places that mention `arthur.job` are still true: `spec/vision.md:162`, `arthur.config.example.ts:424` and the options summary.
- **Budget:** the docker line budget goes from 697 to 705. That is a raise of an existing package's budget and goes in the merge's outcome.md; it is not a reason to fail. No source file passes 200 lines; the largest, `docker-sweep.ts`, has 139.

## Notes
- (risk) packages/docker/src/docker-look.ts:48: compose's config hash can also reach an image, which adds to F1. F1 covers only `arthur.container`. If a job runs `docker commit` on one of its compose containers, or a Dockerfile has `LABEL com.docker.compose.config-hash=…`, the image carries the project label and the config hash. An owner's container from that image then passes the project-plus-hash test, so the prune and the sweep take it again.
- (minor) packages/docker/src/docker-cleanup.ts:24: `$by` is now unquoted, and that is how the second `--filter` gets added. It is safe because job ids and `arthur-<hex>` project names hold no spaces or glob characters.
- (minor) packages/docker/src/docker-look.ts:47: containers made before this change carry only `arthur.job`. The prune and the sweep now treat them as the owner's and never remove them. The worker says so, and the ticket says the plugin is off in the owner's config.
- (minor) The claim that compose v2.40.0 gives `com.docker.compose.config-hash` to every container it makes, one-off `compose run` containers included, and to no image it builds, is the worker's reading of compose's source. I had no network access to check it. [INFERENCE]

## Checks (all on f5856f0e)
- `npm run check`: tsc passed with no errors.
- `npm test`: exit 0; 1888 tests, 1824 passed, 0 failed, 0 cancelled, 64 skipped. The structure test listed yellow files only in core and delivery, none in docker.
- `npm run mutate`: the first run gave 30 mutants, 30 caught, 0 survived, 11 not run (time). Run again on the same commit, the last summary was 41 mutants, 41 caught, 0 survived.
- Hand mutation, `docker-look.ts:48`, the config-hash condition replaced by `false`: `sweep.test.ts` gave 12 passed and 1 failed (the owner's-container test). Restored with `git checkout`.
- Hand mutation, `docker-cleanup.ts:23`, the config-hash filter removed from the container listing: `cleanup.test.ts` gave 9 passed and 1 failed (the owner's-container test). Restored with `git checkout`; the checkout is clean.
- Rewrite by hand, `node packages/docker/src/docker-label.ts echo <id> ...`:
  - `--log-level debug run -d -l arthur.container=other --name web img` gave `--log-level debug run --label arthur.job=<id> --label arthur.container=<id> -d --name web img`, as the worker claims.
  - `container create -larthur.container=x img` gave both labels and dropped the job's own label.
  - `commit c1 img2` passed unchanged, as F1 says.

PASS