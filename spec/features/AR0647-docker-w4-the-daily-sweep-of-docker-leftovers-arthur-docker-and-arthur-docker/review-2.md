# AR0647 - Review 2

- Job: 2026-11-12-review-12761f1d
- Branch: arthur/2026-11-11-worker-5f2781a0
- Commit reviewed: 3a5b42a89876aa2c0c8bd66e772496b909c858a5
- Verdict: FAIL

## Final message

Three tests are missing: removing or weakening three conditions in the sweep still passes every test. All three are in `docker-look.ts` and `docker-sweep.ts`, and the docs promise each behaviour.

## Findings

1. **`packages/docker/src/docker-look.ts:60`: nothing tests that a labelled machine without Docker is not a failure.**
   - Mutation: I deleted the line `if (ran.code === 3) return { problem: "command -v finds no docker there", failed: false };` and all 41 of the docker package's tests still passed.
   - With the line gone, such a machine becomes `listing what Docker holds exited 3: …` with `failed: true`. The daily sweep and the `disk-low` sweep then send a notice every time, and `arthur docker` and `arthur docker sweep` exit 1.
   - The docs say the opposite: `packages/docker/docs/docker.md:101` ("A labelled machine without `docker` says `command -v finds no docker there` and is no failure") and `packages/docker/docs/commands/docker.md:24,26` ("no docker there is no failure").
   - No sweep test mentions `command -v finds no docker there`.

2. **`packages/docker/src/docker-sweep.ts:58`: the guard on "dangling" images is not tested.**
   - Mutation: I changed `thing.row.Repository === "<none>" && thing.row.Tag === "<none>"` to `||`, and all 11 tests in `sweep.test.ts` passed.
   - With that change, an old, unused image of the owner's whose tag is `<none>` but which has a repository would be removed as "dangling". This is what `docker image ls` shows for an image pulled by digest, such as `postgres@sha256:…`.
   - That breaks entry 72's "never removes … a tagged image no job built" and the docs' "dangling images (`<none>:<none>`)".
   - The fixture has only `<none>:<none>` images and fully tagged ones, never one with a repository and a `<none>` tag.

3. **`packages/docker/src/docker-sweep.ts:21`: nothing tests that the sweep removes a gone job's `created` or `dead` containers.**
   - Mutation: I narrowed `STOPPED` to `["exited"]`, and all 11 tests in `sweep.test.ts` passed.
   - The sweep would then leave forever the `created` and `dead` containers of a job that no longer exists, along with their anonymous volumes. Those are what a failed `docker run` or `docker create` leaves behind.
   - `packages/docker/docs/docker.md` says the sweep removes them: "Its stopped containers (`created`, `exited` or `dead`)".
   - The fixture's containers of the gone job are only `exited`, `running` and `paused`.

## Notes
- (risk) `packages/docker/src/docker-sweep.ts:54`: a Docker container inherits its image's labels. If the owner runs a container from an image a job built, it carries `arthur.job=<id>`. Once that job's record is gone, the sweep removes the owner's stopped container along with its anonymous volumes.
- (risk) `packages/docker/src/docker-sweep.ts:85`: job records belong to one Arthur home, but Docker is shared by the whole machine. With two Arthur homes on one Docker host (a second checkout, a dev install), each sweep treats the other's labelled resources as belonging to jobs that no longer exist and removes them.
- (minor) `packages/docker/src/docker-look.ts:1`: this file is new, and the ticket's Scope In does not name it. The worker's message gives the reason: one listing shared by the sweep, `arthur docker` and the cleanup. It is in-package and stays green.

## Checks (on `3a5b42a8`)
- **`npm run check && npm test`:** tsc passes. 1758 tests: 1694 pass, 0 fail, 64 skipped.
- **`npm run mutate`:** 25 mutants, 21 caught, 4 survived, 611 not run (--max 25). The 4 survivors are the comment and help-text hunks the worker listed: `arthur.config.example.ts:418`, `docker-options.ts:20`, `fake-docker.ts:20` and `docker-options.ts:22`.
- **Hand mutations,** each restored with `git checkout`. The first ran against the docker package's tests (`packages/docker/test/**/*.test.ts`), the rest against `sweep.test.ts` alone:

  | Mutation | Result |
  |---|---|
  | `docker-look.ts:60` deleted | survived (41 pass, 0 fail) |
  | `STOPPED` = `["exited"]` | survived (11 pass) |
  | dangling `&&` changed to `||` | survived (11 pass) |
  | `!PREDEFINED.includes(name)` removed | caught (5 fail) |
  | `&& !used` removed | caught (3 fail) |
  | `age >= hours` changed to `age > hours` | caught (5 fail) |
  | notice condition reduced to `each.reclaimed` (review 1, finding 1) | caught (1 fail) |
  | `\|\| freed > 0` removed (review 1, finding 2) | caught (1 fail) |

- **Worktree:** `git status --short` was empty after the mutations.
- **Not run:** a smoke run against real Docker.

FAIL