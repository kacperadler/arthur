# arthur decisions

Usage: `arthur decisions [<words>] [--open] [--kind <kind>] [--ticket <id>]`, or `arthur decisions <id>`. Comes with the `orchestration` plugin, which every config holds.

Reads the project's decision log, `spec/decisions.jsonl` (`arthur decision --help`), and writes nothing: a project with no log says `no decisions yet`, and reading creates no file. The project is the main one, or `--project <name>`; an id's prefix picks its own project. It runs inside a job too.

Without an id, one line per question, in the order asked:

```
<id> <date asked> <kind>[ <ticket>]: <question> — open | answered <date>: <decided> | closed <date>: <reason>
```

The later answer counts. A line under the ticket's Decisions that differs from what the answers write adds `; edited by hand under the Decisions of <ticket>`, and one missing adds `; its line under the Decisions of <ticket> is missing`; neither is rewritten here.

- `<words>`: only the questions whose question, options, decisions or owner's words hold every word, in any case.
- `--open`: only the questions with no answer and no close.
- `--kind <kind>`: only that kind, one of `job`, `question`, `plan`, `review`, `budget`.
- `--ticket <id>`: only the questions of that ticket.

None matching prints `no decision matches`.

`arthur decisions <id>` prints one question whole: its kind, time, ticket and job; the question; the options, numbered; the recommendation; every answer with its time, decision, option picked and the owner's words; every close; where it stands now; and each line under its ticket's Decisions edited by hand, as it is.

Refused, exit 1: a log with a line that is not a record (`arthur decision --help`), naming the line; an id the log does not hold, or whose prefix no project has; a `--kind` other than the five; an unknown `--project`. Wrong usage (an unknown flag, a flag without its value or given twice) prints the usage and exits 2.
