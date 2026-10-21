# The manage plugin

Managing Arthur itself. Built so far: roadmap entry 60, health: `arthur health` and `/health`, one line per thing that should have happened by now and has not, and, while `arthur run` runs, the same checks every `health.everyMinutes` with their new lines sent as a `notice`; entry 61, stats: `arthur stats`, how a project's merged tickets went, from their review files, `outcome.md` and board entries (`arthur stats --help`); entry 62, the audit: a read-only job on the commits since the last audit, with up to 5 proposals for tickets, filed in `spec/quality/`, and with `audit.at` its schedule entry; entry 64, the daily prune of `prune.keepJobsDays`: old ended jobs and Arthur's old temporary folders. The retro is entry 63.

```ts
plugins: [
	orchestration({}),
	projects({ list: [{ name: "arthur", prefix: "AR", path: "." }] }),
	schedule({}),
	manage({ health: { everyMinutes: 30 }, prune: { keepJobsDays: 14 }, audit: { at: "02:00", days: ["tue", "fri"] } }),
],
```

## Options

- `health.everyMinutes`: a whole number of minutes, 1 or more, between two rounds of the checks under `arthur run`. Left out: no round; `arthur health` and `/health` still answer.
- `prune.keepJobsDays`: a whole number of days, 0 or more: an ended job is kept that long before the daily prune frees it; 0 frees every ended job at the next prune. Left out: no daily prune, and no temporary folder removed.
- `audit.at`: `"HH:MM"`, 00:00 to 23:59 in `core.timeZone`: when the schedule plugin starts the audit. Left out with the rest of `audit`: no scheduled audit; an audit by hand still runs (below).
- `audit.days`: the days it runs on, a non-empty list of `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`, each once. Left out: every day.
- `audit.budgetUsd`: an audit's budget in USD, 0 or more (0 is no limit), by hand too; default 10. Once it runs out, the audit is resumed once with it doubled.
- `audit.model`: the scheduled audit's model, a name or an ordered list as `arthur spawn --model` takes it. Left out: the auditor role's, orchestration's `roles.auditor`, else the agent's own.

Refused at load, with the option's path: an unknown option or key, `health`, `prune` or `audit` not an object, `audit` without `at`, `audit.at` not `"HH:MM"`, `audit.days` empty, with another word or a day twice, `audit.budgetUsd` below 0 or not a number, `audit.model` empty or a list with an empty name, `health.everyMinutes` below 1 or not whole, `prune` without `keepJobsDays`, `prune.keepJobsDays` below 0 or not whole. `prune` with the schedule plugin not loaded (left out of `plugins`, or `enabled: false`) refuses the load too: `plugin manage: setup failed: prune.keepJobsDays needs the schedule plugin, which runs the daily prune; add schedule() to the config's plugins, or leave prune out`; so does `audit` without it: `plugin manage: setup failed: audit.at needs the schedule plugin, which starts the audit; add schedule() to the config's plugins, or leave audit out`.

## The checks

Manage answers `health` (docs/plugin-api.md, "Provided names") with its own checks: a stalled ticket, main not pushed, a board uncommitted for an hour, a temporary folder full, low inodes. What each one looks at, and the words of each line: `arthur health --help`. Every other plugin that answers `health` adds its lines; session's `Restarted.` notice lists the same lines (`arthur restart --help`).

## The rounds

With `health.everyMinutes`, `arthur run` runs the checks at its start and then once that many minutes have passed by the host's clock. A round sends only its new lines, all in one `notice`:

```
Health:
- AR0012 is in-progress with no job in a run for 3 h: Health checks
- github: health failed: no answer from the API
```

A line is new unless the round before saw the same problem: the same line with its numbers left out, so a ticket an hour more stalled, a count that grew or a share that changed is not sent again. A problem gone for one round and back is sent again. A round with no new line sends nothing.

What the last round saw is kept in `.arthur/manage/health.json`, written to a temporary name and renamed after the notice went out, so a problem is never lost to a failed write, and the first round after a restart sends none the last round before it saw. A file that is not what the plugin writes (broken, edited by hand) is taken as nothing seen, so the next round sends every line once. A round that fails prints `manage: the health round failed: <reason>` on stderr, and the next one runs on time.

## The daily prune

With `prune.keepJobsDays`, manage registers one entry with the schedule plugin, `manage.prune`, every day at 03:00 in `core.timeZone`, running manage's own code (`arthur schedule list` shows it). The schedule runs each slot once; a day whose 03:00 passed while `arthur run` was down runs once at its next start, late, never once per missed day (`arthur schedule --help`, "The sweep"). Each run does two things, the second even when the first fails:

1. Every job that ended `keepJobsDays` days ago or longer, by the time of its last state change, is freed as `arthur prune <id>...` frees it: its worktree, its branch and its record, as far as Git finds it safe and no plugin's `jobs.keep` keeps the record (`arthur prune --help`). A job in a run, held, or blocked is never one of them, nor one whose record's time does not read. Each job's line is printed as `manage: prune: <id>: <what was done>`.
2. Every folder right in the system's temporary folder (`TMPDIR`, else `/tmp`) whose name starts with `arthur-`, such as the `arthur-test-*` folders the test kit leaves when a test run is killed, is removed with everything inside when it was last changed more than a day ago. A file or a link of that name is left, and a link is never followed. A folder made since a job's run began, while that run goes on, is kept, however old: the cut moves back by the time each job in a run has spent in its runs, a continued job's earlier runs counted too, which puts it before the start of every run in progress. A folder that another user owns is kept, `manage: kept <path>: user <uid> owns it, not Arthur's user <uid>`; one that cannot be removed whole is kept with the reason, `manage: kept <path>: <reason>`. A run that removed any prints `manage: removed <n> temporary folders of Arthur's from <folder>` first.

A run with nothing to free prints nothing. A part that fails, the jobs unreadable or the temporary folder gone, does not stop the other; the run then fails naming each, `the prune of old jobs: <reason>` or `the temporary folders: <reason>`, which the schedule prints and sends as one `notice` (`schedule: manage.prune: its run failed: ...`), and the next try is the next day.

## The audit

Manage registers the kind `audit`: read-only, a detached checkout of HEAD with no branch, the role `auditor` (`packages/manage/roles/auditor.md`, which `arthur roles` lists) and the project's criteria files `audit` and `styleguide`. `packages/manage/criteria/audit.md` is the audit criteria to start from: copy it to the project's `<criteriaDir>/audit.md` and change it to fit. Its budget is `audit.budgetUsd`, and it asks the core for one resume at its budget, with the budget doubled (`arthur spawn --help`); stopped again, it is not resumed twice.

Every audit's prompt, after the role and the project's sections, gets `## This audit`, read from the project's checkout when the job starts:

- The commit it audits, its worktree's.
- `### Commits since the last audit, <commit> (<report>)`: one line each, `<short hash> <subject>`, newest first, from the last audit's commit to the one audited, leaving out a commit that changes only the reports and the board, files under `spec/quality/` or `spec/features/` and `spec/build.json`; a commit with any other file counts. The last audit is the newest report in `spec/quality/` by its name's date and number with a `- Commit audited:` line. With no such report, or one whose commit Git does not find in the repository, it is `### Commits of the last 24 hours (<why>)`.
- `### Board`: the board digest (`arthur ticket --help`).
- `### Stats`: `arthur stats` of the tickets merged since the last audited commit was made, every merged ticket when there is none.
- `### Open findings`: every entry with `- Status: open` in the `findings.md` of a ticket on the project's board, `- <id> F<n>: <title>. Where: <where>`.
- `### Vision`: the project's vision's path, to read first (`arthur roles --help`).

The auditor ends with at most 5 proposals, each in the form its role gives (`## <n>. <title>`, `Takes F<n> of <id>` when it takes up a finding, `Kind:`, `Budget:` when above the autopilot default, `Evidence:`, `Why it matters:`, `Scope:`), or the whole final message `NO PROPOSALS`.

### When it runs

With `audit.at`, manage registers one entry with the schedule plugin, `manage.audit`, at that time on `audit.days`, running manage's own code (`arthur schedule list` shows it). Each run audits the main project, the first in the list, and starts no job, printing why, in two cases:

- A day not in `audit.days`, the schedule's late run of a missed slot included: `manage: audit: no job, <day> is not in audit.days (<days>)`.
- No commit since the last audit's, as above, so the commit of an audit's report, tickets and board starts none: `manage: audit: no job, no commit since the last audit's <commit>`.

Otherwise it spawns the audit with `audit.model` and prints `manage: audit: started job <id>`. A spawn that is refused, `maxAgents` reached for one, fails the run, which the schedule prints and sends as one `notice` (`schedule: manage.audit: its run failed: ...`); the next try is the next slot. An audit by hand, `arthur spawn --kind audit '<focus>'`, runs whatever the commits, its task the focus note under the same prompt.

### Filing

`arthur ticket file <audit job>`, with no ticket (`arthur ticket --help`), files an audit that finished as `spec/quality/<date>.md` in the project's folder and prints that path: `<date>` the day its job started in `core.timeZone`, its id's first part; a second audit that day is `<date>-2.md`, a third `-3.md`. The file holds `# Audit <date>`, `- Job: <job>`, `- Commit audited: <commit>`, then `## Final message` and the final message as it is. It never replaces a file and never files a job twice: `<job> is already filed as spec/quality/<name>`; a second filer that took the name first: `spec/quality/<name> was written meanwhile; file <job> again`. An audit that did not finish, one stopped at its budget after its one resume among them, is refused by the core and never filed. Filing commits nothing.

When an audit ends, the coordinator's wake carries the procedure `packages/manage/roles/coordinator/audit-ended.md`: file it, a `planning` ticket per proposal with `Source: audit spec/quality/<file>.md` under its Decisions (the source orchestration's autopilot accepts), the findings it takes up settled, autopilot for a bug or cleanup its criteria let through, one commit of the report, the tickets and the board, then `arthur prune <job>`.
