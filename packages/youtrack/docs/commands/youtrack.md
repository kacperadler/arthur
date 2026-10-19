# arthur youtrack

Usage: `arthur youtrack issue list [--all]`; `arthur youtrack issue get <id>`; `arthur youtrack issue create <file>`; `arthur youtrack issue update <id> <file>`; `arthur youtrack issue set <id> <field> <value>`; `arthur youtrack issue work <id> <minutes> [<text>]`; `arthur youtrack article list`; `arthur youtrack article get <id>`; `arthur youtrack article create <file>`; `arthur youtrack article update <id> <file> <version>`; each with `--project <name>` for another project than the main one. Comes with the `youtrack` plugin.

The `youtrack` plugin reads and writes each project's YouTrack (roadmap entries 44 and 45): its issues and its knowledge base articles, on the server its `tracker` picks. No verb deletes an issue or an article.

Reading:

- `issue list [--all]`: the unresolved issues of the project's YouTrack project (`project: SHOP #Unresolved`), newest update first, one line each: `SHOP-12 Summary`; `no unresolved issues in YouTrack project SHOP` when there is none. With `--all`, every issue, resolved ones too, with ` (resolved)` after a resolved one; `no issues in YouTrack project SHOP` when there is none. No other verb takes `--all`.
- `issue get <id>`: one issue: `SHOP-12: Summary`, its reporter and the days it was created and updated, when it was resolved (or `no`), each custom field as `Name: value` (`none` when empty, a list joined by commas), then its description.
- `article list`: every article of the project, one line each: `SHOP-A-3 Title`.
- `article get <id>`: one article: `SHOP-A-3: Title`, its reporter and days, `version: <n>` (its last update in milliseconds, which `article update` is given), its parent article when it has one, then its content.

A list is read page by page, 100 items a page (`$top` and `$skip`), until a page holds fewer, so nothing is cut at the server's default of 42. Dates are UTC days. Control characters in the tracker's text are dropped before it is printed.

Writing, as the YouTrack user whose token the instance has:

- `issue create <file>`: a new issue in the project's YouTrack project; prints `created SHOP-13: Summary`. The file's first line is the summary (a Markdown heading's `#` dropped), the rest, trimmed, the description.
- `issue update <id> <file>`: the issue's summary and description, both replaced by the file's, read the same way; prints `updated SHOP-12`.
- `issue set <id> <field> <value>`: one custom field, named in any case; prints `SHOP-12: Priority set to Critical`. The value goes in the shape the field's type takes: an enum, state, version, build, owned or group value by its name, a user by login, a period as YouTrack writes it (`1d 2h`), a date as `2026-10-19` (a date and time as `2026-10-19T14:30:00Z`), a number as a number, text as it is; a field of several values takes them separated by commas.
- `issue work <id> <minutes> [<text>]`: a work item of that many minutes, with the text when given; only those two are sent, YouTrack sets the rest. Prints `SHOP-12: added 1h 30m of work`.
- `article create <file>`: a new article in the project's knowledge base, without a parent; prints `created SHOP-A-4: Title`. The file's first line is the title, the rest the content.
- `article update <id> <file> <version>`: the article's title and content, replaced by the file's, only when the article is still at `<version>`, the number `article get` printed, so a change someone made since that read is not overwritten; it is checked by a read just before the write. Prints `updated SHOP-A-3; version: <n>`, the version to give the next update.

A write that got no answer in time (`no answer in 30 s`) may still have been made: read the issue or the list before running it again.

## Options

In `youtrack({ ... })` in `arthur.config.ts`; it needs the `projects` plugin, which sets up first:

| Option | Meaning |
| --- | --- |
| `instances` | Required, a list of at least one YouTrack server, each `{ name?, urlEnv, tokenEnv }`. |
| `instances[].name` | The instance's name, which a project's `tracker.instance` gives: lowercase letters, digits and single dashes, from a letter. At most one instance has no name: the unnamed one, which a tracker without `instance` uses. |
| `instances[].urlEnv` | The variable holding the server's URL: `https://example.youtrack.cloud`, or the URL of a server under a path (`https://host/youtrack`). The unnamed instance's is `ARTHUR_YOUTRACK_URL`, a named one's `ARTHUR_YOUTRACK_<NAME>_URL`. |
| `instances[].tokenEnv` | The variable holding a permanent token of the YouTrack user Arthur reads and writes as (`ARTHUR_YOUTRACK_TOKEN`, `ARTHUR_YOUTRACK_<NAME>_TOKEN`), sent as `Authorization: Bearer <token>`. |
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
- Refused before any call to YouTrack, for a write: a file that cannot be read (`cannot read issue.md: ENOENT; nothing was asked of YouTrack`), one that is empty or holds only blank lines, or whose first line is an empty heading (`issue.md is empty or starts with an empty heading; its first line is the issue's summary, the rest its description; nothing was asked of YouTrack`); a work item of 0 minutes, or of anything but a whole number above 0 (`a work item takes a whole number of minutes above 0, got 0; nothing was asked of YouTrack`); a version that is not a number (`yesterday is not a version: the number after version: in what arthur youtrack article get SHOP-A-3 printed`).
- Refused after reading, before writing: an article changed since the version given (`SHOP-A-3 changed since version 1792315800000: jane updated it at 2026-10-19T08:15:00.000Z; read it again with arthur youtrack article get SHOP-A-3 and make the change on what it holds now; nothing was written`); a field the issue does not have (`issue SHOP-12 has no field Prio; its fields: Priority, Assignee; nothing was written`).
- From YouTrack, each after the instance, `instance (unnamed): ` or `instance acme: `: `401: the token in ARTHUR_YOUTRACK_TOKEN was refused: <YouTrack's reason>`; `404: issue SHOP-99 not found`; any other status with YouTrack's `error_description`, as a field value the project does not allow (`400 for field Priority of issue SHOP-12: <YouTrack's reason>`) or a write the token's user may not make; `no answer in 30 s from the server in ARTHUR_YOUTRACK_URL`; `cannot reach the server in ARTHUR_YOUTRACK_URL (ECONNREFUSED)`; an answer that is not JSON. YouTrack's reason is put on one line. The token and the server's address are replaced by `[token]` and `[url]`, even when YouTrack's reason holds them.
