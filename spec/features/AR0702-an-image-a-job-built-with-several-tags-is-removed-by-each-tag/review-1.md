# AR0702 - Review 1

- Job: 2026-11-17-review-04b7195f
- Branch: arthur/2026-11-17-worker-5c92907a
- Commit reviewed: 65812e0a51ec131c89a0f084c20831d3ee07e056
- Verdict: PASS

## Final message

No finding blocks the merge. The prune and the sweep now remove a tagged image by each `<repository>:<tag>` and a dangling one by its ID. `arthur docker`, the dry run and the prune's and sweep's lines count such an image once, and the fake Docker refuses `image rm <ID>` for an image with several tags, in moby's words. I ran the four new prune and sweep tests against the base's `packages/docker/src`: all four fail there and pass on the tip, so the ticket's "fails on today's code" condition holds. The docs in `docs/docker.md`, `docs/commands/docker.md` and `docs/commands/docker-sweep.md` are updated, and a search found no stale text about removing images by ID.

The two mutants that survive (`reclaimed: false` → `true` and `under: false` → `true` in the dry run's return value, `packages/docker/src/docker-sweep.ts:93`) cannot be caught by any test. The only code that reads `reclaimed` and `under` is `sweepAndTell` (`docker-sweep.ts:141`), and it calls `sweep` without `dryRun`. These values are also unchanged from the base. That matches the worker's claim.

## Notes
- (minor) `test/structure.test.ts:26`: the docker line budget goes from 705 to 720. The reason is only in commit a1d31aef, not in the worker's final message, so the merge's outcome.md needs to show the raise.
- (minor) `packages/docker/src/docker-sweep.ts:102`: `gone` calls `of` once per word for each object, and in the sweep `of` is a `doomed.find`. The cost grows with the cube of the number of leftovers, which is fine for dozens but slow for thousands.
- (minor) `packages/docker/src/docker-look.ts:65`: some images show both a digest-only row (`repo <none>`) and a tag row. The digest-only row becomes the word `image:<ID>`, and if that row comes first Docker deletes the image by ID. The tag word then gets "No such image" and shows as `kept`, and the image is not counted. This is rare for images a job builds. The base already removed such an image twice.

## Checks (all on 65812e0a)
- `npm run check && npm test`: tsc found no errors. Tests: 1893, passed 1829, failed 0, skipped 64. Yellow lines appear only for core and delivery files; no docker file is yellow.
- `npm run mutate`, run four times until nothing was left unrun: `83 mutants, 81 caught, 2 survived`. Both survivors are at `docker-sweep.ts:93` and cannot be caught, as explained above.
- Base `packages/docker/src` with the tip's tests (`cleanup.test.ts`, `sweep.test.ts`): 27 tests, 11 failed, the four new ones among them. Afterwards I restored `src` with `git checkout HEAD -- packages/docker/src`, and `git status` showed it clean.
- `wc -l packages/docker/src/*.ts`: the largest file is 142 lines, the total 679, and every file is green.

PASS