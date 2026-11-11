# The dokploy plugin

The owner's Dokploy servers (AR0588), one entry per server, named or unnamed, each with its address and the variable holding its API key, so no key passes through a chat; a project picks its server and application with its piece, `dokploy.project({ instance?, app })` in its project file. `arthur dokploy apps|app|status` reads each server's projects, applications and deployments; `arthur dokploy upload|deploy` sends an application a file or folder or starts its deploy (AR0603); `arthur dokploy create|setup|env` creates an application and sets its build type, domain, volume and environment (AR0654); `arthur dokploy source` connects an application to its GitHub repository, so a push to its branch deploys it (AR0680); `arthur dokploy postgres create|status` makes a Postgres beside an application, its URL in the application's env, and shows it (AR0681); `arthur dokploy postgres backup` schedules its backups to an S3 destination (AR0682); each write on the owner's word. Only the coordinator runs it; a job never does. A token never appears in an error, and an env value, a database password or a destination's S3 keys never in the output.

```ts
// arthur.config.ts
dokploy({
	instances: [
		{ url: "https://dokploy.example.com", tokenEnv: "ARTHUR_DOKPLOY_TOKEN" },
		{ name: "client", url: "https://panel.client.example", tokenEnv: "ARTHUR_DOKPLOY_CLIENT_TOKEN" },
	],
}),

// projects/shop/project.config.ts
export default [
	projects.project({ prefix: "SH", path: "../../shop" }),
	dokploy.project({ instance: "client", app: "kXx3shopWeb01" }), // `instance` left out: the unnamed one
];
```

It needs the `projects` plugin, which sets up first.

## Options

- `instances`: the Dokploy servers, at least one, each `{ name?, url, tokenEnv }`, at most one without a name, each name once. `name` is the one a project's `dokploy.project({ instance })` and `--instance` give: lowercase letters, digits and single dashes, from a letter. `url` is the server's address as Dokploy's panel answers on it (`https://dokploy.example.com`, or under a path, `https://host/dokploy`); calls go to `<url>/api/<procedure>` and nowhere else. `tokenEnv` names the variable holding an API key of the Dokploy user Arthur acts as (Dokploy: Settings, Profile, API/CLI), one that may create deployments for `upload` and `deploy`, and services, domains, volumes and env for `create`, `setup`, `env` and `postgres create`, change a service's source for `source`, and read the destinations and create backups for `postgres backup`: `ARTHUR_DOKPLOY_TOKEN` for the unnamed instance, `ARTHUR_DOKPLOY_<INSTANCE>_TOKEN` for a named one, as `arthur config check` holds every `...Env` name.
- `timeoutSeconds`: how long one call to Dokploy may take before it is given up. Default 60, at most 600. `postgres create` waits for its deploy, which pulls the image first: the first database on a server may need more.

`url` is `https` to any host; `http` only on loopback, a private or a Tailscale address (`localhost`, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10, `::1`, fc00::/7, a `*.ts.net` name; never the cloud metadata addresses inside them), since elsewhere the key would cross the network in plain text. A panel only at `http://<public address>:3000` is refused until it has a domain with TLS or is reached over Tailscale.

## A GitHub app, once per server

`arthur dokploy source` connects an app through a GitHub app of Dokploy; Arthur never creates one, and holds no GitHub key or webhook. The owner sets it up once per Dokploy server:

- In the Dokploy panel, Settings, Git providers, "Create GitHub App": the panel creates the app on his GitHub account or organisation. He then installs it on the repositories it should see (GitHub, Settings, GitHub Apps, Configure); `source` refuses a repository it does not see.
- The app's webhook is `<the panel's address>/api/deploy/github`, so the panel must be reachable from GitHub over the internet: an instance reached only over Tailscale or a private address gets no push deploys, and `arthur dokploy deploy` stays the way to deploy there.
- The GitHub apps the token's user may use are the ones `source` sees: all of the organisation's for its owner or an admin; for a plain member, the ones he created and the ones shared with the organisation (its "Share with entire organization" switch in the panel's Git providers).
- Several GitHub apps on one server: `source` takes `--github <name>`, the name the panel shows.

## A database

`arthur dokploy postgres create` puts the database on the server the application runs on. A Dokploy whose web server settings create services on remote servers only (`remoteServersOnly`) refuses a database for an application on its main server: `401: the token in ARTHUR_DOKPLOY_TOKEN was refused: You need to use a server to create a Postgres`; the application then belongs on a remote server first.

`arthur dokploy postgres backup` sends the backups to an S3 destination of the Dokploy server, which the owner adds once: in the Dokploy panel, Settings, Destinations, with the bucket, its region and endpoint and an access key that may write to it. Dokploy's list of destinations holds their keys; Arthur reads only each one's name and id and never prints a key. Restoring a backup is done in the panel.

## Refused at load

Each names the option, never the value it holds:

- `instances[1].url: expected an https url, or an http one on loopback, a private or a Tailscale address (...), without a user, query or fragment; the url given is not shown`;
- `instances[1]: instances[0] has no name either; at most one instance is unnamed`; `instances[2].name: client is the name of instances[0] too`;
- `instances[0].tokenEnv: ARTHUR_DOKPLOY_TOKEN is empty or holds a space or a character outside ASCII, which a header cannot carry`;
- a project's piece, naming the project and the helper: `project shop: dokploy.project(...): its instance is not an instance of dokploy; dokploy's instances: (unnamed), client`, `... it names no instance and dokploy has no unnamed one; ...`, `... app is not a Dokploy application id: 1 to 64 letters, digits, _ and -`, `... expected { instance?, app }, each a string`.

A variable that is not set refuses the start, naming the option and the variable, as for every plugin (`arthur config check`); inside a job, whose CLI reads no env file, the plugin is not loaded at all.

Its page, what `arthur dokploy --help` prints, is [`commands/dokploy.md`](commands/dokploy.md), with every verb, its output and its refusals.
