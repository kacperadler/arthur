# AR0681 - Review 2

- Job: 2026-11-11-review-10ff9c12
- Branch: arthur/2026-11-11-worker-a59419ba
- Commit reviewed: c0f967fdf5498974c93e48919880e9e45958901a
- Verdict: PASS

## Final message

**No blocking findings.** The branch does what AR0681 asks and follows the T4b part of the AR0655 plan:
- `arthur dokploy postgres create <app> <name> [--version <n>] [--env <NAME>]` and `arthur dokploy postgres status <postgres>` exist.
- Before the first request, it refuses a bad `--version`, a bad `--env` name and a bad Postgres id.
- After its reads and before any write, it refuses an app whose env already sets the name to another value. It also refuses an app cut off from `dokploy-network`, either detached or with its own swarm networks.
- The requests go in this order: `application.one`, `environment.one`, `postgres.create`, `application.saveEnvironment`, `postgres.deploy`.
- The password is `randomBytes(32).toString("hex")` and is checked against Dokploy's password rule. It is hidden on the create, the env write and the deploy.
- The env is written before the deploy. A deploy that runs out of time names `postgres status`. A second run finds the database and writes nothing new.
- Argument parsing moved to `packages/dokploy/src/dokploy-args.ts`. `setVariable` is exported from `packages/dokploy/src/dokploy-env.ts`, and the `env set` tests are unchanged and pass.
- The docs, README, `docs/setup.md`, `arthur.config.example.ts`, the coordinator role and the roadmap entry are updated.
- The fake's new routes are in `dokploy-shapes.json` and covered by `fake-shapes.test.ts`.
- `dokploy-postgres.ts` is 91 lines, so in the green zone. The `dokploy` budget goes from 690 to 826, close to the plan's estimate of about 815.

The worker's claims reproduce on c0f967fd: check, test and mutate counts match exactly.

## Notes
- (risk) packages/dokploy/src/dokploy-args.ts:22: `--version` and `--env` are now flags of the whole command, so `env <app> set <NAME> --version` (or `--env`) gives the usage line where the base set the value to that text. The doc's "the value may … start with `-`" no longer holds for these two values. The same limit already applied to every older flag name.
- (minor) packages/dokploy/src/dokploy-postgres.ts:50: `postgresId` from `postgres.create`'s answer is not checked against `ID`. An answer without it sends `postgres.deploy` the id `unknown` and prints `postgres status unknown`; Dokploy then answers 404.

## Checks (on c0f967fdf5498974c93e48919880e9e45958901a)
- `npm run check`: tsc finished with no errors.
- `npm test`: 1731 tests, 1667 pass, 0 fail, 0 cancelled, 64 skipped. The structure test's yellow lines name only core, delivery and session files, none in dokploy.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived, 520 not run (`--max 25`).
- Hand mutations, each run against `packages/dokploy/test/dokploy-postgres.test.ts` and restored with `git checkout -- packages/dokploy/src/` (the final `git status` is clean). Each one made at least one test fail:

  | Mutation | Result |
  |---|---|
  | `dokploy-network` check disabled (`false && …`) | 1 fail |
  | `[password]` left out of the env write's hidden values | 1 fail |
  | refusal of a name the app already sets disabled | 1 fail |
  | `status` no longer refuses `--version` / `--env` | 1 fail |
  | password left out of the deploy's hidden values | 1 fail |
  | deploy only while idle → never skips a found database | 2 fail |

  A first attempt ran some of these at the same time and they clashed on Git's index lock. I restored the files and ran each one alone; the table shows those results.

PASS