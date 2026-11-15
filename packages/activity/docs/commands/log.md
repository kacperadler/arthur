# arthur log

Usage: `arthur log [--day YYYY-MM-DD|today|yesterday] [--user <u>] [--actor <a>] [--ticket <id>] [--job <id>] [--project <name>] [--all]`; on a channel `/log [today|yesterday|<date>] [<ticket id>] [job <id>]`. Comes with the `activity` plugin (roadmap entry 101, `packages/activity/docs/activity.md`); a config without it has neither. Answered without the model, from the plugin's day files, `<home>/activity/days/YYYY-MM-DD.jsonl`; it reads only.

One day of the activity log, today in `core.timeZone` by default, the oldest line first, one line each:

```
09:12  user:telegram  message-received  Merge AR0012 once its review passes
09:13  coordinator  command spawn  --kind review Ticket: spec/features/AR0012-shop/ticket.md (exit 0)
09:13  coordinator  job-started  review on AR0012, machine local
09:41  arthur  job-ended  ended: finished
09:41  plugin:delivery  ticket-moved  in-review -> done
```

- `HH:MM  <actor>  <what>  <text>`: the line's time in `core.timeZone`, its actor, what happened and its text (`packages/activity/docs/activity.md`, "Lines"). A text the plugin cut at `textChars` ends `… (<N> chars, event <seq>)`: its full length, and the event of `<home>/events.jsonl` that holds it whole.
- The commands that only read are hidden, so the actions stand out: a `command-ran` or a channel's `/name` of `board`, `config check`, `coordinator context` (which runs every turn of the coordinator), `decisions`, `doctor`, `findings`, `health`, `help`, `jobs`, `log`, `plan`, `projects`, `resources`, `retro-due`, `review-needed`, `roles`, `stats`, `task`, `usage` or `version`. `--all` shows them too.
- With nothing to show, one line: `no activity to show on <date>`.
- A line edited by hand into one it cannot show (no whole `seq`, a `time` that is no instant, an `actor`, `what` or `text` that is no string), or cut by a crash, is skipped.

## Filters

- `--day`: `today`, `yesterday`, or a real `YYYY-MM-DD`, in `core.timeZone`. Today when left out.
- `--user <u>`: the lines on that user's word: his own, whose actor is `user:<u>` (`telegram`, `telegram/<instance>`, `terminal:<OS user>`; a leading `user:` may be given too, and `telegram` takes in each of its instances), every line whose `on` names one of his messages, and every line of a job whose `job-started` did. His messages and those jobs are looked for on every day kept up to `--day`, so a job he asked for yesterday shows today too.
- `--actor <a>`: the lines of that actor, or of its own: `coordinator`, `job:<id>`, `plugin:<name>`, `arthur`; `job` every job, `user` every user, `user:telegram` each of its instances.
- `--ticket <id>`: the lines that name that ticket, a job's later lines with the first ticket of its `job-started`.
- `--job <id>`: the lines of that job, by its full id or the 8 hex digits that end it: its `job-*` events and what it did as `job:<id>`.
- `--project <name>`: only the lines that name that project; for this command it narrows, where other commands switch to that project. A line that names none is left out.
- `--all`: the commands that only read too.

The filters combine: a line shows when it passes each one given.

## /log

`/log [today|yesterday|<date>] [<ticket id>] [job <id>]`, the words in any order, on a channel: the last 30 lines of that day, today by default, as `arthur log` prints them, the commands that only read hidden. With more, a first line says so: `the last 30 of <N> lines on <date>; arthur log shows them all`. A channel splits a long reply. Any other words reply `usage: /log [today|yesterday|<date>] [<ticket id>] [job <id>]`.

## Refused

- Wrong usage (an unknown flag, a word after `log`, a flag without its value, a `--day` none of the above) prints the usage line and exits 2.
- Inside a job (`arthur help --help`): Arthur's home, and the day files with it, is hidden from the job's sandbox, and the CLI refuses it before it runs.
