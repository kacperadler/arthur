# arthur board

Usage: `arthur board [PREFIX] [all]`; on a channel `/board [PREFIX] [all]`. Without `PREFIX`, the main project (or `--project <name>` in the shell).

The ticket board of the project whose ticket prefix is `PREFIX` (`AR`, in either case), as text, answered from `spec/build.json` without the model: one line per ticket (id, status, title, and `after <ids>` while any ticket it waits for is not merged), the open tickets first in the order of their statuses, then the merged ones newest first, then the dropped ones; `the board is empty` when there is none.

- Without `all`: the full board when it fits one message (4096 characters, Telegram's limit), else the digest: every open ticket, the 10 newest merged, and one last line counting the rest (`+ <n> older merged, <m> dropped: the full board is /board all, or arthur ticket all`), so no ticket is lost to a cut.
- `all`: the full board, whatever its length; a channel sends it in slices.

Refused: a prefix no project has (`unknown prefix <PREFIX>; prefixes: <each project's>`); a board file broken by hand, naming the file; no project list; a config that does not load. In the shell these exit 1; on a channel the reply is `/board failed: <reason>`.

Wrong usage (more words, a prefix with something other than letters): `usage: /board [PREFIX] [all]` on a channel, `usage: arthur board [PREFIX] [all]` and exit code 2 in the shell.
