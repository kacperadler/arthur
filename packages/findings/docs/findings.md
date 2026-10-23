# The findings plugin

Roadmap entry 83: what a ticket's `findings.md` holds, and what `arthur merge` makes of its open entries, per project. The plugin is optional: without it a merge leaves every open entry open and says so once (`arthur merge --help`, step 4), and there is no `/findings`.

```ts
plugins: [orchestration({}), projects({ list: [...] }), delivery(), findings({ mode: { "acme-shop": "summary" } })],
```

## Options

`mode`: each project's mode, by the project's name; a project it does not name gets `ticket`.

- `ticket` (the default): one planning ticket for each open entry.
- `grouped`: one planning ticket for the merged ticket, every open entry in it.
- `summary`: no ticket; each open entry becomes `deferred (client summary)` and is listed in the outcome, for the client's summary.

Refused at load: an unknown option (`<key>: unknown option; options: mode`); `mode` that is not an object; an unknown mode, naming its project (`findings.mode.<project>: project <project>: expected one of ticket, grouped, summary, got "<value>"`); a key of `mode` that is no project of the projects list (`plugin findings: setup failed: mode names <names>, not a project of the projects list; each key of mode is a project's name`).

## The format

`templates/findings.md` in this package, which no longer ships with the core. Every worker's prompt carries it, under `## The findings.md format`, so a worker that starts the file starts it from the template. An entry is a heading `## F<n>. <title>` and its lines up to the next `#` or `##` heading. Of those lines the plugin reads only the first `- Kind:`, `- Budget:` and `- Status:`; every other line is the human's and is carried as written.

Only an entry whose Status is exactly `open` is open. `fixed in <commit>`, `ticket <id>`, `dropped (<reason>)`, `deferred (client summary)`, any other text and an entry without a Status are left alone, as is the file when nothing is open.

## At a merge

`arthur merge` asks `findings.onMerge` with `{ project, ticket, path, root }`, `path` the merged ticket's `findings.md` from the project's folder `root`. The answer is the lines of the outcome's `## Left open`, which the merge prints:

- No `findings.md`: `- Findings: none; no findings.md on this ticket.`
- No open entry: `- Tickets from findings: none open.` Nothing is made or written.
- `ticket`: one ticket per open entry, `board.create` with the entry's title in the entry's project: `- Tickets from findings: AC0002 (F2), AC0003 (F4).`
- `grouped`: one ticket titled `Findings of <ticket>: <its title>`: `- Tickets from findings: AC0002 (F2, F4).`, one entry included.
- `summary`: `- Deferred (client summary): F2. <title>`, one line per open entry.

Each new ticket is in `planning`, its `ticket.md` the core's template with:

- its Description the finding: `F<n> of <ticket> (<path>).` and the entry's lines but its Status; grouped, one line naming the merged ticket, then `### F<n>. <title>` and its lines for each entry;
- its `- Kind:` the entry's kind when it is one of the ticket template's (`host.board.kinds`: `feat`, `fix`, `security`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `ux`) and, grouped, the same for every entry; else the template's guidance;
- `budget` in its JSON block when the entry's `- Budget:` is a plain amount such as `1.5` (grouped: the sum, when every entry has one), which `arthur ticket status <id> planned --autopilot` takes when `--budget` is left out; a Budget that is no amount stays in the Description only;
- its Decisions `- <today>: Source: F<n> of <ticket>`, one line per entry, today in `core.timeZone`, the line autopilot reads as the ticket's source.

The rest of the template's guidance (Goal, Done means, Scope) is the coordinator's to write before the ticket can be `planned`. Then each settled entry's Status line becomes `ticket <id>` or `deferred (client summary)`, and `findings.md` is written whole, once, under a temporary name. A title the board refuses (one with no letter or digit) makes no ticket: that entry stays open, said as `- Findings: F<n> left open, no ticket made: <the board's reason>`, and the others are made. The merge does not commit: the coordinator commits the ticket's folder, the new tickets and the board after it (the procedure after a merge).

## `/findings`

`arthur findings <id>` and `/findings <id>`, moved here from orchestration: `arthur findings --help` (docs/commands/findings.md). The coordinator's role does not name the command, which a config without the plugin lacks; the plugin adds a line naming it to the coordinator's context through `coordinator.context`.
