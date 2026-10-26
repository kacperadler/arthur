# The schedule plugin

Actions and jobs at set times, so Arthur works while the owner is away. An entry is a daily time (optionally on some days) or a one-off date and time, in `core.timeZone`, and does an action, a message to the coordinator with an optional procedure file under it, or a job, a spawn of a given kind. Entries come from the config, from the `file` option, which `arthur schedule add` and `remove` change, and from other plugins, which register theirs from their own options (orchestration's morning report, manage's audit and retro). `arthur run` sweeps every 10 s and runs each due slot once.

```ts
schedule({
	file: "spec/schedule.json",
	entries: [{ id: "weekly-summary", at: "09:00", days: ["mon"], action: { message: "Summarise last week's merges for the human." } }],
}),
```

## Options

- `entries`: the config's entries, each `{ id, at, days?, action | job }`: `id`, its name; `at`, `"HH:MM"` every day or `"YYYY-MM-DDTHH:MM"` once; `days`, the days a daily entry runs on (default every day); `action`, `{ message, procedure? }`, or `job`, `{ task, kind?, project? }` (kind `worker` and the main project by default). Default none.
- `file`: a JSON list of entries in the same shape, read at every sweep: the ones added by hand or with `arthur schedule add`. Default none.

`arthur schedule` lists every entry with where it comes from and its next run; its page, what `arthur schedule --help` prints, is [`commands/schedule.md`](commands/schedule.md), with each key and refusal in full.
