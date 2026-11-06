# AR0654 - Review 1

- Job: 2026-11-06-review-9c9d406c
- Branch: arthur/2026-11-06-worker-a8614f6b
- Commit reviewed: 55dd4fa7a070d0f3fa7e1f1ecf813785f146e1ab
- Verdict: PASS

## Final message

I found nothing in the range that fails the ticket. `create`, `setup` and `env names|set` work end to end, and every Dokploy call matches Dokploy's own source at v0.30.10. The new tests catch every refusal I removed by hand.

Each Dokploy call checked against the v0.30.10 source on GitHub (no real Dokploy called):

| Call | What the branch sends | v0.30.10 requires | Result |
|---|---|---|---|
| `application.create` (`packages/dokploy/src/dokploy-setup.ts:25`) | `{ name, environmentId }` | `apiCreateApplication`: `name` and `environmentId`; `appName` is optional | Matches |
| `application.saveBuildType` (`dokploy-setup.ts:56`) | `dockerfile`, `dockerContextPath`, and `dockerBuildStage`, `herokuVersion`, `railpackVersion` sent back as the app has them | `apiSaveBuildType` is `.required()`, so every one of those keys must be present | Matches. A fresh app's null `dockerContextPath` goes as `null`, which the schema accepts |
| `application.saveEnvironment` (`dokploy-env.ts:39`) | `env`, `buildArgs`, `buildSecrets` as strings, `createEnvFile` as a boolean | `apiSaveEnvironmentVariables` is `.required()` | Matches |
| `domain.create` | `host`, `port`, `https: true`, `certificateType: "letsencrypt"`, `applicationId`, `domainType: "application"` | `apiCreateDomain`; the router checks app permission only when `domainType === "application"` | Matches |
| `mounts.create` | `type: "volume"`, `volumeName`, `mountPath`, `serviceType: "application"`, `serviceId` | `apiCreateMount` | Matches |
| `domain.validateDomain` | `{ domain, serverId? }` | A mutation with read permission, returning `validateDomain(...)` with `isValid` and `error` | Matches the warning path |

The fake's `REQUIRED` list (`packages/dokploy/test/fake-dokploy.ts:132-141`) has the same fields as these schemas.

- **Coordinator only:** the `dokploy` command is still registered without `inJob`, so the core refuses it inside a job. The new subcommands inherit that, and the coordinator role line now covers create and setup.
- **Values never shown:** `env names` prints `parseEnv` keys only. `env set` never prints the value, and every value it sends has Dokploy's error text masked as `[hidden]` (`dokploy-api.ts:54`). The check at `dokploy-env.ts:34` refuses a write that would change another variable, which blocks newline and quote injection, and the test covers it.
- **`--dokploy-project` instead of `--project`:** accepted by the coordinator, and the command doc explains why.
- **Line budget 450 → 615:** the counted `src/` lines come to 613, using the 160-character width rule. The new code is two files (`dokploy-setup.ts` 78 lines, `dokploy-env.ts` 42) plus 25 net lines in `dokploy-command.ts`. Each part is needed by Done means or by the API: the key fields saveBuildType wants sent back, the hidden values, the check that keeps other env lines unchanged, and the domain validation. Nothing extra stands out, so the raise is justified. The worker's final message does not name the raise, but the coordinator knows about it.
- **Size zones:** every file stays green; `dokploy-command.ts` counts 192.
- **Docs:** the command page, README, coordinator role, roadmap, setup, the config example and both diagrams are updated. `CHANGELOG.md` is written when the merge runs, as with earlier tickets.

## Notes
- (risk) `packages/dokploy/src/dokploy-env.ts:10`: Node's `parseEnv` is not dotenv. The guard against changing other lines and the "reads back as given" check use Node's parser, while Dokploy reads with `dotenv`. Where the two parse a line differently (backticks, escapes), the saved line could read back differently on the server.
- (minor) `packages/dokploy/src/dokploy-env.ts:38`: the filter that drops empty strings from the hidden values is untested. Replacing it with `true` passes every test; an empty string kept there would scatter `[hidden]` through Dokploy's message.
- (minor) `packages/dokploy/src/dokploy-env.ts:23`: the "already holds that value" reply tells the caller whether a guessed value is the current one. Only the coordinator can run it.
- (minor) `packages/dokploy/src/dokploy-command.ts:109,124`: the `unknown project` refusal appears in both `target` and `pick`, and `target` calls `pick`, so the check runs twice.
- (minor) `packages/dokploy/src/dokploy.ts:7`: this comment, which the branch did not change, still says `arthur dokploy` only reads, uploads or deploys. It does not mention create, setup and env.
- (minor) `spec/vision.md:77`: the owner's dokploy row still names only read, upload and deploy. The worker logged this as F2.

## Checks (all on 55dd4fa7)
- `node --import @arthur/core/testing --test packages/dokploy/test/*.test.ts`: passed, exit 0. I did not rerun the full suite or `npm run mutate`, as instructed; the worker's numbers for those (1533 of 1597 pass, 0 fail; mutate 24 of 25) are not reproduced here.
- I changed the code by hand 15 times and ran `packages/dokploy/test/dokploy-setup.test.ts` after each. The tests caught 14:
  - **create:** the refusal of a name the environment already has turned off; the default-environment match turned off.
  - **setup, port and volume:** the port's upper limit moved to 65536; its lower limit moved to 0; the refusal of a path another mount holds turned off.
  - **setup, domain and build type:** the domain always created; the build type always saved; the domain warning turned off.
  - **env set:** the check that keeps other env lines turned off; the "cannot be written as a line" refusal turned off; the "already holds that value" skip turned off; the single-quote form removed; `export` lines no longer matched; the `[hidden]` masking turned off.
  - **Survived:** the empty-string filter on the hidden values (see Notes). I confirmed the method by watching the unchanged file pass and one changed copy fail, and restored every edit with `git checkout -- packages/dokploy/src`; `git status` is clean.
- `npx arthur dokploy --help` could not run: this checkout has no `arthur.config.ts`, so only the core's commands load. I read `packages/dokploy/docs/commands/dokploy.md` instead.
- Checked the Dokploy v0.30.10 source on GitHub raw: `application.ts`, `domain.ts`, `mount.ts` and the domain router.

PASS