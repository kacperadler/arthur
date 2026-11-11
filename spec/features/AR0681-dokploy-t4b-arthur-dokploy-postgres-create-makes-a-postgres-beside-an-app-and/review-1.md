# AR0681 - Review 1

- Job: 2026-11-11-review-f7d4ba64
- Branch: arthur/2026-11-11-worker-a59419ba
- Commit reviewed: f55509420aa9721fb9af32c7e264674a268a6907
- Verdict: PASS

## Final message

No blocking findings. The branch delivers what AR0681 and the approved AR0655 plan ask for T4b:

- **Commands:** `postgres create <app> <name> [--version <n>] [--env <NAME>]` and `postgres status <postgres>` behave as the plan says.
- **Order of calls:** the tests check the exact sequence `application.one` → `environment.one` → `postgres.create` → `application.saveEnvironment` → `postgres.deploy`. The env is written before the deploy. A second run writes nothing, and the database is deployed only while it is still idle.
- **Password:** made with `randomBytes(32).toString("hex")` and checked against Dokploy's `DATABASE_PASSWORD_REGEX`. It is hidden in the errors of create, env-save and deploy (each case tested with `[hidden]`) and never printed.
- **Refusals:** every refusal in the plan exists and has a test. Those on `--version`, `--env` and the Postgres id come before any request. Those on an env name already taken by another value, a detached app and a `networkSwarm` without `dokploy-network` come after the reads and before any write.
- **Argument split:** parsing moved to `dokploy-args.ts`. `env set` behaves as before, and no env test file changed; only `USAGE` and two new wrong-usage cases were added in `dokploy.test.ts`.
- **Dokploy at v0.30.10:** I compared the code with Dokploy's own source. `findEnvironmentById` lists `applicationStatus` for each Postgres, which the deploy-only-while-idle check relies on. `postgres.create` mounts `<appName>-data` itself. The panel builds the internal URL as `postgresql://${databaseUser}:${databasePassword}@${appName}:5432/${databaseName}`.
- **Docs and budget:** the usage line, the command doc, the owner doc (`remoteServersOnly`), the README, `docs/setup.md`, `arthur.config.example.ts`, the coordinator role and the roadmap are updated. The dokploy budget goes from 690 to 826 against the plan's estimate of about 815; the merge's `outcome.md` must name it. No file is yellow or red: `dokploy-command.ts` is 164 lines, `dokploy-postgres.ts` 91, `dokploy-args.ts` 44.
- **F1:** the worker's own finding (the database can be created and then meet `setVariable`'s refusal of a multi-line env) is already in `findings.md`; I did not repeat it.

The worker's claims reproduce: `npm run check` passes, and `npm test` gives the same 1707 tests, 1643 passed, 64 skipped, 0 failed.

## Notes
- (minor) `packages/dokploy/src/dokploy-postgres.ts:20`: nothing tests the encoding of the database user. Removing `encodeURIComponent` around `user` survives, because every fixture's user (`postgres`, `shop`) has no character that needs encoding.
- (minor) `packages/dokploy/src/dokploy-postgres.ts:20`: the URL encodes the user and password, which the panel does not. For a database made by hand with special characters in its password, an app env holding the panel's unencoded URL is refused as "another value" (safe, nothing lost). The command doc's line "as Dokploy's panel builds it" then says "percent-encoded"; the two parts fit together, but the URLs differ.
- (minor) `packages/dokploy/src/dokploy-postgres.ts:51`: if a `postgres.create` answer had no `postgresId`, the run would go on with `unknown`: it writes the env, then sends a deploy that gets a 404. Dokploy at v0.30.10 always returns the inserted row, so this is theoretical.
- (minor) Outside the range: after `npm test`, a `fake-agent.ts --continue -e …/session/src/handoff-extension.ts` process (pid 917343) was still running under a temporary `/tmp/arthur-test-…` folder; I stopped it. A core or session test does not clean up its fake agent.

## Checks (on f5550942)
- `npm run check`: tsc, no errors.
- `npm test`: 1707 tests, 1643 passed, 0 failed, 0 cancelled, 64 skipped. The structure test passes at 826; its yellow lines name only files outside this range.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived, 520 not run (`--max 25`).
- Hand mutations, each run against `dokploy-postgres.test.ts` and `dokploy.test.ts` and restored with `git checkout`; the tree was clean afterwards. 21 of 22 were caught:
  - The refusals removed: env name taken by another value, the no-record case, the network check, the `--version` rule loosened, the status id check, the environment id check, the found-database id check.
  - The network check turned around: swarm `.some` inverted, `detachDokployNetwork` inverted.
  - The deploy gate: never redeploy an idle database, and always deploy.
  - The hiding: `hide` dropped on create, on deploy and on the env password; `...hide` ignored in `setVariable`; `after` not hidden.
  - The rest: password not encoded, `serverId` dropped, an empty URL field allowed, any Postgres matched by name, a shorter password.
  - Survived: the user not encoded (the first note).

PASS