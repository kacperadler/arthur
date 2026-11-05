# arthur github pr

Usage: `arthur github pr list [--all]`; `arthur github pr get <n>`; `arthur github pr create <branch> <file> [--base <branch>]`; `arthur github pr comment <n> <file>`; `arthur github pr close <n>`; `arthur github pr merge <n>`; each with `[--project <name>]`. The shared rules (the project, the `> ` marking, the refusals) are `arthur github --help`.

The token needs Pull requests: read on the repository to read, and Pull requests: read and write for `pr create`, `pr comment` and `pr close`.

## Reading

- `pr list [--all]`: the open pull requests of the project's repository, every one with `--all`, most recently updated first. Each is one line, `#<n> <state>, <head> -> <base>, by <login>, updated <day>`, `<state>` `open`, `closed` or `merged` and `, draft` after a draft, then its title after `> `. With none: `no open pull requests in <owner>/<repository>` (`no pull requests in …` with `--all`).
- `pr get <n>`: one pull request:
  - `pull request #<n> of <owner>/<repository>: <state>`;
  - `<head> -> <base>, by <login>; created <day>, updated <day>`, then `, closed <day>` and `, merged <day>` when it was;
  - its page;
  - `title:` and the title after `> `; `body:` and each line of the body after `> `, or `body: none`;
  - its comments, oldest first, each `comment <id> by <login> on <day>` and its text after `> `, or `no comments`;
  - its reviews, oldest first, each `review <id> by <login>: <STATE> on <day>` (`APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`) and its text after `> ` when it has one, or `no reviews`. A pending review, a draft its author has not submitted, is left out.

A list is read page by page, 100 items a page, until a page holds fewer, at most 10 pages: a list cut there ends with `the pull requests stop at 10 pages of 100: GitHub may hold more` (`the comments …`, `the reviews …`). Days are GitHub's, in UTC.

## Writing

Each write is refused inside a job before any request (`arthur github --help`); the coordinator writes only on the owner's word.

- `pr create <branch> <file> [--base <branch>]`: asks to merge `<branch>`, already on GitHub, into `--base`, else the branch the project's checkout is on. The file's first line, a Markdown heading's `#` dropped, is the title; the rest, trimmed, the body (as `youtrack issue create`). Sends `POST /repos/<owner>/<repository>/pulls` with `title`, `head`, `base` and `body`, and prints `created pull request #<n>: <page>`. Refused before any request: `cannot read <file>: <code>`, `<file> is empty`, `<file> starts with an empty heading; its first line is the title, the rest the body`, `<branch> is the base too: a pull request asks to merge a branch into another`, and `the checkout of project <name> is on no branch to be the base; give --base <branch>`, each ending `; nothing was asked of GitHub`. GitHub's 422 is said with each of its errors: `422 for a pull request of <branch> into <base> in <owner>/<repository>: Validation Failed: <error>`, such as `No commits between main and <branch>`, `PullRequest head invalid` (no such branch on GitHub), or `A pull request already exists for <owner>:<branch>.`.
- `pr comment <n> <file>`: reads the pull request, then adds the whole file, trimmed, as a comment (`POST /repos/<owner>/<repository>/issues/<n>/comments` with `body`), and prints `comment <id> added to pull request #<n> of <owner>/<repository>: <page>`. Refused before any request: a file it cannot read or an empty one, as for `pr create`. A number no pull request has is GitHub's 404, then `; it may be an issue: arthur github issue comment <n>`, and nothing is written.
- `pr close <n>`: reads the pull request, then closes it (`PATCH /repos/<owner>/<repository>/pulls/<n>` with `state: closed`), a draft too, and prints `closed pull request #<n> of <owner>/<repository>; its branch <head> stays on origin`. Refused: one closed or merged already, `pull request #<n> of <owner>/<repository> is closed already; nothing was written` (`is merged already`).

A write that got no answer in 30 s may still have been made on GitHub: read it with `pr list` or `pr get` before you write it again; nothing retries on its own.

## `pr merge`

`pr merge <n>` only refuses, asking GitHub nothing: `a merge is arthur merge <job>; the push of main marks the pull request merged; nothing was asked of GitHub`, exit 1. A merge on GitHub would put a commit on origin's main that no `arthur merge` review or CI check covered; it would need Contents: write on the token; and it would leave the checkout's main behind origin, so the next push of main would be rejected. Inside a job it is refused as every write is (`arthur github --help`).

## Refused

As `arthur github --help` says; `pr get` of a number that is no pull request, an issue's included, is GitHub's `404: pull request #<n> of <owner>/<repository> not found, or the token in <variable> cannot see it`.
