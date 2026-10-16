# arthur stopall

Usage: `arthur stopall`; on a channel `/stopall`.

Stops every job in a run (`working`, `idle`, or held `blocked` by a plugin) of every project at once, without the model: first it emits `stop-all`, with `ids`, those jobs' ids, so a plugin cancels what it would start next (delivery's hand-back after a review); then it runs `arthur stop` on each, all together, a job on another machine there (see `arthur stop --help`), and answers one line per job, as `arthur stop` prints it: `<id>: stopped`, or the reason that job was not stopped (`<id>: its wrapper <pid> is gone though its state says working; nothing to stop`, or `machine <name>: ssh <ssh>: <ssh's last line>` for a machine that does not answer). A job held `blocked` because its machine does not answer is not in a run and is not asked. With nothing running it answers `no running jobs`, and `stop-all` is emitted all the same.

Refused: a config or a plugin that does not load (`arthur.config.ts did not load:`, then the reasons), exit code 1; on a channel the reply is `/stopall failed: <reason>`. Any argument in the shell prints the usage line and exits 2.
