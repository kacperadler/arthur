# AR0588 - Plan

- Job: 2026-10-30-plan-9b4df51b
- Planned at: 6f30c0e4891b6e36fe034c7be9ce025ba0cc2f6a

## Approach
This plan adds a new plugin, `packages/dokploy` (`@arthur/dokploy`), built on the same pattern as `youtrack` and `github`: named instances, a token held in an env variable, and a single `arthur dokploy` command that both reads and writes. The coordinator gets a repeatable way to deploy, and no token goes through a chat again. Where Dokploy gives no direct way to do something, the plan follows the recommended option below.

**Config.** Following AR-D389, a project keeps its Dokploy settings in its own entry of the projects list:

```ts
dokploy({ instances: [
	{ url: "https://dokploy.example.com", tokenEnv: "ARTHUR_DOKPLOY_TOKEN" },
	{ name: "client", url: "https://panel.client.example", tokenEnv: "ARTHUR_DOKPLOY_CLIENT_TOKEN" },
] }),
projects({ list: [{ name: "shop", prefix: "SH", path: "../shop", dokploy: { instance: "client", app: "kXx3…" } }] }),
```

- **Instances.** Each instance is `{ name?, url, tokenEnv }`, set in the dokploy plugin's own section. At most one instance may leave out its name. Options are checked the way youtrack and github check theirs. The core already holds `tokenEnv` to `ARTHUR_DOKPLOY_TOKEN` / `ARTHUR_DOKPLOY_<INSTANCE>_TOKEN` (`nameProblem` in `packages/core/src/env.ts`), so the plugin needs no code for that.
- **URL rule.** `url` sits in the config as the ticket asks, not in an env variable as youtrack does.
  - Allowed: `https` to any host. `http` only on loopback, RFC 1918 or Tailscale (100.64.0.0/10, `*.ts.net`), the same blocklist `packages/models/src/model-options.ts` uses. The code is short and copied, because a plugin may not import another plugin.
  - Refused: a user, a query or a fragment in the URL. A path is allowed, and calls go to `<url>/api/<procedure>`.
- **The project's `dokploy` key.** `projects` checks only its shape, `{ instance?, app }`, with one line in `FIELDS`, as it already does for `tracker` and `ci`. The dokploy plugin reads it through `host.collect("projects")` (as `youtrack.ts` reads `tracker`) and checks it at setup:
  - the instance it names exists, or an unnamed instance exists when it names none;
  - `app` is a Dokploy id.
  - A refusal names the project and the option, never a value.

**Commands.** All calls send `x-api-key: <token>`, use `redirect: "error"`, and have a timeout. All are documented in one page, `docs/commands/dokploy.md`, one section per verb; the registry gives one doc page per command name.

| Command | Reads or writes | Dokploy call | Doc page |
| --- | --- | --- | --- |
| `apps` | reads | `GET /api/project.all`, once per instance (all instances, or the one `--instance` names) | https://docs.dokploy.com/docs/api (example) and /docs/api/project |
| `app [<app>]` | reads | `GET /api/application.one?applicationId=` | /docs/api/application, "Application one" |
| `status [<app>]` | reads | `application.one` and `GET /api/deployment.all?applicationId=` | /docs/api/deployment, "Deployment all" |
| `upload [<app>] <file or folder> [--replace-source]` | writes | `application.one` (a read before writing), then `POST /api/application.dropDeployment` as multipart: `applicationId`, `zip`, `dropBuildPath` | /docs/api/application, "Application drop Deployment" |
| `deploy [<app>]` | writes | `POST /api/application.deploy {applicationId}` | /docs/api/application, "Application deploy" |

What each command prints:
- **`apps`:** every project with its environments and its applications under a heading `instance <name>`, one line per application: `<applicationId> <name> (<applicationStatus>)`. A project with no applications is still listed. One instance failing prints its error line, the others still print, and the exit code is 1.
- **`app`:** only these fields:
  - its name and id, and the instance;
  - its project and environment;
  - `sourceType`, `applicationStatus`, and its domains as URLs;
  - its last deployment.

  Never `env`, `buildArgs`, `buildSecrets`, `previewEnv`, `refreshToken`, registry passwords or anything about the server.
- **`status`:** the `applicationStatus`, then the last 5 deployments, sorted by the plugin on `createdAt`: status, title, start and end time. Dokploy's `errorMessage` follows after `> `, as data.
- **`upload`:** the number of files and bytes sent, and the next step: `arthur dokploy status <id>`.
- **`deploy`:** that the deployment was queued, and the same next step.

**Which app, which instance.** Every verb takes `--instance <name>` and `--project <name>`.
- **`<app>` left out:** the command uses the project's `dokploy.app` and its instance. The project is the one `--project` names, else the main one. `upload` with one word takes that word as the path.
- **`<app>` given:** an id matching `^[A-Za-z0-9_-]{1,64}$`. The instance is the one `--instance` names. Without `--instance` it is the `--project` project's instance, else the only instance.
- **Refused as ambiguous:** several instances set and none named this way. `apps` is the one exception: without `--instance` it lists every instance.

**Refusals before any call** (exit 1, ending `nothing was asked of Dokploy`):
- an unknown `--instance`, or the ambiguous call above;
- a `--instance` other than the one the project names, when the project's app is used;
- an `<app>` that is not an id;
- no `<app>` and a project without a `dokploy` key;
- for `upload`:
  - a path that is missing or unreadable;
  - an empty folder;
  - a symlink or special file inside the folder, named by its relative path (never followed);
  - more than 65535 entries, or a file or a zip of 4 GiB or more.

Wrong usage prints the usage and exits 2.

**Refusal after the read, before the write (`upload`).** Dokploy's `dropDeployment` switches the app's `sourceType` to `drop` and sets its `dropBuildPath` to `""` when none is sent (Dokploy source, `apps/dokploy/server/api/routers/application.ts` at v0.30.10). So `upload` reads the app first:
- it sends the app's current `dropBuildPath` back, so the owner's setting is not wiped;
- it refuses an app that has deployments and deploys from another source (`github`, `git`, `docker`, …), unless `--replace-source` is given.

**Upload contents.** A `.zip` file (starting with `PK\x03\x04`) goes as it is. Any other file, or a folder, is zipped in memory by the plugin (see Not available directly). A folder's contents go at the zip's root, which is what Dokploy's `unzipDrop` expects.

**Errors from Dokploy** are one line naming the instance, read from Dokploy's error body `{ code, message, issues }`:
- 401: the token in `<variable>` was refused;
- 403: the token's user may not do this;
- 404: app `<id>` not found on that instance;
- 400 or 500: Dokploy's message;
- no answer in time, or the server cannot be reached;
- a redirect, which is not followed, because the token goes only to the configured URL;
- an answer that is not JSON.

The token is replaced by `[token]` in every error line. Control characters are stripped from all Dokploy text. A write that got no answer may still have been made, and the doc page says so. `timeoutSeconds` defaults to 60 (maximum 600), because `dropDeployment` unzips the upload before it answers.

**Writes need the owner's word, as GitHub's and YouTrack's do.**
- `orchestration/roles/coordinator.md` gets two lines next to the YouTrack and GitHub lines (39–42): how to look (`arthur dokploy apps|app|status`), and "upload or deploy (`arthur dokploy --help`) only when the owner asks, and say in the reply what went to which app on which instance".
- No `--decision` gate, matching GitHub and YouTrack.

**Jobs: none; the coordinator only.** The command does not declare `inJob`, so `packages/core/src/cli.ts` refuses every verb inside a job. Inside a job the plugin is not even loaded anyway: a job reads no env file, so its token variable is unset there (`packages/core/docs/commands/config.md`, line 16). Preview uploads from a worker would need the token inside the sandbox, which the vision's env guard rules out.

**Left alone:**
- managing the Dokploy server itself (installing it, its users, its domains);
- Dokploy's compose and database services;
- `redeploy`, stop, start and logs;
- the core;
- youtrack and github.

**Cost:**
- **Code:** about 420 lines of `src/` under a proposed budget of 450 (the first budget of a new package is the owner's decision). Two lines in `projects`, whose `src/` is at its 482-line budget today, so that budget goes to 484 and the raise shows in that merge's outcome.md. Two lines in the coordinator role. No runtime dependency.
- **Tests and fixtures:** a fake Dokploy, a shapes file and tests, about 700 lines outside the budget.
- **Tickets:** two sequential ones, each a worker run and a review on the local machine.

## If settings stay in per-plugin sections
If the owner picks per-plugin sections keyed by project name in AR0589, three things change:
- **Config:** the project's settings move into `dokploy({ instances, projects: { shop: { instance: "client", app: "kXx3…" } } })`.
- **Checks:** at setup the plugin refuses a key that is not a project of the list, the way `packages/uptime/src/uptime.ts` refuses `sites` today. `packages/projects` is not touched: no `FIELDS` line and no budget raise.
- **Docs:** the example and the options table in the docs move with it.

The commands, how an instance is picked, the refusals, the API calls, the fake and the tests stay the same. Only where the setting is read from changes, one function in `dokploy.ts`.

## Not available directly
- **The Dokploy documentation does not show what a successful call answers.** The API pages and `https://docs.dokploy.com/openapi.json` give `{}` as the 200 answer of `project.all`, `application.one`, `deployment.all`, `deploy` and `dropDeployment`. I checked the schemas: each is `"properties": {}`. The one example, `project.all` on `/docs/api`, is an older shape: applications directly under the project, plus database records with plaintext passwords. Dokploy v0.30.10 (latest, 2026-10-22) answers `projects[].environments[].applications[{ applicationId, name, applicationStatus }]` (source: `apps/dokploy/server/api/routers/project.ts`). So "the fake answers in the shape Dokploy's API documentation shows, with every field" cannot be met from the documentation alone.
  - Option 1: record the fake's shapes in `test/dokploy-shapes.json` from both sources, each with its `source` and `recorded` day. The `/docs/api` example verbatim, and the v0.30.10 shapes from Dokploy's source at that tag: `packages/server/src/db/schema/application.ts` and `deployment.ts` for the columns, and `findApplicationById` in `services/application.ts` for the related records. The plugin reads both `project.all` forms. Cost: one JSON file and one line of reading; risk: the shapes go stale at a later Dokploy release.
  - Option 2: record the answers once from the owner's own server and redact them. Cost: needs his token during the work and redacting secrets by hand; risk: a missed secret ends up committed in a fixture.
  - Option 3: use only the documentation example. Cost: none; risk: the fake differs from every current server, so tests pass while a real call fails.
  - Recommendation: Option 1.
- **Node cannot write a zip, and `dropDeployment` takes only a zip.** Node's standard library has `zlib.deflateRawSync` and `zlib.crc32` (both present in Node v24.21.0 here) but no zip container. No `zip` binary is on this machine (`command -v zip` finds nothing), and none is among Arthur's requirements (Node and OMP).
  - Option 1: a small zip writer in the plugin, `src/dokploy-zip.ts`, about 70 lines: deflated entries and a central directory, no zip64, with the limits above refused. Cost: about 70 lines of the budget; risk: a format bug, caught by a read-back test and one real upload.
  - Option 2: run the system `zip` binary. Cost: a new tool requirement plus a doctor line; risk: it is missing on this VPS today.
  - Option 3: accept only a ready `.zip`. Cost: none; risk: the coordinator has no tool to make one, and "file or folder" is not met.
  - Recommendation: Option 1.

## Files
Ticket 1 (reads). Runs on the local machine: its JSON block gets `"machine": "local"` and the worker is spawned with `--machine local`. Its first step is `cd <checkout> && node_modules/.bin/arthur plugin new dokploy --budget 450 --root <worktree>`, where `<worktree>` is the worker's own.
- `packages/dokploy/package.json`, `test/structure.test.ts` (`dokploy: 450`), `package-lock.json`: written by `arthur plugin new`.
- `packages/dokploy/src/dokploy.ts`: the plugin (`requires: ["projects"]`). Setup builds the instances from `url` and the token value, and reads and checks each project's `dokploy` key. It registers the `dokploy` command, without `inJob`.
- `packages/dokploy/src/dokploy-options.ts`: `summary`, `table` and `checkOptions`, modelled on `youtrack-options.ts`, for `{ name?, url, tokenEnv }` and `timeoutSeconds`, plus the URL rule.
- `packages/dokploy/src/dokploy-api.ts`: `call(instance, procedure, query, what, body?)`. GET, POST JSON or multipart; `x-api-key`; `redirect: "error"`; the timeout; the one-line errors with the token redacted; `field()`. Modelled on `youtrack-api.ts`.
- `packages/dokploy/src/dokploy-command.ts`: argument parsing, picking the instance and the app, the refusals, and `apps`, `app`, `status` (ticket 2 adds `upload` and `deploy`).
- `packages/projects/src/project-options.ts`: one `FIELDS` line, `dokploy: { instance?, app }`, checked for shape only.
- `packages/projects/src/projects.ts`: `dokploy?` in `ProjectEntry`.
- `test/structure.test.ts`: `projects: 484`.
- `packages/projects/docs/commands/projects.md` [INFERENCE: the page the options file names as "The list"]: the `dokploy` key.
- `packages/dokploy/docs/dokploy.md`: options, the config example, refusals at load.
- `packages/dokploy/docs/commands/dokploy.md`: every verb with its Dokploy doc page, its output and its refusals.
- `packages/dokploy/test/fake-dokploy.ts`: a `node:http` server on a port the OS picks. It checks `x-api-key` and answers `project.all` (both forms), `application.one`, `deployment.all`, and later `application.deploy` and `application.dropDeployment`, which it parses with `Request.formData()`. It answers errors as `{ code, message, issues }`, can answer a redirect, and records every request.
- `packages/dokploy/test/dokploy-shapes.json`, `packages/dokploy/test/fake-shapes.test.ts`: the recorded shapes, with a drift check modelled on `packages/github/test/fake-shapes.test.ts`.
- `packages/dokploy/test/dokploy.test.ts`, `packages/dokploy/test/dokploy-options.test.ts`: behavior and refusals.

Ticket 2 (writes), after ticket 1:
- `packages/dokploy/src/dokploy-zip.ts`: the zip of a file or folder: regular files only, symlinks and special files refused, the format limits refused.
- `packages/dokploy/src/dokploy-command.ts`: `upload` (read the app, refuse a source switch unless `--replace-source`, keep `dropBuildPath`, send the multipart) and `deploy`.
- `packages/dokploy/docs/commands/dokploy.md`: the write sections.
- `packages/orchestration/roles/coordinator.md`: the two lines next to lines 39–42.
- `packages/dokploy/test/dokploy.test.ts`: upload and deploy tests, and a zip read-back helper in the fake.
- `README.md` (plugin list), `arthur.mmd` (a node in "Delivery and trackers"), `spec/vision.md` (a row `dokploy (named) | first | …` in the plugins table), `spec/roadmap.md` (an entry, the next free number, 103 today [INFERENCE: other plan tickets may take it first]).

## Risks
- **The token reaching someone else:** `x-api-key` goes only to the origin of the configured `url`. `redirect: "error"` keeps a redirect from carrying the header to another host; fetch forwards custom headers across origins, which is why redirects are not followed. `http` is refused outside loopback, private and Tailscale addresses. The token is redacted in error lines, and the core already redacts env values in logs and notices.
- **Printing Dokploy's secrets:** the documented `project.all` example holds database passwords, and `application.one` returns `env`, `buildSecrets` and `refreshToken`. The plugin prints only a fixed list of fields. A test feeds in the documented example and the full shape of `application.one`, and asserts that no secret value appears in any output.
- **Upload switching a working app's source, or wiping its build path:** the read before the write, the refusal without `--replace-source`, and `dropBuildPath` sent back.
- **The wrong server for an app:** an ambiguous call is refused before any request. When an id is used on another instance, that instance's 404 names the instance.
- **Dokploy's shapes changing between versions:** both `project.all` forms are read. Fields are read with `field()`, so a missing key prints `unknown`, not a crash. Ids are checked before they go into a query.
- **A zip format bug:** a test reads the archive back (central directory, local headers, `inflateRawSync`, CRC with `zlib.crc32`), plus one `unzip -t` run and one real upload during the smoke run.
- **AR0589 changing how projects keep plugin settings:** the `projects` line checks shape only, and only `dokploy.ts` reads it, so a switch to per-plugin sections is the one-function change described above.
- **A folder holding a `.env` or `.git` is uploaded as it is,** to the owner's own server. The coordinator chooses the path, and the output shows the number of files.

## How to test
- **Commands, their doc pages and refusals:** `dokploy.test.ts` runs the fake host against the fake Dokploy.
  - Each verb's output, both `project.all` forms included.
  - Each refusal before any call, with the fake's request log asserted empty.
  - Each Dokploy error (401, 403, 404, 400, timeout, unreachable, redirect, not JSON) as one line with `[token]`.
  - `upload` refusing a git-sourced app that has deployments, then going through with `--replace-source`; `dropBuildPath` kept.
  - `--help` prints `docs/commands/dokploy.md`.
- **Reads and writes, and writes only on the owner's word:**
  - The coordinator role holds the two lines.
  - Smoke run: in a job's home (a job record), `arthur dokploy apps` is refused by the core with exit 1.
  - Smoke run: without the token in the shell, the plugin is reported as not loaded.
- **Several named instances:**
  - Tests: `apps` lists each instance under its name, and only the named one with `--instance`.
  - A call with several instances and no name is refused.
  - The project's instance is used when `--project` is given; the unnamed instance when a project names none.
  - At load: two unnamed instances refused; a duplicate name refused; a project's `dokploy.instance` that is no instance refused; a malformed `app` refused.
  - A wrong `tokenEnv` name is refused by the core's env check (`arthur config check`).
- **Only the owner's servers, at the configured URL:** `dokploy-options.test.ts` refuses `http` on a public IP or name, and a user, query or fragment in the URL; it accepts `https`, and `http` on 127.0.0.1, 10.x, 100.64.x and `*.ts.net`. `dokploy.test.ts` asserts that the fake's redirect is not followed and that the second server it points to sees no request.
- **A job's part:** the in-job refusal from the smoke run above.
- **The fake answers in the documented shape, every field:** `fake-shapes.test.ts` compares every route of the fake against `dokploy-shapes.json`, at every depth.
- **Line budget and tickets:** `npm test` (the structure test, with `dokploy: 450` and `projects: 484`) and `npm run check`. The two tickets are as listed under Files.
- **End-to-end smoke run, ticket 2, on the owner's word:** with his token in the env file, on one of his instances:
  - `arthur dokploy apps`;
  - `arthur dokploy upload <app he names> <a one-page folder>`;
  - `arthur dokploy status <app>` until `done`;
  - the page opened at its domain.

## Open questions
- Does each of your Dokploy servers answer on `https`? The plan refuses `http` except on loopback, private and Tailscale addresses, so a panel only at `http://<public IP>:3000` would be refused until it gets a domain with TLS or is reached over Tailscale.
- For `upload` to an app that deploys from Git or Docker and has deployments, is refusing it unless `--replace-source` is given what you want, or should such an upload always be refused?
- Is 450 lines the budget you want for the new dokploy plugin?