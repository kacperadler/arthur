# arthur task

Usage: `arthur task <id>`; on a channel `/task <id>`. Comes with the `orchestration` plugin, which every config holds.

A ticket's status and its `ticket.md` as the project's main checkout holds it, whole, answered without the model: the first line is `<id> <status>`, then the file. A channel sends a long reply in slices.

The id is `14` (the number alone, in the main project, or in `--project <name>` in the shell), `AR14`, or the full id `AR0014`, letters in either case. Its prefix picks the project, so an id with another project's prefix answers from that project's board.

Refused: a prefix no project has (`unknown prefix <prefix>; prefixes: ...`); an id not on its project's board (`<id>: not on the board of project <name>`); a `ticket.md` that cannot be read; a board file broken by hand; an unknown `--project`. In the shell these exit 1; on a channel the reply is `/task failed: <reason>`. When `arthur.config.ts` does not load, the command is not there: `arthur task` prints `arthur: unknown command task`, the core's commands and why the config did not load, and exits 2.

Wrong usage (no id, more than one word, anything but letters then digits): `usage: /task <id>` on a channel, `usage: arthur task <id>` and exit code 2 in the shell.
