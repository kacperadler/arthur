# The activity plugin

Who did what: roadmap entry 100, from the approved plan of AR0527 (AR-D203). One file per day, `<home>/activity/days/YYYY-MM-DD.jsonl`, one line per logged event, saying who acted, what, and on whose message. Built from the events the core and the plugins already log (`<home>/events.jsonl`), with their `by` stamp (docs/plugin-api.md, "Who acted"). Optional; the views (`arthur log`, `/log`) are entry 101.

```ts
plugins: [orchestration({}), activity({ keepDays: 90, textChars: 300 })],
```

## Options

- `keepDays`: a whole number of days, 0 to 36500 (a hundred years), default 90. A day file more than `keepDays` days before today (in `core.timeZone`) is removed, by its name, at `arthur run`'s start and at the first line of each new day; 0 keeps today's alone.
- `textChars`: a whole number of characters, 0 or more, default 300: how much of an event's text a line keeps. 0 keeps none, the line then only pointing at the event by its `seq`.

Refused at load, with the option's path: an unknown option (`activity.<key>: unknown option; options: keepDays, textChars`), `keepDays` not a whole number from 0 to 36500 (`activity.keepDays: expected a whole number of days, 0 to 36500, got -1`), and `textChars` not a whole number from 0 (`activity.textChars: expected a whole number of characters, 0 or more, got -1`).

## Lines

Each line is one JSON object: `{ seq, time, actor, on?, plugin, what, project?, ticket?, job?, kind?, text, cut? }`.

- `seq`, `time`, `plugin`: the event's. Its whole data stays in `events.jsonl` under that number.
- `actor` and `on`: the event's stamp (`user:<channel>[/<instance>]`, `user:terminal:<OS user>`, `coordinator`, `job:<id>`, `plugin:<name>`, `arthur`); an event logged before the stamp existed is `plugin:<its plugin>`.
- `what`: the event's name, `command <name>` for a `command-ran`.
- `project`, `ticket`, `job`, `kind`: when the event names them. A job's id is that of a `job-*` event, or of a `job:<id>` actor; a line of a job whose `job-started` was seen since `arthur run` started also carries that job's kind and first ticket.
- `text`: one line, every run of white space one space, cut to its first `textChars` characters (an emoji is one); `cut` is then its full length.

The events logged, and their text:

| Event | Text |
| --- | --- |
| `message-received` | each part in order: a text part's text; a media part `[<kind> <seconds> s]` or `[<kind>]`, never its path; a forwarded part (`[forwarded from <name>] ...`) `[forwarded, <N> chars]`, without the sender's name or words |
| `phone-command`, `coordinator-replied`, `coordinator-message`, `notice` | its `text` |
| `command-ran` | its arguments, then `(exit <code>)` |
| `job-started` | `<kind> on <tickets>, machine <machine>` |
| `job-state` | `<from> -> <to>: <reason>`, only to `blocked` or `ended` |
| `job-ended` | `<state>: <reason>` |
| `stop-all` | the job ids |
| `ticket-created`, `ticket-moved`, `ticket-after` | `<status>: <title>`, `<from> -> <to>`, `after <ids>` |
| `ci-finished`, `pull-request-review` | `<workflow> <conclusion> on <branch>: <url>`; `<user> <state> #<pull> of <repo>: <url>`, without the review's body |
| `cap-reached`, `disk-low` | `<cap>: <spent> of <limit>`; `<machine> <path>: <free> free, floor <floor>` |
| `machine-online`, `machine-offline` | `<machine>: <os> <arch> <version>`; `<machine>: <reason>` |
| `uptime-down`, `uptime-up` | `<url>: <reason>`; `<url>: up after <seconds> s` |
| `schedule-fired`, `run-started` | `<id>: <does>[, late]`; `pid <pid>: <plugins>` |

Any other event is not logged. A secret value of the env file never reaches a line: the event log has already replaced it with its variable's name.

## Files

Only `arthur run` writes. Every process of Arthur loads the plugin, and its events reach it, but a command never calls `start`, so it writes nothing. `arthur run` delivers the events other processes logged, its replay at the start included:

- Before `start`, the plugin holds them in memory; at `start` it writes them in number order, then each event as it comes.
- An event whose number is not above the last line already written is skipped, so a replay after a crash writes nothing twice. The last line is the highest `seq` of the newest day file that holds a line that reads.
- When the first held event above that line is not the next number (`events.delivered` lost, or the next event is one not logged), the events after it are read from the log once, at `start`.
- The day of a line is the event's date in `core.timeZone`.
- Each line is one append ending in a line break. A last line a crash cut gets its line break first, so it stays one line, which a reader skips.

The folder is under `.arthur/`, which Git ignores: the day files hold the owner's words and are never committed.
