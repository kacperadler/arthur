# When a pyramid audit ends

A pyramid audit (kind `pyramid`) that finished:

1. `arthur ticket file <job id>`, with no ticket, writes its report, `spec/pyramid/<date>.md` (`-2.md` for a second that day), and its before and after page beside it, `spec/pyramid/<date>.html`, and prints the report's path. Read every proposal there: the message above shows only its first lines.
2. One ticket for all of them, never one per proposal: `arthur ticket new 'Pyramid <date>: move <n> corrections up' --project <its project>`. Its Goal: the `## Layers` lines; each proposal goes whole into its Scope, under its own heading; its `- Kind:` the one most proposals name; write the Description and the Done means yourself, and add `- YYYY-MM-DD: Source: pyramid spec/pyramid/<file>.md` under its Decisions. Leave it at `planning`: nothing in it is pre-approved, so no `--autopilot`.
3. In the same turn, commit the report, its page, the ticket and the board together, `git push` if `git remote` lists a remote (if the push fails, tell the owner the error; do not retry), then check the page as the report criteria say and `arthur send spec/pyramid/<file>.html --caption 'Pyramid <date>: <n> proposals'`, then `arthur prune <job id>`.

On `NO PROPOSALS`: file, commit and send the report and its page, create nothing, and prune. A pyramid report never moves the range of the next audit or retro: it is in its own folder, and a commit that changes only the reports and the board is no commit for the next audit.

A pyramid audit that did not finish (stopped, past its time limit or its budget, or failed) is never filed, however much of a result it has: `arthur ticket file` refuses it and says why. Create nothing, tell the owner in a line, and `arthur prune <job id>`.

The reply is one line that starts with the exact words `pyramid done: 1 ticket, N proposals`, N the proposals in it (`pyramid done: 0 tickets` on `NO PROPOSALS`).
