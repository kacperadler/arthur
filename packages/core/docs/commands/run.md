# arthur run

Usage: `arthur run`

Runs Arthur as a process: loads `arthur.config.ts` from the working folder, sets up every enabled plugin, calls each plugin's `start` in dependency order (a plugin after the plugins it `requires`, otherwise in the config's order), and stays until it gets SIGTERM (or SIGINT, Ctrl-C). Then it calls each started plugin's `stop`, in reverse order, and exits. A systemd user service keeps it running on a server: `docs/setup.md`.

It prints one line when every plugin has started, `arthur run: pid <pid> started <plugins>`, one when it begins to stop, `arthur run: SIGTERM: stopping <plugins>`, and `arthur run: stopped` at the end.

One process per home folder (`core.home`, default `.arthur/`): `<home>/run.pid` holds the pid of the process that runs it. The file is removed at a clean exit; after a crash the next `arthur run` takes it over, since its pid is dead. On Linux the file also names the boot, so a pid reused by another process after a reboot does not hold it.

While it runs, it follows the event log `<home>/events.jsonl`: every 500 ms it delivers to the plugins' subscribers the events another process appended since the last one it delivered, such as `ticket-moved` from `arthur ticket` or `job-started` from `arthur spawn`. An event emitted inside `arthur run` reaches them at once, and only once. A log cut or deleted by hand is followed again from its new end.

Once an event has reached every subscriber, its number goes to `<home>/events.delivered` (written whole, through a temporary file). At its next start, once it holds the lock and before any plugin's `start`, `arthur run` delivers in order, once, every event after that number: those appended while it was down or stopping, by a deploy, a crash and the systemd restart, or a slow stop. Without the file (a first start) it starts at the log's end, and the events logged before are not delivered; it writes the number of the log's last event then, so the next start goes on from there even when nothing came in between. An event a plugin emits in its `setup` reaches the subscribers at once and is counted as delivered once the lock is held, never again from the log; a run that stops before the lock (refused, or a later `setup` failed) leaves it, like any command's event, to the next start. From the moment the plugins begin to stop, the events another process appends wait for the next start, except when a plugin emits one during its stop: those appended before it are delivered first, so the subscribers get the log's order.

A handler's promise is not awaited: an event counts as delivered once every handler was called. A SIGTERM during a delivery lets it finish, so the event is not delivered again; a crash during it (SIGKILL, power loss) delivers that event again at the next start.

Refused, starting nothing:

- A second `arthur run` on the same home folder while the first lives: `arthur run: <home> is already run by pid <pid>; one arthur run per home folder`.
- A config or a plugin that does not load: `arthur run: arthur.config.ts did not load:`, then the reasons.
- Any argument: `usage: arthur run`.

When something fails:

- A plugin whose `start` throws: `arthur run: plugin <name>: start failed: <message>`. The plugins started before it are stopped, in reverse, the plugins after it are not started, and the exit code is 1.
- A plugin whose `stop` throws: `arthur run: plugin <name>: stop failed: <message>`. The other plugins are still stopped, and the exit code is 1.
- SIGTERM while a plugin's `start` runs: that `start` finishes, then that plugin and those before it are stopped, in reverse; the rest are not started.

Warnings, and it goes on from the log's end:

- `<home>/events.delivered` holding no whole number (edited by hand): `arthur run: <home>/events.delivered holds no whole number; following the event log from its end`.
- A number past the log's last event (the log cut by hand): `arthur run: <home>/events.delivered holds <number>, past the log's last event <last>; following the event log from its end`.

Exit code: 0 after a clean stop, 1 when a start or a stop failed or the home folder is taken, 2 on wrong usage.
