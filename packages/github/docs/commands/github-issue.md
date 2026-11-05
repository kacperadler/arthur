# arthur github issue

Usage: `arthur github issue list [--all]`; `arthur github issue get <n>`; `arthur github issue create <file>`; `arthur github issue comment <n> <file>`; `arthur github issue label <n> <label>`; `arthur github issue close <n>`; each with `[--project <name>]`. The shared rules (the project, the `> ` marking, the refusals) are `arthur github --help`.

The token needs Issues: read on the repository to read, and Issues: read and write for `issue create`, `issue comment`, `issue label` and `issue close`.

GitHub numbers issues and pull requests alike, and its issues API serves both: `issue list` drops the pull requests, and `issue get`, `issue comment`, `issue label` and `issue close` refuse a pull request's number, nothing written (`arthur github pr --help` reads and writes pull requests).

## Reading

- `issue list [--all]`: the open issues of the project's repository, every one with `--all`, most recently updated first. Each is one line, `#<n> <state>, by <login>, updated <day>`, `<state>` `open` or `closed`, and for a closed one GitHub's reason after `, ` (`completed`, `not_planned`) when it gives one, then its title after `> `. With none: `no open issues in <owner>/<repository>` (`no issues in …` with `--all`).
- `issue get <n>`: one issue:
  - `issue #<n> of <owner>/<repository>: <state>`;
  - `by <login>; created <day>, updated <day>`, then `, closed <day>` when it was;
  - its page;
  - `title:` and the title after `> `; `labels:` and each label's name after `> `, or `labels: none`; `body:` and each line of the body after `> `, or `body: none`;
  - its comments, oldest first, each `comment <id> by <login> on <day>` and its text after `> `, or `no comments`.

  A pull request's number: `#<n> is a pull request: arthur github pr get <n>`, exit 1.

A list is read page by page, 100 items a page, pull requests counted, until a page holds fewer, at most 10 pages: a list cut there ends with `the issues stop at 10 pages of 100: GitHub may hold more` (`the comments …`). Days are GitHub's, in UTC.

## Writing

Each write is refused inside a job before any request (`arthur github --help`); the coordinator writes only on the owner's word.

- `issue create <file>`: the file's first line, a Markdown heading's `#` dropped, is the title; the rest, trimmed, the body (as `pr create` and `youtrack issue create`). Sends `POST /repos/<owner>/<repository>/issues` with `title` and `body`, and prints `created issue #<n>: <page>`. Refused before any request: `cannot read <file>: <code>`, `<file> is empty`, `<file> starts with an empty heading; its first line is the title, the rest the body`, each ending `; nothing was asked of GitHub`.
- `issue comment <n> <file>`: reads the issue, then adds the whole file, trimmed, as a comment (`POST /repos/<owner>/<repository>/issues/<n>/comments` with `body`), and prints `comment <id> added to issue #<n> of <owner>/<repository>: <page>`. Refused before any request: a file it cannot read or an empty one, as for `issue create`. A pull request's number: `#<n> is a pull request: arthur github pr comment <n> <file>; nothing was written`.
- `issue label <n> <label>`: reads the issue, then the repository's labels (`GET /repos/<owner>/<repository>/labels`), and adds the one named `<label>` in any case, under the repository's own name for it (`POST /repos/<owner>/<repository>/issues/<n>/labels` with `labels`); prints `label added to issue #<n> of <owner>/<repository>:` and the name after `> `. GitHub would make a label the repository lacks, so a typo is refused instead: `<owner>/<repository> has no label <label>, in any case; nothing was written`. Refused too: `issue #<n> of <owner>/<repository> has the label <label> already; nothing was written`, and a pull request's number, `#<n> is a pull request: arthur github labels issues only; nothing was written`.
- `issue close <n>`: reads the issue, then closes it as completed (`PATCH /repos/<owner>/<repository>/issues/<n>` with `state: closed` and `state_reason: completed`), and prints `closed issue #<n> of <owner>/<repository> as completed`. Refused: one closed already, `issue #<n> of <owner>/<repository> is closed already; nothing was written`, and a pull request's number, `#<n> is a pull request: arthur github pr close <n>; nothing was written`.

A write that got no answer in 30 s may still have been made on GitHub: read it with `issue list` or `issue get` before you write it again; nothing retries on its own.

## Refused

As `arthur github --help` says; a number no issue or pull request has is GitHub's `404: issue #<n> of <owner>/<repository> not found, or the token in <variable> cannot see it`.
