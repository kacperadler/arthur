# arthur stop

Usage: `arthur stop <id>`

Stops a job in a run (`working`, `idle`, or held `blocked` by a plugin; see `arthur jobs --help`), named by its full id (`2026-10-16-worker-b046ca2a`) or its short id (`b046ca2a`, as `arthur jobs` shows it), and prints `<id>: stopped`, the full id, once its run is over. It sends SIGTERM to the job's wrapper, whose `pid` the record holds; the wrapper runs the stop, the same one a job at its time or budget limit gets:

1. SIGTERM to the agent's process group: the agent and every process it started (a bash call's `npm test`, a server).
2. When any of them is still alive after a grace of 5 seconds, SIGKILL to the group. The log says `the agent's process group is still alive 5 seconds after SIGTERM: SIGKILL`.
3. SIGKILL to each process below the agent that had left its group (a daemon that called `setsid`), as seen before each signal. The log says `SIGKILL to <pid>, which had left the agent's process group: <command>` for each.
4. SIGKILL to every other process left in the job's systemd scope, which also takes one that left before it could be seen (a job that runs bare has no scope).

Then the wrapper writes the end as usual (see `arthur spawn --help`), `state` last: `ended`, reason `stopped`, the log saying `arthur stop: stopping the agent` first (`stopping the install` while the install a prepare asked for runs); then `job-ended`. A job stopped this way is not resumed at its budget. When a limit stopped the job first, its reason stays that limit and `arthur stop` prints `<id>: ended (<reason>) before the stop`; so it does, with the state and reason the run ended in, when the agent ended on its own as the stop came (the log says `arthur stop: the agent had ended already`).

A job on another machine (its record's `machine`; see `arthur spawn --help`) is stopped there: over SSH, `arthur remote-job stop` runs the same stop on the record there and its line is printed; then the end is copied here at once, with its `job-ended` and its branch fetched into the main checkout. `arthur stopall` stops such a job the same way.

Refused (exit code 1, the reason after `arthur stop: `):

- An id with no record in `<home>/jobs/`: `<id>: no such job in <home>/jobs`.
- A short id that matches two jobs: `<id> matches 2 jobs: <id>, <id>; name one by its full id`.
- A job not in a run: `<id> is <state> (<reason>), not in a run; nothing to stop`, for example `ended (finished)` or `blocked (user: <question>)`.
- A job in a run whose wrapper is gone, or whose pid another process took since: `<id>: its wrapper <pid> is gone though its state says <state>; nothing to stop`. No signal is sent.
- A wrapper that has not written the end 15 seconds after SIGTERM: `<id>: its wrapper <pid> did not end the job within 15 seconds of SIGTERM`.
- On another machine, each refusal above comes from there, after `machine <name>: arthur remote-job stop: `. A machine that does not answer: `machine <name>: ssh <ssh>: <ssh's last line>`, the job held `blocked` meanwhile (see `arthur jobs --help`). A machine no plugin registers now: `<id> runs on machine <name>, which no plugin registers; machines: <names>`.
- A config or a plugin that does not load: the record's home folder is the config's, so `arthur.config.ts did not load:`, then the reasons.

Wrong usage (no id, more than one, a flag, an empty id `""`) prints the usage line and exits 2.
