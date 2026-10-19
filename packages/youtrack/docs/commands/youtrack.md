# arthur youtrack

Usage: `arthur youtrack issue list`; `arthur youtrack issue get <id>`; `arthur youtrack article list`; `arthur youtrack article get <id>`; each with `--project <name>` for another project than the main one. Comes with the `youtrack` plugin.

The `youtrack` plugin reads each project's YouTrack (roadmap entry 44): its issues and its knowledge base articles, from the server its `tracker` picks. It only reads; nothing here writes to YouTrack.

- `issue list`: every issue of the project's YouTrack project, newest update first, one line each: `SHOP-12 Summary`, with ` (resolved)` after a resolved one; `no issues in YouTrack project SHOP` when there is none.
- `issue get <id>`: one issue: `SHOP-12: Summary`, its reporter and the days it was created and updated, when it was resolved (or `no`), each custom field as `Name: value` (`none` when empty, a list joined by commas), then its description.
- `article list`: every article of the project, one line each: `SHOP-A-3 Title`.
- `article get <id>`: one article: `SHOP-A-3: Title`, its reporter and days, its parent article when it has one, then its content.

A list is read page by page, 100 items a page (`$top` and `$skip`), until a page holds fewer, so nothing is cut at the server's default of 42. Dates are UTC days. Control characters in the tracker's text are dropped before it is printed.

## Options

In `youtrack({ ... })` in `arthur.config.ts`; it needs the `projects` plugin, which sets up first:

| Option | Meaning |
| --- | --- |
| `instances` | Required, a list of at least one YouTrack server, each `{ name?, urlEnv, tokenEnv }`. |
| `instances[].name` | The instance's name, which a project's `tracker.instance` gives: lowercase letters, digits and single dashes, from a letter. At most one instance has no name: the unnamed one, which a tracker without `instance` uses. |
| `instances[].urlEnv` | The variable holding the server's URL: `https://example.youtrack.cloud`, or the URL of a server under a path (`https://host/youtrack`). The unnamed instance's is `ARTHUR_YOUTRACK_URL`, a named one's `ARTHUR_YOUTRACK_<NAME>_URL`. |
| `instances[].tokenEnv` | The variable holding a permanent token of the YouTrack user Arthur reads as (`ARTHUR_YOUTRACK_TOKEN`, `ARTHUR_YOUTRACK_<NAME>_TOKEN`), sent as `Authorization: Bearer <token>`. |
| `timeoutSeconds` | How long one call may take before it is given up: above 0, at most 300. Default 30. |

```ts
youtrack({
	instances: [
		{ urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN" },
		{ name: "acme", urlEnv: "ARTHUR_YOUTRACK_ACME_URL", tokenEnv: "ARTHUR_YOUTRACK_ACME_TOKEN" },
	],
}),
```

A project picks its server with `tracker` in the `projects` list: `{ plugin: "youtrack", project: "SHOP" }` uses the unnamed instance, `{ plugin: "youtrack", instance: "acme", project: "SHOP" }` the instance `acme`. `project` is the YouTrack project's id, the prefix of its issue ids. A project without a `youtrack` tracker is not read.

Refused at load, naming the option's path (by `arthur config check` too): an option or key it does not take; no `instances`, an empty list, or an entry that is not an object; a `name` of other characters, or two instances of one name; two instances without a name; a missing or empty `urlEnv` or `tokenEnv`; a `timeoutSeconds` that is not a number above 0 and at most 300.

Refused at load, naming the project or the option, never a variable's value: a project whose `tracker.instance` is not an instance here, or whose tracker names none while every instance has a name (`project web-shop: tracker.instance acme is not an instance of youtrack; youtrack's instances: (unnamed), main`); a `tracker.project` that is not a YouTrack project id (a letter, then letters, digits and underscores); a URL variable that does not hold an `http` or `https` URL, or holds one with a user, a query or a fragment; a token variable that is empty or holds a space or a character outside ASCII.

## Refusals and errors

Each is one line on stderr, `arthur youtrack: <line>`, and exit code 1; wrong usage prints the usage line and exits 2.

- Refused before any call to YouTrack: an id that is not an issue id (`SHOP-12`) or an article id (`SHOP-A-3`), and an id of another YouTrack project than the project's tracker names (`SITE-4 is outside YouTrack project SHOP, the tracker of project web-shop; nothing was asked of YouTrack`); case does not matter. A project without a `youtrack` tracker, naming the projects that have one.
- From YouTrack, each after the instance, `instance (unnamed): ` or `instance acme: `: `401: the token in ARTHUR_YOUTRACK_TOKEN was refused: <YouTrack's reason>`; `404: issue SHOP-99 not found`; any other status with YouTrack's `error_description`; `no answer in 30 s from the server in ARTHUR_YOUTRACK_URL`; `cannot reach the server in ARTHUR_YOUTRACK_URL (ECONNREFUSED)`; an answer that is not JSON. The token and the server's address are replaced by `[token]` and `[url]`, even when YouTrack's reason holds them.
