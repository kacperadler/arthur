# After a merge that went in

`arthur merge` printed this after its last step (`arthur merge --help`). In the same turn:

1. Rewrite `## What went in` of the ticket's `outcome.md` from the commit subjects listed there into what each changed file does now.
2. Copy the reviews' non-blocking notes into the ticket's `findings.md` as new entries, and settle each: a planning ticket (`arthur ticket new '<title>'`, its Description the finding, its Decisions `- <date>: Source: F<n> of <ticket>`) with the entry's status `ticket <id>`, or `dropped (<reason>)`. When the merge said `no plugin provides findings.onMerge`, settle its open entries the same way. List those tickets under `## Left open` in `outcome.md`.
3. Tell the owner the tickets made from findings, each with its title and a plain sentence on what it would change.
4. Commit the ticket's folder, the tickets made, and the board together, `git push` if `git remote` lists a remote (if the push fails, tell the owner the error; do not retry), then `arthur prune` the merged job and its review jobs.
5. On `unblocked: …`, spawn those tickets at once: their approval covered the order.
