# AR0655 - Plan

- Job: 2026-11-06-plan-3939f350
- Planned at: 4c1be2ecd1887d8b4fb1242bde58e165592283b7

## Approach
`arthur dokploy` gets three worker tickets, each one pull request. Together they let the coordinator, on the owner's word, put up a whole project. Each ticket builds on AR0654's commands (`create`, `setup`, `env`, branch `arthur/2026-11-06-worker-a8614f6b`). That branch must be merged first: the plan's line counts and the code it reuses (`createApp`, `setupApp`, `envCommand`) exist only there.

A whole project, step by step, as the coordinator would run it. The ids shown are placeholders:
1. `arthur dokploy create web --dokploy-project Shop` (AR0654) creates the app.
2. `arthur dokploy source <app> --repo owner/shop --branch main` connects the app to its repository; from then on a push deploys it (T4a).
3. `arthur dokploy setup <app> --dockerfile Dockerfile --domain shop.example --port 3000` (AR0654) sets the build and the domain.
4. `arthur dokploy postgres create <app> db` creates a Postgres beside the app, writes `DATABASE_URL` into the app's env and deploys the database (T4b).
5. `arthur dokploy postgres backup <postgres> --destination <name> --schedule "0 3 * * *" --keep 7` schedules backups (T4c).
6. `arthur dokploy deploy <app>` (AR0603) runs the first deploy; later pushes deploy by themselves.

**Left alone:**
- `apps`, `app`, `status`, `upload`, `deploy`, `create`, `setup` and `env` keep their behavior and output.
- `call()` in `dokploy-api.ts` stays as it is: its `hide` list already masks secrets in Dokploy's error text.
- Still never in a job: the `dokploy` command stays registered without `inJob`, and the new verbs inherit that.
- No new state or files under `.arthur/`; no new dependency; no other plugin is touched.
- Out of scope: deleting databases, changing a database password, and compose services.

**Git source (T4a): through Dokploy's GitHub app only.**
- Deploy on push comes from Dokploy's own GitHub App webhook (`/api/deploy/github`). The owner installs the app once and needs no per-repository webhook.
- `source <app> --repo <owner>/<name> --branch <branch> [--build-path <path>] [--github <name>] [--replace-source]`:
  - Reads, in order:
    - `application.one`;
    - `github.githubProviders`. It picks the GitHub app `--github` names (`gitProvider.name`), else the only one there is;
    - `github.getGithubRepositories?githubId=`. The repository must be visible to that GitHub app;
    - `github.getGithubBranches?repo=&owner=&githubId=`. The branch must exist.
  - Then sends `application.saveGithubProvider` with these keys:
    - `applicationId`, `githubId`, `owner`, `repository`, `branch`;
    - `buildPath`, default `/`;
    - `triggerType: "push"`;
    - `watchPaths`: the app's own list, else `[]`;
    - `enableSubmodules`: as the app has it.
  - Sends `application.update { applicationId, autoDeploy: true }` only when the app's `autoDeploy` is `false`.
  - If the app already has this exact source with push and auto-deploy on, it prints `already set` and writes nothing.
  - On success it prints the source, the branch, the build path and the GitHub app's name, then `a push to <branch> deploys it; the first deploy: arthur dokploy deploy <app>`.
- `--build-path` is the folder inside the repository. The Dockerfile path that `setup --dockerfile` sets is read from inside that folder.
- Plain Git with a deploy key (`saveGitProvider`, `sshKey.generate` and `sshKey.create`, plus a webhook to `/api/deploy/<refreshToken>`) is not built: see Not available directly and Open questions.

**Database (T4b): Postgres only, created beside an app and connected to it.**
- `postgres create <app> <name> [--version <n>] [--env <NAME>]`:
  - Reads `application.one` for the app's `environmentId`, `serverId`, networks and env.
  - Then reads `environment.one` for the Postgres databases already in that environment.
  - Each part already in place is left as it is, as `setup` does, so a second run finishes what a failed one left:
    - **The database:** when that environment has no Postgres named `<name>`, `postgres.create` makes one with:
      - `name`, the app's `environmentId`, and its `serverId` when it has one, so the database runs on the same server;
      - `dockerImage: postgres:<n>`, default `postgres:18`, Dokploy's own default;
      - `databaseName` and `databaseUser` both `postgres`, the defaults of Dokploy's panel;
      - a generated `databasePassword`.
    - **The volume:** `postgres.create` mounts the data volume `<appName>-data` itself (`getMountPath` handles where Postgres 18 keeps its data), so Arthur adds no volume.
    - **The connection URL:** the app's env gets `<NAME>=postgresql://postgres:<password>@<appName>:5432/postgres`, `<NAME>` defaulting to `DATABASE_URL`. This is the internal URL exactly as Dokploy's panel builds it. It is written through the AR0654 env-set path, which keeps every other line.
    - **The deploy:** `postgres.deploy` runs when the database is new or still `idle`.
  - The env is written before the deploy, so a deploy that times out still leaves the app connected.
  - It prints the created line, with the id, before the deploy. When the deploy gives no answer in time, the error names `arthur dokploy postgres status <id>`.
- `postgres status <postgres>` prints, from `postgres.one`: the name, id and instance, the image, the status, the internal host `<appName>:5432`, the database and the user, the volume and its path, and each backup. It never prints the password or the URL.

**Backups (T4c).**
- `postgres backup <postgres> --destination <name> --schedule <cron> [--keep <n>]` reads `destination.all`, using only its `name` and `destinationId`. It then sends `backup.create` with:
  - `postgresId`, `destinationId`, `schedule`, `keepLatestCount`;
  - `enabled: true`. Dokploy only schedules a backup whose `enabled` is true (`backup.ts:152`), and the column has no default;
  - `prefix: "/"`, the default of Dokploy's panel;
  - `database`: the database's name;
  - `databaseType: "postgres"`, `backupType: "database"`.
- `backup.create` answers nothing, so the command reads `postgres.one` afterwards and prints the backup Dokploy now lists.

**The secret path:**
- **Made:** in the `postgres create` process only, `randomBytes(32).toString("hex")`. That is 64 characters of `0-9a-f`: inside Dokploy's `DATABASE_PASSWORD_REGEX`, with no percent-encoding needed in a URL and no quoting needed in dotenv.
- **Held:** by Dokploy only, in the database record and in the app's env line. Arthur writes no file, log line, event or chat line with it.
- **Shown:** never.
  - Every call that carries the password or the URL passes both in `hide`, so Dokploy's error text shows `[hidden]`.
  - Answers that hold the password (`postgres.create`, `postgres.deploy`, `postgres.one`) are read for named fields only.
  - A second run that has to write the URL again reads the password from `postgres.one` and keeps it in memory only.

**Refusals.**
- Before any request (exit 1, `nothing was asked of Dokploy`):
  - `source`:
    - `--repo` not `<owner>/<name>` (`[A-Za-z0-9-]+/[A-Za-z0-9._-]+`);
    - `--branch` outside Dokploy's `VALID_BRANCH_REGEX`;
    - `--build-path` not from `/`, or holding a `..` segment.
  - `postgres create`:
    - `--version` not 1 to 99;
    - `--env` not a variable name (the same check `env set` uses).
  - `postgres backup`:
    - `--schedule` not five cron fields;
    - `--keep` not a positive whole number.
- After the reads, before any write:
  - `source`:
    - no GitHub app on the instance. The message names the owner's part: Settings, Git providers;
    - several GitHub apps and no `--github` (the names are listed);
    - a `--github` name that does not exist;
    - a repository the GitHub app cannot see ("install the GitHub app on it");
    - a branch the repository does not have;
    - an app that deploys from another source and has deployments, without `--replace-source`. The wording is the same as `upload`'s.
  - `postgres create`:
    - the app already sets `<NAME>` to another value ("give `--env <NAME>`"). This is checked before anything is created, so the owner's existing value is not lost;
    - the app is cut off from `dokploy-network` (`detachDokployNetwork`, or a `networkSwarm` without it), so it cannot reach the database by its internal name.
  - `postgres backup`:
    - a destination name that does not exist (its names are listed);
    - the same destination and schedule already set, which prints `already set` and writes nothing.
- Wrong usage prints the usage line and exits 2, as today.

**What the owner sets up once per Dokploy server:**
- A GitHub app: in the Dokploy panel, Settings, Git providers, "Create GitHub App". The panel creates it on his GitHub account or organisation; he then installs it on the repositories. Its webhook is `<the panel's address>/api/deploy/github`, so the panel must be reachable from GitHub over the internet. An instance reached only over Tailscale gets no push deploys.
- If Arthur's API key belongs to a plain member and not the owner or an admin, the GitHub app must be shared with the organisation (`getAccessibleGitProviderIds`).
- For T4c: one S3 destination, in Settings, Destinations.

**Every Dokploy call, checked against the source at tag v0.30.10 (commit 073713f0) and its `openapi.json`. No real Dokploy server was called.**
- `application.saveGithubProvider`: POST; router `application.ts:536`, input `apiSaveGithubProvider` (`schema/application.ts:453`).
  - Required (openapi): `applicationId`, `repository`, `owner`, `buildPath`, `githubId`, `branch`, `triggerType`.
  - Dokploy's panel also sends `watchPaths` and `enableSubmodules` (`save-github-provider.tsx:150`).
  - It sets `sourceType: "github"` and answers `true`.
- `application.update`: POST, `application.ts:760`. `apiUpdateApplication` is a partial schema with only `applicationId` required.
- `application.one`: GET, `application.ts:255`. `findApplicationById` returns the `github` record without `githubClientSecret`, `githubPrivateKey` and `githubWebhookSecret`, but with the app's own `refreshToken`.
- `github.githubProviders`: GET, `github.ts:60`. Each item is `{ githubId, githubUrl, gitProvider }`, filtered to the providers the user may see.
- `github.getGithubRepositories`: GET with `githubId*` (`github.ts:44`). The answer is GitHub's own repository objects for the installation.
- `github.getGithubBranches`: GET with `repo*`, `owner*`, `githubId` (`github.ts:51`). The answer is GitHub's own branch list.
- Push deploy: `pages/api/deploy/github.ts:218-240` deploys the apps with `sourceType github`, `autoDeploy true`, `triggerType push`, the same branch and the same `githubId`.
- `environment.one`: GET with `environmentId*` (`environment.ts:79`). `findEnvironmentById` (`services/environment.ts:34`) lists `postgres` with `postgresId`, `name` and `serverId`, never a password.
- `postgres.create`: POST, `postgres.ts:58`, input `apiCreatePostgres` (`schema/postgres.ts:158`).
  - Required: `name`, `databaseName`, `databaseUser`, `databasePassword` (matching `DATABASE_PASSWORD_REGEX`, `schema/utils.ts:51`), `environmentId`.
  - It mounts the `<appName>-data` volume itself and answers the whole record, password included.
- `postgres.deploy`: POST with `postgresId*` (`postgres.ts:228`). It runs synchronously: it pulls the image, waits for the service to start, then answers the record (`services/postgres.ts:147`).
- `postgres.one`: GET with `postgresId*` (`postgres.ts:128`). The answer holds the password, the mounts, and the backups with their destination minus its keys.
- The internal URL is copied from `show-internal-postgres-credentials.tsx:67`. Both services join `dokploy-network` unless one is detached (`services/network.ts:363`).
- `destination.all`: GET (`destination.ts:117`). The answer holds `accessKey` and `secretAccessKey`.
- `backup.create`: POST (`backup.ts:83`), answering no body. Required: `schedule`, `prefix`, `destinationId`, `database`, `databaseType`.

**Line budget.** The dokploy `src/` counts 613 lines today, with a budget of 615 (structure test, on the AR0654 branch). `dokploy-command.ts` is at 192 lines. Estimates, to be named exactly in each merge's outcome:
- T4a: `dokploy-source.ts` (about 75 lines) plus about 5 lines in `dokploy-command.ts`, so about 695.
- T4b: `dokploy-postgres.ts` (about 100 lines). The argument parsing moves out of `dokploy-command.ts` into `dokploy-args.ts`, so that file stays green. Sharing the existing environment lookup and env setter costs about 8 lines. About 815 in all.
- T4c: about 35 lines in `dokploy-postgres.ts`, so about 850. If that file would pass 200 lines, the backup goes in its own `dokploy-backup.ts`.

## Not available directly
- **The internal connection URL.**
  - Dokploy has no call that returns it. Its panel builds it in the browser (`show-internal-postgres-credentials.tsx:67`). Its `${{...}}` env references only reach project and environment variables (`prepareEnvironmentVariables`, `utils/docker/utils.ts:459`), not a database's credentials.
  - Option 1: Arthur builds the same string the panel builds. Cost: about 1 line. Risk: if a later Dokploy changes the host or port scheme, the URL breaks; the fake records v0.30.10.
  - Option 2: the owner copies the URL from the panel into a chat or file. Cost: none in code. Risk: the password passes through a chat, which is what the ticket rules out.
  - Option 3: Arthur puts the URL in the Dokploy environment's shared env and the app references it as `${{environment.DATABASE_URL}}`. Cost: about 15 lines and one more write call. Risk: every service in that environment sees the password.
  - Recommendation: Option 1.
- **Deploy on push for plain Git.**
  - With a deploy key, Dokploy needs a webhook in the repository pointing to `<panel>/api/deploy/<refreshToken>` (`pages/api/deploy/[refreshToken].ts`). The `refreshToken` works as a secret. The dokploy plugin cannot reach GitHub: a plugin imports no other plugin.
  - Also, `sshKey.generate` hands the private key back to the caller, and `sshKey.create` needs it sent back along with the `organizationId`.
  - Option 1: GitHub app only. Cost: none extra. Risk: a repository outside GitHub cannot deploy from Git.
  - Option 2: also plain Git. Arthur makes and stores the key in Dokploy, and prints the public key for the owner to add as a deploy key. The owner copies the webhook URL from the panel himself. Cost: about 60 lines and one more ticket. Risk: the private key passes through Arthur's memory; the deploy-on-push step stays manual.
  - Option 3: plain Git with Arthur also creating the GitHub deploy key and webhook through the github plugin. Cost: new events between plugins, about 120 lines across two packages. Risk: the webhook token crosses a plugin boundary.
  - Recommendation: Option 1.

## Files
- `packages/dokploy/src/dokploy-source.ts` (T4a, new): `sourceApp(instance, id, { repo, branch, buildPath, github, replace }, next)`. It does the reads, the refusals, `saveGithubProvider` and the `autoDeploy` update.
- `packages/dokploy/src/dokploy-command.ts`:
  - T4a: the `source` verb, its flags and its usage line.
  - T4b: the argument parsing (`USAGE`, `TAKES`, `FLAGS`, the parsing loop and the shape check) moves to `dokploy-args.ts`. Adds the `postgres` verb, which takes `create <app> <name>`, `status <postgres>` or `backup <postgres>`. A Postgres id picks its instance the way an app id does (`pick`).
- `packages/dokploy/src/dokploy-args.ts` (T4b, new): `parseArgs(args)`, returning the verb, its words and its flags, or the usage error.
- `packages/dokploy/src/dokploy-postgres.ts`:
  - T4b, new: `createPostgres` and `postgresStatus`.
  - T4c: `backupPostgres`, or a new `dokploy-backup.ts` if this file would pass 200 lines.
- `packages/dokploy/src/dokploy-env.ts` (T4b): the set path of `envCommand` becomes an exported `setVariable(instance, item, id, name, value, hide, next)` that takes the app already read. `env set` and `postgres create` both call it. `env set`'s behavior stays the same.
- `packages/dokploy/src/dokploy-setup.ts` (T4b): the project and environment lookup inside `createApp` is not needed. `postgres create` takes the app's own `environmentId`, so this file stays as it is.
- `packages/dokploy/src/dokploy-api.ts` (T4a): the comment on `ID` ("the only text a command puts into a query") now also names the checked `owner`, `repo` and `githubId`.
- `packages/dokploy/src/dokploy.ts`: its header comment names the new verbs.
- `packages/dokploy/test/fake-dokploy.ts`:
  - T4a: new routes:
    - `github.githubProviders`, `github.getGithubRepositories` and `github.getGithubBranches`, in GitHub's documented repository and branch shape;
    - `application.saveGithubProvider` and `application.update`, each with its `REQUIRED` list.
    - `FakeApp` gains `owner`, `repository`, `branch`, `buildPath`, `githubId`, `triggerType`, `autoDeploy`, `watchPaths`, `serverId`, `detachDokployNetwork`. `application.one` answers the `github` record minus its 3 secrets once one is set.
  - T4b: `environment.one`, `postgres.create`, `postgres.deploy` and `postgres.one`, the password checked against Dokploy's regex.
  - T4c: `destination.all`, with its keys added to `SECRETS`, and `backup.create`.
- `packages/dokploy/test/dokploy-shapes.json`, `fake-shapes.test.ts`: the shape of each new answer, recorded from v0.30.10 and from docs.github.com.
- `packages/dokploy/test/dokploy-source.test.ts` (T4a), `dokploy-postgres.test.ts` (T4b, T4c): new.
- `packages/dokploy/docs/commands/dokploy.md`: the usage line, new sections "From Git" and "A database", the refusals and the errors.
- `packages/dokploy/docs/dokploy.md`: the owner's part: the GitHub app, the panel reachable from GitHub, a shared provider, an S3 destination.
- `packages/orchestration/roles/coordinator.md`: the dokploy line names `source` and `postgres`, each run only on the owner's word.
- `test/structure.test.ts`: the `dokploy` budget, raised per ticket.
- `README.md`, `spec/roadmap.md` (entry 113), `spec/vision.md` (the dokploy row, in T4c): name the Git source and Postgres.

## Risks
- **The password or URL printed or kept.**
  - `hide` covers them on every call that carries them.
  - The answers that hold them are read by named fields only.
  - Tests check stdout and stderr for the generated password, which they take from the request the fake saw, and for every entry in `SECRETS`.
- **An existing `DATABASE_URL` overwritten.** Refused before anything is created; `--env` picks another name.
- **A Postgres made but the app left unconnected after a failure.** The env is written before the slow deploy. A second run finds the database by name and writes the URL from `postgres.one`.
- **`postgres.deploy` takes longer than `timeoutSeconds`** (image pull, waiting for the service). The created line and the id print first; the error names `postgres status`. The docs say to raise `timeoutSeconds` for a first pull.
- **Switching an app's source drops its earlier source.** `--replace-source` is required once the app has deployments, the same rule as `upload`.
- **A Dokploy that only creates on remote servers (`remoteServersOnly`)** answers 401 "You need to use a server…". `call()` turns a 401 into "the token … was refused" followed by Dokploy's message. The database takes the app's `serverId`, so this only happens for an app on the main server; the docs name the case.
- **`apiSaveGitProvider` and zod `.required()`** read differently in zod 3 and zod 4. Not used here (Option 1). Each body sends every key Dokploy's panel sends, so either reading passes.
- **`dokploy-command.ts` past 200 lines.** The parsing split happens in T4b, before the `postgres` verb lands.
- **AR0654 not merged.** T4a starts only after it merges.

## How to test
- **Git source, deploy on push, branch, build path (T4a):** `dokploy-source.test.ts` against the fake.
  - The exact `saveGithubProvider` body, with `triggerType` `push`.
  - `application.update` sent only when `autoDeploy` is false.
  - `already set` sends nothing.
  - Each refusal: bad `--repo`, `--branch` or `--build-path` with no request seen; no GitHub app; several without `--github`; an unknown name; a repository the app cannot see; a missing branch; another source with deployments, with and without `--replace-source`.
- **Database kind, version, volume, internal URL, deploy (T4b):** `dokploy-postgres.test.ts`.
  - The order of requests the fake saw: `application.one`, `environment.one`, `postgres.create`, `application.saveEnvironment`, `postgres.deploy`.
  - `dockerImage` is `postgres:18`, or `postgres:16` with `--version 16`.
  - The env line equals `postgresql://postgres:<password sent>@<appName from the answer>:5432/postgres`, and every other env line is kept.
  - A second run with everything in place writes nothing; one with the env missing writes it from `postgres.one`.
  - A deploy that times out (`scripted` `hang`) still has the created line printed.
  - `status` shows the volume and `<appName>:5432`.
- **The secret path:**
  - The password is 64 hex characters and differs between two runs.
  - It never appears in stdout or stderr, and neither does anything in `SECRETS`.
  - A 400 from Dokploy that quotes the password prints `[hidden]`.
- **Backups (T4c):**
  - The exact `backup.create` body, with `enabled` true.
  - An unknown destination and a backup already set are refused with no write.
  - A bad `--schedule` or `--keep` sends no request.
  - The destination's keys are never printed.
- **Each refusal:** the reviewer removes each refusal by hand and checks a test fails.
- **The fake matches the documented shapes:** `fake-shapes.test.ts` covers every new route.
- **Owner's part:** `docs/dokploy.md` reviewed against this plan.
- **Line budget:** `npm run check` and `npm test`, with `test/structure.test.ts` at the new budget, and each raise named in outcome.md.
- **Dokploy calls:** the reviewer checks each body against the v0.30.10 files listed in Approach. No real Dokploy server is called.

## Open questions
- **Git source.** GitHub app only, or also plain Git with a deploy key, where Arthur prints the public key and the owner adds it and the webhook in GitHub himself? Recommendation: GitHub app only. Push deploys then need no per-repository setup, and no private key passes through Arthur.
- **Database kinds.** Postgres only now, or MySQL, MariaDB, Mongo and Redis too? Recommendation: Postgres now. Each other kind is a later small ticket that reuses `dokploy-postgres.ts`: the panel's URL forms are known, MySQL and MariaDB need a root password, Redis has no backups.
- **Backups.** Build T4c now, which needs an S3 destination in Dokploy, or leave them to the panel? Recommendation: build it now; a database without backups is one lost disk away from lost data.
- **Database user and name.** Dokploy's panel defaults, `postgres` and `postgres` (a superuser), or both taken from `<name>`? Recommendation: the panel's defaults, so what Arthur makes looks the same as what the owner makes by hand.