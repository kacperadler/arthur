# arthur ticket

Usage: `arthur ticket new <title>`, `arthur ticket status <id> <status>`, `arthur ticket after <id> [<id>...]`; `--project <name>` for another project than the main one. The whole board is `arthur board all` (see `arthur board --help`).

The ticket board of a project: each ticket is a folder `spec/features/<id>-<slug>/` in the project's repository, and the board is `spec/build.json` there, a JSON array with one entry per ticket (`id`, `title`, `status`, `path` of its `ticket.md`, `updated`, and `after` when it waits for other tickets). The board is changed only through this command and, for plugins, `host.board`; every change emits an event.

- `new <title>`: creates a ticket in `planning` and prints its id and the path of its `ticket.md`, written from the core's template (`packages/core/templates/ticket.md`) with the id, the title and today's date in `timeZone`. The words after `new` are the title. Emits `ticket-created` (`id`, `project`, `title`, `status`, `path`).
- `status <id> <status>`: moves the ticket to another status, if the table below allows it, and prints its id and status. The id's prefix names the project, so `--project` is not needed. Emits `ticket-moved` (`id`, `project`, `from`, `to`); a move to the status the ticket has already changes nothing and emits nothing.
- `after <id> [<id>...]`: the tickets this one waits for, until each is merged; they replace the ones it waited for before, and no ids means it waits for none. Prints `<id> after <ids>`, or `<id> after nothing`. An id named twice counts once. Emits `ticket-after` (`id`, `project`, `after`) when the list changes.

The statuses and the moves allowed from each:

| From | To |
| --- | --- |
| `planning` | `planned`, `dropped` |
| `planned` | `planning`, `in-progress`, `dropped` |
| `in-progress` | `planning`, `review`, `done`, `merged`, `dropped` |
| `review` | `in-progress`, `done`, `merged`, `dropped` |
| `done` | `in-progress`, `review`, `merged`, `dropped` |
| `merged` | none: final |
| `dropped` | none: final |

`planned` is the human's approval, so work starts only from it. Statuses follow the jobs: a worker's start (`job-started`), at a spawn or a continue, moves each ticket its task names in a `Ticket:` line to `in-progress` (see `arthur spawn --help` and `arthur continue --help`).

Ids are the project's prefix and a number of at least 4 digits, from 1 (`AR0001`), one above the highest number the board or a ticket folder of that prefix has, so a dropped ticket's id is never given again. The folder's slug is the title in lowercase letters and digits joined by dashes, cut at a dash to at most 80 characters.

The projects, each with its folder and prefix, are the list the `projects` plugin provides; the main project is the first one. One writer at a time: each change holds `spec/.board/build.json.lock` for the moment it reads and writes the board, so two writers at once never lose a change; a lock whose process is gone is taken over. The board and a new `ticket.md` are written to a temporary file in `spec/.board/` and renamed, so a reader never sees half of either. `spec/.board/` holds a `.gitignore` of `*`, written back on each change when it differs, so a writer killed mid-write leaves nothing Git shows or commits.

The board as text, for `/board` (see `arthur board --help`) and for plugins as `host.board.digest()`: one line per ticket (id, status, title, and `after <ids>` while any ticket it waits for is not merged), the open tickets first in the order of the statuses above, then the merged ones newest first, then the dropped ones. The digest keeps every open ticket and the 10 newest merged, and counts the rest in its last line: `+ <n> older merged, <m> dropped: the full board is /board all`.

Refused, one line each, with exit code 1:

- A move the table does not allow: `<id>: <from> cannot move to <to>; from <from>: <allowed>`, so a merged or dropped ticket never moves again.
- `planned` while the ticket's `ticket.md` still holds a guidance comment (`<!-- ... -->`) of the template; the message lists each one left.
- A `ticket.md` that cannot be read when the ticket is moved to `planned`.
- An `after` that names a ticket not on the same board, a dropped one, or leads back to the ticket through the afters on the board (a cycle, named as its chain, for example `DM0001 cannot wait for itself: DM0001 after DM0002 after DM0001`).
- An unknown status; an id that is not on its project's board, or whose prefix no project has.
- A title that is empty, has spaces around it, spans lines, or has no letter a-z or digit.
- A board file broken by hand (not JSON, not an array, an entry without a valid `id`, `title`, `status`, `path` or `updated`, an `after` that is not a list of ids, an id twice): the message names the file and the first problem, and the file is left as it is. A missing board file is an empty board.
- No project list (no plugin provides `projects`), a list provided twice, an empty one, a project without a name, an absolute folder or a prefix of capital letters, two projects with one name or one prefix, and an unknown `--project`.
- A config that does not load: the board needs the plugins' project list.

Exit code: 0 when done, 1 when refused, 2 on wrong usage.
