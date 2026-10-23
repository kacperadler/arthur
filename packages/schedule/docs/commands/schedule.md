# arthur schedule

Usage: `arthur schedule [list]`; `arthur schedule add <id> <at> [--days <day,...>] (--message <text> [--procedure <path>] | --task <text> [--kind <kind>] [--project <name>])`; `arthur schedule remove <id>`. Comes with the `schedule` plugin.

The `schedule` plugin: actions and jobs at set times (roadmap entries 39 and 40), so Arthur works while the owner is away. An entry is a daily time or a one-off date and time, and does an action (a message to the coordinator) or a job (a spawn); an entry a plugin registers may instead run that plugin's own code. Entries come from the config, from other plugins, which register theirs from their own options, and from the `file` option, which `arthur schedule add` and `remove` change.

Inside a job (`ARTHUR_JOB` set, `arthur help --help`) only the list runs: `add` and `remove`, once their usage is right, print `arthur schedule <add|remove>: refused inside a job <id>: a job runs only the commands its role needs; put what the coordinator should do in your final message` and exit 1, the file unchanged.

## Options

In `schedule({ ... })` in `arthur.config.ts`; every key optional:

| Option | Meaning |
| --- | --- |
| `entries` | The config's entries, a list; each as below. Default none. |
| `file` | The path of a JSON file holding a list of entries in the same shape, from the folder `arthur run` runs in, such as `"spec/schedule.json"`: the entries added by hand or with `arthur schedule add`. Read anew at every sweep; a missing file holds no entry. Default none. |

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

## Entries other plugins register

A plugin registers the entries its own options make (orchestration's morning report, manage's audit and retro) from its `setup`, which must run after schedule's: with `requires: ["schedule"]`, or listed after schedule in the config. The name is `schedule.register`, which schedule provides:

```ts
host.call("schedule.register", host.name, [
	{ id: "audit", at: "02:00", days: ["tue", "fri"], option: "audit.at", job: { task: "Audit the commits since the last audit.", kind: "audit" } },
	{ id: "report", at: "08:00", option: "morningReport.at", action: { message: "Write the morning report.", procedure: fileURLToPath(new URL("../roles/coordinator/morning-report.md", import.meta.url)) } },
], host.package);
```

- Each entry is in the shape above, plus `option`: the path of the plugin's option that makes it, which `list` shows and `remove` names.
- In place of `action` or `job`, an entry may have `run`: an async function of the plugin's own code, run at the entry's time without a model turn or a job (a daily prune, a Docker sweep): `{ id: "prune", at: "03:00", option: "prune.keepJobsDays", run: () => prune(host) }`. Only a registered entry takes it; the config and the file hold no code, so `run` there is an unknown key. `list` shows it as `run: the plugin's own code`.
- Its id becomes `<plugin>.<id>` (`manage.audit`), so two plugins never clash; its run state is kept under that id.
- A procedure is the absolute path of a `.md` file in the registering plugin's own package folder, `host.package`, which it passes after its entries: the folder around its `module` (`packages/<plugin>/` in Arthur's checkout, `node_modules/@arthur/<plugin>/` or a scope's package of any name in an install), one of the plugins' in the host's `code`, with no `..` in it, read as the file is when the entry runs; a symlink on the way below that folder is never read. The config's and the file's procedures keep their own rule, a relative path inside the folder `arthur run` runs in, so neither rule opens the other: a file entry cannot name a package's file, and a plugin cannot name `.env` or a file outside its package. A plugin that names no `module` (one the config writes itself) has no package folder, so its entries take no procedure; nor does one that passes none.
- Refused, the call throwing and adding none of the entries, so the plugin's `setup` fails and the load names it: an entry the checks above refuse (`schedule.register from plugin manage: entries[1].at: expected ...`); no `option`; a procedure that is not such a path (`entries[0].action.procedure: expected the absolute path of a .md file in the package folder of plugin manage, <folder>, got "/etc/passwd.md"`); a `run` that is not a function (`entries[0].run: expected the plugin's own code, an async function, got ...`) or beside an action or a job (`entries[0].run: expected either action, job or run`); an id the config has (`entries[0].id: manage.report is the id of an entry of the config too`) or that the plugin registered already (`manage.audit is registered already, from option audit.at`); a first argument that is not a plugin's name; entries that are not a list; a package folder that is not one of the plugins' in `code` (`expected its own package folder (host.package) after its entries, ...`).
- Registered entries live in the memory of one load only, never in the file: a plugin turned off (`enabled: false`, or out of the list) registers nothing at the next load, so its entries are gone from `list` and from the sweep. Their run state stays in `<home>/schedule/`, so turning the plugin on again does not run a one-off twice.

## arthur schedule list

`arthur schedule` alone is `list`: every entry, the config's first, then the plugins', then the file's, each on two lines: its id, where it comes from (`config`, `plugin <name>, option <path>`, or the file), when it runs and its next run; then what it does. A file entry that is skipped (below) is named after them.

```
standup (config): every day at 09:00, next 2026-10-21 09:00
  message: Plan the day.
manage.audit (plugin manage, option audit.at): tue, fri at 02:00, next 2026-10-23 02:00
  job (kind audit): Audit the code.
release (spec/schedule.json): once at 2026-11-02 08:30, next 2026-11-02 08:30
  message: Release day. (procedure docs/release.md)
missed (spec/schedule.json): once at 2026-10-19 22:00, due: runs at the next sweep of arthur run
  message: Missed.
spec/schedule.json[4] "broken": skipped, at: expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "24:00"
```

A daily entry's next run is its next slot after now; a one-off's is its time, `due: runs at the next sweep of arthur run` once that has passed, and `ran` once its slot is claimed. With no entry at all: `no entries`.

## arthur schedule add

`arthur schedule add <id> <at> ...` appends one entry to the file: `<id>` and `<at>` as `id` and `at`, `--days mon,fri` as `days`, `--message` and `--procedure` as an action, `--task`, `--kind` and `--project` as a job. Quote a text of several words: `arthur schedule add weekly 09:00 --days mon --message "Summarise the week."`. It prints the entry as `list` does, after `added `.

Refused, the file unchanged (`arthur schedule: cannot add <id>: <why>`, exit code 1): an entry the checks above refuse, `at` included (`cannot add late: at: expected "HH:MM" for every day or "YYYY-MM-DDTHH:MM" for once, got "24:00"`); an id that is taken, by the config, a plugin or the file (`cannot add manage.audit: its id is taken by plugin manage's option audit.at`); no `file` option; a file that is not a JSON list (`<file>: <why>; fix it by hand first, nothing was changed`), so a human's text is never written over. Two `add` or `remove` at once take turns under a lock in `<home>/schedule/`, so neither loses the other's change; the file is written to a temporary name and renamed, so a sweep reads the old list or the new one. It is written back as JSON indented by two spaces.

## arthur schedule remove

`arthur schedule remove <id>` takes every entry of the file with that id out, and its run state (below), so an entry added later under that id is a new one; it prints `removed <id> from <file>`. Refused, saying where the entry comes from: one a plugin registers (`cannot remove manage.audit: plugin manage makes it from its option audit.at; change or turn off that option in arthur.config.ts`), one of the config (`cannot remove standup: it is schedule.entries[0] in arthur.config.ts; remove it there`); an id no entry of the file has (`no entry <id> in <file>; arthur schedule list shows every entry`), or one not of the id form (a hand-broken entry is fixed by hand).

Wrong usage of `list`, `add` or `remove`: an unknown verb, an argument too many or too few, a flag `add` does not take, one given twice or without its value, `--project` on `list` or `remove`. It prints the reason and the usage line, exit code 2. When the config or a plugin does not load, `arthur schedule` is an unknown command, printed with the reason.

## The sweep

`arthur run` sweeps at its start and every 10 seconds. For each entry it takes the slot that has come: a daily entry's latest time at or before now (on its `days`), a one-off's own time once it has passed. A slot runs when it is later than the entry's last claimed slot, and is claimed once: of any number of sweeps at once, in one process or several, exactly one runs it.

- An action emits `coordinator-message` `{ text }`, which the coordinator gets marked `[Arthur: schedule]`, each line quoted (`arthur coordinator --help`): `[scheduled <id>] <message>`, and with a procedure, a blank line and the procedure file's text.
- `call("schedule.message", <id>, <message>, <procedure text>)` answers that text for an action due on time, without the late mark: the procedure's text trimmed under a blank line, none without it. `arthur eval` asks it for a scenario's scheduled turn, so a change of this wording reaches every scenario. Refused, throwing: an id that is not an entry's (`schedule.message: expected an entry's id, got "bad/id"`), a message that is not non-empty text, a procedure that is not text.
- A job is spawned like `arthur spawn` (`maxAgents`, the plugins' checks and placement included), and `arthur run` prints `schedule: <id>: started job <job id>`. A spawn that is refused goes to the coordinator instead: `[scheduled <id>] Its job (kind <kind>, project <project>) did not start: <reason>` (the project only when the entry names one), and `Its task: <task>` on the next line, so it can start the job itself later; the slot stays claimed.
- A registered entry's `run` is called once its slot is claimed, after the jobs, each run awaited in turn. One that throws or rejects is printed and sent to every channel as one `notice`, `schedule: <id>: its run failed: <message>` (with `(late: due ...)` after the id when late); the slot stays claimed, so the next try is the next slot.
- Late: a slot run more than 5 minutes after its time says so, `[scheduled <id>] (late: due <YYYY-MM-DD HH:MM>) <message>`, and so does the printed line of a job. A daily entry whose slots passed while `arthur run` was down (three days, say) runs once, for its latest slot, late; the slots before it are not run. Its next slot runs on time.
- A one-off whose time passed while `arthur run` was down runs once at the next start, late, and never again: its claim stays. The entry stays in the config or the file until it is removed, by hand or with `arthur schedule remove`.
- A new daily entry: the slots before the first sweep that saw it are not run, except one at most 5 minutes before, so an entry added at 09:02 for 09:00 still runs, and one added at 15:00 for 09:00 first runs tomorrow.
- Times the spring gap skips (02:30 in Warsaw on its day) run at the first minute after the jump (03:00); a time the autumn repeat shows twice runs at its first pass only.

A slot is claimed before it runs, so a process that ends between the two loses that slot rather than running it twice.

## Hand-broken entries

The file is a file a human edits, so the sweep checks its entries as the config's are checked and runs the others:

- An entry the checks above refuse is skipped and named: `spec/schedule.json[2] "doc-check": skipped, at: expected ...`. So is one whose id the config, a plugin or an earlier entry of the file already has: `..., its id is taken by an entry of the config`, `..., its id is taken by plugin manage's option audit.at`.
- A file that is not JSON, or not a list: `spec/schedule.json: none of its entries run: <why>`; the config's and the plugins' entries still run.
- A procedure file that cannot be read (missing, unreadable, or one whose path holds a symlink, the file itself or any folder on the way below the folder `arthur run` runs in, or below the plugin's package folder for a registered entry, which is never read) holds its entry back, unclaimed, until it can: `<id>: skipped until its procedure can be read: <why>`, for a symlink `<path> is or goes through a symlink, which is never read`. Its slot then runs, late when it is.

Each such line is printed by `arthur run` as `schedule: <line>` and sent to every channel as one `notice`, once while it lasts; a problem that went away and comes back is said again, and so is every problem at the next start of `arthur run`.

## Files

`<home>/schedule/<id>/`, outside Git: one file per claimed slot, named by its instant (`2026-10-19T07:00:00.000Z`), of which only the latest is kept, and `seen`, when a sweep first saw the entry. Deleting an entry's folder, as `arthur schedule remove` does, makes it new again: a one-off already run would run once more. `<home>/schedule/.file.lock`: the lock of `add` and `remove`, there only while one runs.
