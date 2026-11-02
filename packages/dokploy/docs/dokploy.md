# The dokploy plugin

The owner's Dokploy servers (AR0588), one entry per server, named or unnamed, each with its address and the variable holding its API key, so no key passes through a chat; a project picks its server and application with its piece, `dokploy.project({ instance?, app })` in its project file. `arthur dokploy apps|app|status` reads each server's projects, applications and deployments. Only the coordinator runs it; a job never does. A token never appears in an error.

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

- `instances`: the Dokploy servers, at least one, each `{ name?, url, tokenEnv }`, at most one without a name, each name once. `name` is the one a project's `dokploy.project({ instance })` and `--instance` give: lowercase letters, digits and single dashes, from a letter. `url` is the server's address as Dokploy's panel answers on it (`https://dokploy.example.com`, or under a path, `https://host/dokploy`); calls go to `<url>/api/<procedure>` and nowhere else. `tokenEnv` names the variable holding an API key of the Dokploy user Arthur reads as (Dokploy: Settings, Profile, API/CLI): `ARTHUR_DOKPLOY_TOKEN` for the unnamed instance, `ARTHUR_DOKPLOY_<INSTANCE>_TOKEN` for a named one, as `arthur config check` holds every `...Env` name.
- `timeoutSeconds`: how long one call to Dokploy may take before it is given up. Default 60, at most 600.

`url` is `https` to any host; `http` only on loopback, a private or a Tailscale address (`localhost`, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10, `::1`, fc00::/7, a `*.ts.net` name; never the cloud metadata addresses inside them), since elsewhere the key would cross the network in plain text. A panel only at `http://<public address>:3000` is refused until it has a domain with TLS or is reached over Tailscale.

## Refused at load

Each names the option, never the value it holds:

- `instances[1].url: expected an https url, or an http one on loopback, a private or a Tailscale address (...), without a user, query or fragment; the url given is not shown`;
- `instances[1]: instances[0] has no name either; at most one instance is unnamed`; `instances[2].name: client is the name of instances[0] too`;
- `instances[0].tokenEnv: ARTHUR_DOKPLOY_TOKEN is empty or holds a space or a character outside ASCII, which a header cannot carry`;
- a project's piece, naming the project and the helper: `project shop: dokploy.project(...): its instance is not an instance of dokploy; dokploy's instances: (unnamed), client`, `... it names no instance and dokploy has no unnamed one; ...`, `... app is not a Dokploy application id: 1 to 64 letters, digits, _ and -`, `... expected { instance?, app }, each a string`.

A variable that is not set refuses the start, naming the option and the variable, as for every plugin (`arthur config check`); inside a job, whose CLI reads no env file, the plugin is not loaded at all.

Its page, what `arthur dokploy --help` prints, is [`commands/dokploy.md`](commands/dokploy.md), with every verb, its output and its refusals.
