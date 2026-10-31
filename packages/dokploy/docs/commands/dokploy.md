# arthur dokploy

Usage: `arthur dokploy apps [--instance <name>]`; `arthur dokploy app [<app>] [--instance <name>]`; `arthur dokploy status [<app>] [--instance <name>]`; each with `--project <name>` for another project than the main one.

The `dokploy` plugin reads the owner's Dokploy servers (AR0588): their projects, applications and deployments, on the instance a call names or a project's piece, `dokploy.project({ instance?, app })`, picks. Every call goes to `<url>/api/<procedure>` of the instance's configured `url`, with its token as the `x-api-key` header; a redirect is never followed, so the token goes nowhere else. Uploading and deploying come with AR0588's second ticket.

Only the coordinator runs it: inside a job the command is refused before it acts (`arthur dokploy: refused inside a job <id>: ...`), and a job's CLI reads no env file, so the token is not there either.

## Reading

- `apps`: every project of every instance, under a heading `instance <name>` (`instance (unnamed)` for the unnamed one), a blank line between two instances; with `--instance`, only that instance's. Each project is `project <name>`, then each environment, `  environment <name>`, then its applications, one line each: `    <applicationId> <name> (<applicationStatus>)`. A project or an environment without applications is still listed, with `: no applications` after it; an instance without projects says `no projects`. A server that answers the applications right under each project, as the example of Dokploy's documentation shows, gets them right under the project. An instance that fails prints its error line on stderr under its heading, the others still print, and the exit code is 1. Dokploy: `GET /api/project.all` ([Dokploy API](https://docs.dokploy.com/docs/api), [project](https://docs.dokploy.com/docs/api/project)).
- `app [<app>]`: one application: its name, id and instance; its project and environment; its `sourceType` and `applicationStatus`; its domains as URLs (`https://shop.example/admin`), or `none`; its last deployment by `createdAt`, as `status` prints one, or `none`. Nothing else: never its env, build args or secrets, preview env, git refresh token, registry password or server. Dokploy: `GET /api/application.one?applicationId=<app>` ([application](https://docs.dokploy.com/docs/api/application), "Application one").
- `status [<app>]`: `<name> (<id>) on instance <name>: <applicationStatus>`, then the 5 newest deployments by `createdAt`, one line each, `<status>: <title>, started <time>, finished <time>` (`not yet` for a time Dokploy has not set), then Dokploy's error message of that deployment when it has one, each of its lines after `  > `: what Dokploy said, as data; `no deployments` when there is none. Dokploy: `application.one`, then `GET /api/deployment.all?applicationId=<app>` ([deployment](https://docs.dokploy.com/docs/api/deployment), "Deployment all").

Control characters in Dokploy's text are dropped before it is printed; a field a server leaves out prints `unknown`.

## Which app, on which instance

- Without `<app>`: the application of the project's `dokploy.project(...)`, the project `--project` names, else the main one, on the instance it names, else the unnamed one. `--instance` may be given only when it names that same instance.
- With `<app>`, an application id (1 to 64 letters, digits, `_` and `-`, as `apps` prints it): on the instance `--instance` names; without `--instance`, on the instance of the `--project` project's `dokploy.project(...)`; else on the only instance.
- `--instance` takes an instance's name; the unnamed instance has none, so it is reached through a project that names no instance, or as the only instance.
- `apps` reads every instance unless `--instance` names one.

## Refusals

Each comes before any request, exits 1, and ends `nothing was asked of Dokploy`:

- `--instance <name>` that is no instance of dokploy: `--instance acme is not an instance of dokploy; its instances: (unnamed), client`;
- several instances and a call that names none (`<app>` given without `--instance`, and no `--project` whose `dokploy.project(...)` gives an instance): `dokploy has 2 instances ((unnamed), client) and the call names none: add --instance <name>, or --project <name> of a project with dokploy.project(...)`;
- without `<app>`, an `--instance` other than the one the project's piece names: `--instance client is not instance (unnamed), which project shop's dokploy.project(...) names`;
- without `<app>`, a project without `dokploy.project(...)`: `project blog has no dokploy.project(...): give the app's id, or --project <name>; projects with one: shop, client`;
- an `<app>` that is no application id: `the app is not a Dokploy application id: 1 to 64 letters, digits, _ and -`.

Wrong usage (an unknown verb, a word too many, `--instance` without a name or given twice, another flag) prints the usage line and exits 2.

## Errors from Dokploy

One line, exit 1, naming the instance; the token is never in it (`[token]` where Dokploy echoed it):

- 401: `instance client: 401: the token in ARTHUR_DOKPLOY_CLIENT_TOKEN was refused: Unauthorized`;
- 403: `instance client: 403: the token's user may not read app kXx3...: <Dokploy's message>`;
- 404: `instance client: 404: app kXx3... not found` (the id may be on another instance);
- any other status, 400 and 500 among them: `<status> for <what>: <Dokploy's message>`;
- no answer within `timeoutSeconds`: `no answer in 60 s from <url> for <what>`;
- no server: `cannot reach <url> for <what> (ECONNREFUSED)`;
- a redirect: `<url> answered <what> with a redirect, which is not followed: the token goes only to the configured url`;
- an answer that is not JSON: `the answer for <what> is not JSON`.

The plugin's options and its refusals at load are in [`../dokploy.md`](../dokploy.md).
