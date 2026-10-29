# After a merge that went in

`arthur merge` printed this after its last step (`arthur merge --help`). In the same turn:

1. Rewrite `## What went in` of the ticket's `outcome.md` from the commit subjects listed there into what each changed file does now.
2. Copy the reviews' non-blocking notes into the ticket's `findings.md` as new entries, and settle each: a planning ticket (`arthur ticket new '<title>'`, its Description the finding, its Decisions `- <date>: Source: F<n> of <ticket>`) with the entry's status `ticket <id>`, or `dropped (<reason>)`. When the merge said `no plugin provides findings.onMerge`, settle its open entries the same way. List those tickets under `## Left open` in `outcome.md`.
   Settle the notes in the project's findings mode, as the merge settled the open entries: on `- Deferred (client summary):` lines (`summary`) no ticket, each note's status `deferred (client summary)` and its own such line under `## Left open`; on a `- Tickets from findings:` ticket with several entries or titled `Findings of <ticket>: <its title>` (`grouped`) every note goes into that ticket's Description, status `ticket <id>` (one such ticket for all notes when none was made); else a ticket each (`ticket`). When the lines show no mode (`none open`, no `findings.md`), `findings({ mode })` in `arthur.config.ts` names the project's, `ticket` when it does not.
3. Tell the owner the tickets made from findings, each with its title and a plain sentence on what it would change.
4. Commit the ticket's folder, the tickets made, the board and `CHANGELOG.md` together, `git push` if `git remote` lists a remote (if the push fails, tell the owner the error; do not retry). `arthur merge` pruned the merged job and its ticket's other jobs already.
5. On `unblocked: …`, spawn those tickets at once: their approval covered the order.
