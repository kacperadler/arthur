# schedule

The `schedule` plugin: actions and jobs at set times (roadmap entry 39), so Arthur works while the owner is away. An entry is a daily time or a one-off date and time, and does an action (a message to the coordinator) or a job (a spawn). Entries come from the config and from the `file` option; plugins registering their own entries, and `arthur schedule add|list|remove` for the file, are roadmap entry 40.

## Options

In `schedule({ ... })` in `arthur.config.ts`; every key optional:

| Option | Meaning |
| --- | --- |
| `entries` | The config's entries, a list; each as below. Default none. |
| `file` | The path of a JSON file holding a list of entries in the same shape, from the folder `arthur run` runs in, such as `"spec/schedule.json"`: the entries added by hand. Read anew at every sweep; a missing file holds no entry. Default none. |

An entry:

| Key | Meaning |
| --- | --- |
| `id` | Its name, unique among all entries: letters and digits, joined by single dots, dashes or underscores (`weekly-summary`). Its run state is kept under it. |
| `at` | `"HH:MM"` (00:00 to 23:59): every day at that time; or `"YYYY-MM-DDTHH:MM"`: once. Both in `core.timeZone`. |
| `days` | Only for a daily entry: the days it runs, a non-empty list of `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. Default every day. |
| `action.message` | An action: the message the coordinator gets, `[scheduled <id>] <message>`. |
| `action.procedure` | Optional: the relative path, from the folder `arthur run` runs in, of a `.md` file whose text goes under the message, as the file reads when the entry runs. |
| `job.task` | A job: the task of the job spawned, as `arthur spawn <task>` takes it. |
| `job.kind` | Optional: its kind; default `worker`. |
| `job.project` | Optional: its project; default the main one. |

An entry has either `action` or `job`. Refused at load (and by `arthur config check`), naming the option's path: an option or key it does not take; `at` that is neither form, or a date that does not exist (`entries[0].at: expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "24:00"`); `days` on a one-off, empty, or with another word; both `action` and `job`, or neither; a message, task, kind or project that is not non-empty text; a procedure that is absolute, climbs out with `..`, or does not end in `.md`; an id of another form or one two entries share (`entries[3].id: standup is the id of entries[0] too`); a `file` that is not a non-empty path.

## The sweep

`arthur run` sweeps at its start and every 10 seconds. For each entry it takes the slot that has come: a daily entry's latest time at or before now (on its `days`), a one-off's own time once it has passed. A slot runs when it is later than the entry's last claimed slot, and is claimed once: of any number of sweeps at once, in one process or several, exactly one runs it.

- An action emits `coordinator-message` `{ text }`, which the coordinator gets marked `[Arthur]` (`arthur coordinator --help`): `[scheduled <id>] <message>`, and with a procedure, a blank line and the procedure file's text.
- A job is spawned like `arthur spawn` (`maxAgents`, the plugins' checks and placement included), and `arthur run` prints `schedule: <id>: started job <job id>`. A spawn that is refused goes to the coordinator instead: `[scheduled <id>] Its job (kind <kind>, project <project>) did not start: <reason>` (the project only when the entry names one), and `Its task: <task>` on the next line, so it can start the job itself later; the slot stays claimed.
- Late: a slot run more than 5 minutes after its time says so, `[scheduled <id>] (late: due <YYYY-MM-DD HH:MM>) <message>`, and so does the printed line of a job. A daily entry whose slots passed while `arthur run` was down (three days, say) runs once, for its latest slot, late; the slots before it are not run. Its next slot runs on time.
- A one-off whose time passed while `arthur run` was down runs once at the next start, late, and never again: its claim stays. The entry stays in the config or the file until it is removed by hand.
- A new daily entry: the slots before the first sweep that saw it are not run, except one at most 5 minutes before, so an entry added at 09:02 for 09:00 still runs, and one added at 15:00 for 09:00 first runs tomorrow.
- Times the spring gap skips (02:30 in Warsaw on its day) run at the first minute after the jump (03:00); a time the autumn repeat shows twice runs at its first pass only.

A slot is claimed before it runs, so a process that ends between the two loses that slot rather than running it twice.

## Hand-broken entries

The file is a file a human edits, so the sweep checks its entries as the config's are checked and runs the others:

- An entry the checks above refuse is skipped and named: `spec/schedule.json[2] "doc-check": skipped, at: expected ...`. So is one whose id the config or an earlier entry of the file already has: `..., its id is taken by an entry of the config`.
- A file that is not JSON, or not a list: `spec/schedule.json: none of its entries run: <why>`; the config's entries still run.
- A procedure file that cannot be read (missing, unreadable, or a symlink, which is never read) holds its entry back, unclaimed, until it can: `<id>: skipped until its procedure can be read: <why>`. Its slot then runs, late when it is.

Each such line is printed by `arthur run` as `schedule: <line>` and sent to every channel as one `notice`, once while it lasts; a problem that went away and comes back is said again, and so is every problem at the next start of `arthur run`.

## Files

`<home>/schedule/<id>/`, outside Git: one file per claimed slot, named by its instant (`2026-10-19T07:00:00.000Z`), of which only the latest is kept, and `seen`, when a sweep first saw the entry. Deleting an entry's folder makes it new again: a one-off already run would run once more.
