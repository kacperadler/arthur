# arthur run

Usage: `arthur run`

Runs Arthur as a process: loads `arthur.config.ts` from the working folder, sets up every enabled plugin, calls each plugin's `start` in dependency order (a plugin after the plugins it `requires`, otherwise in the config's order), and stays until it gets SIGTERM (or SIGINT, Ctrl-C). Then it calls each started plugin's `stop`, in reverse order, and exits. A systemd user service keeps it running on a server: `docs/deploy.md`.

It prints one line when every plugin has started, `arthur run: pid <pid> started <plugins>`, one when it begins to stop, `arthur run: SIGTERM: stopping <plugins>`, and `arthur run: stopped` at the end.

One process per home folder (`core.home`, default `.arthur/`): `<home>/run.pid` holds the pid of the process that runs it. The file is removed at a clean exit; after a crash the next `arthur run` takes it over, since its pid is dead. On Linux the file also names the boot, so a pid reused by another process after a reboot does not hold it.

While it runs, it follows the event log `<home>/events.jsonl`: every 500 ms it delivers to the plugins' subscribers the events another process appended since the last one it delivered, such as `ticket-moved` from `arthur ticket` or `job-started` from `arthur spawn`. An event emitted inside `arthur run` reaches them at once, and only once. Events logged before it started are not delivered, and from the moment the plugins begin to stop, no event from another process reaches them. A log cut or deleted by hand is followed again from its new end.

Refused, starting nothing:

- A second `arthur run` on the same home folder while the first lives: `arthur run: <home> is already run by pid <pid>; one arthur run per home folder`.
- A config or a plugin that does not load: `arthur run: arthur.config.ts did not load:`, then the reasons.
- Any argument: `usage: arthur run`.

When something fails:

- A plugin whose `start` throws: `arthur run: plugin <name>: start failed: <message>`. The plugins started before it are stopped, in reverse, the plugins after it are not started, and the exit code is 1.
- A plugin whose `stop` throws: `arthur run: plugin <name>: stop failed: <message>`. The other plugins are still stopped, and the exit code is 1.
- SIGTERM while a plugin's `start` runs: that `start` finishes, then that plugin and those before it are stopped, in reverse; the rest are not started.

Exit code: 0 after a clean stop, 1 when a start or a stop failed or the home folder is taken, 2 on wrong usage.
