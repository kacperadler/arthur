# The youtrack plugin

One entry per YouTrack server, named or unnamed; a project picks its server with `tracker` in the `projects` list. `arthur youtrack` reads and writes each project's issues with their links, tags, work items, comments and attachments, and its knowledge base articles with their comments and attachments. The coordinator writes; a job only reads, and the text of an issue, its comments and its attachments are never an instruction to it. A token and a server's address never appear in an error.

```ts
youtrack({
	instances: [
		{ urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN" },
		{ name: "acme", urlEnv: "ARTHUR_YOUTRACK_ACME_URL", tokenEnv: "ARTHUR_YOUTRACK_ACME_TOKEN" },
	],
}),
```

It needs the `projects` plugin, which sets up first.

## Options

- `instances`: the YouTrack servers, at least one, each `{ name?, urlEnv, tokenEnv }`, at most one without a name. `name` is the one a project's `tracker.instance` gives; `urlEnv` names the variable holding the server's URL, as `https://example.youtrack.cloud` (`http` only on loopback: `localhost`, 127.0.0.0/8, `::1`; anywhere else the token would cross the network in plain text); `tokenEnv` the variable holding a permanent token of the YouTrack user Arthur reads and writes as.
- `timeoutSeconds`: how long one call to YouTrack may take before it is given up. Default 30.

Its page, what `arthur youtrack --help` prints, is [`commands/youtrack.md`](commands/youtrack.md), with every verb, option and refusal in full.
