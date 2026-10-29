# arthur github pr

Usage: `arthur github pr list [--all]`; `arthur github pr get <n>`; `arthur github pr merge <n>`; each with `[--project <name>]`. The shared rules (the project, the `> ` marking, the refusals) are `arthur github --help`.

The token needs Pull requests: read on the repository.

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

## `pr merge`

`pr merge <n>` only refuses, asking GitHub nothing: `a merge is arthur merge <job>; the push of main marks the pull request merged; nothing was asked of GitHub`, exit 1. A merge on GitHub would put a commit on origin's main that no `arthur merge` review or CI check covered; it would need Contents: write on the token; and it would leave the checkout's main behind origin, so the next push of main would be rejected. Inside a job it is refused as every write is (`arthur github --help`).

## Refused

As `arthur github --help` says; `pr get` of a number that is no pull request, an issue's included, is GitHub's `404: pull request #<n> of <owner>/<repository> not found, or the token in <variable> cannot see it`.
