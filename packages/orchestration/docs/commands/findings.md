# arthur findings

Usage: `arthur findings <id>`; on a channel `/findings <id>`. Comes with the `orchestration` plugin, which every config holds.

A ticket's `findings.md`, whole, answered without the model; a channel sends a long reply in slices. A ticket without the file, or with an empty one, answers `<id>: no findings (<path> does not exist)` or `<id>: no findings (<path> is empty)`.

Findings a worker wrote on its branch show before the merge. The ticket's jobs are the job records in `<home>/jobs/` of its project whose task names the ticket on a `Ticket:` line. Of their branches that still exist, newest last commit first, the first whose commits changed `findings.md` to a text that is not blank and not the main checkout's answers, headed `findings from branch <branch> (not merged)`. A merged branch, one that did not change the file, a read-only job and a deleted branch show nothing; then the answer is the file as the project's main checkout holds it.

The id is `14` (the number alone, in the main project, or in `--project <name>` in the shell), `AR14`, or the full id `AR0014`, letters in either case. Its prefix picks the project, so an id with another project's prefix answers from that project's board.

Refused: a prefix no project has (`unknown prefix <prefix>; prefixes: ...`); an id not on its project's board (`<id>: not on the board of project <name>`); a `findings.md` that exists but cannot be read; a board file broken by hand; an unknown `--project`. In the shell these exit 1; on a channel the reply is `/findings failed: <reason>`. When `arthur.config.ts` does not load, the command is not there: `arthur findings` prints `arthur: unknown command findings`, the core's commands and why the config did not load, and exits 2.

Wrong usage (no id, more than one word, anything but letters then digits): `usage: /findings <id>` on a channel, `usage: arthur findings <id>` and exit code 2 in the shell.
