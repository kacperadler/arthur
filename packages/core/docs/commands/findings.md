# arthur findings

Usage: `arthur findings <id>`; on a channel `/findings <id>`.

A ticket's `findings.md` as the project's main checkout holds it, whole, answered without the model; a channel sends a long reply in slices. A ticket without the file, or with an empty one, answers `<id>: no findings (<path> does not exist)` or `<id>: no findings (<path> is empty)`. Findings a worker wrote on its branch show once the branch is merged.

The id is `14` (the number alone, in the main project, or in `--project <name>` in the shell), `AR14`, or the full id `AR0014`, letters in either case. Its prefix picks the project, so an id with another project's prefix answers from that project's board.

Refused: a prefix no project has (`unknown prefix <prefix>; prefixes: ...`); an id not on its project's board (`<id>: not on the board of project <name>`); a `findings.md` that exists but cannot be read; a board file broken by hand; an unknown `--project`; a config that does not load. In the shell these exit 1; on a channel the reply is `/findings failed: <reason>`.

Wrong usage (no id, more than one word, anything but letters then digits): `usage: /findings <id>` on a channel, `usage: arthur findings <id>` and exit code 2 in the shell.
