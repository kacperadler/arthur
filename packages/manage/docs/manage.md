# The manage plugin

Managing Arthur itself. Built so far: roadmap entry 60, health: `arthur health` and `/health`, one line per thing that should have happened by now and has not, and, while `arthur run` runs, the same checks every `health.everyMinutes` with their new lines sent as a `notice`. Stats, the audit, the retro and pruning on a schedule are entries 61 to 64.

```ts
plugins: [
	orchestration({}),
	projects({ list: [{ name: "arthur", prefix: "AR", path: "." }] }),
	manage({ health: { everyMinutes: 30 } }),
],
```

## Options

- `health.everyMinutes`: a whole number of minutes, 1 or more, between two rounds of the checks under `arthur run`. Left out: no round; `arthur health` and `/health` still answer.

Refused at load, with the option's path: an unknown option or key, `health` not an object, `health.everyMinutes` below 1 or not whole.

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
