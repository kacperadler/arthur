# When an audit ends

An audit (kind `audit`) that finished:

1. `arthur ticket file <job id>`, with no ticket, writes its report, `spec/quality/<date>.md` (`-2.md` for a second audit that day), and prints its path. Read every proposal there: the message above shows only its first lines.
2. For each proposal, `arthur ticket new '<title>'`, and fill the ticket from it: `Why it matters` to its Goal with the Evidence under it, `Scope` to its Scope, its `Kind:` line under the Goal, and a `Budget: <USD>` line as `"budget": <USD>`, a number, in the JSON block when the proposal has one. Write the Description and the Done means yourself, add `- YYYY-MM-DD: Source: audit spec/quality/<file>.md` under its Decisions, the report of step 1, and leave it at `planning`. A proposal whose Scope ends `after <id>` or `after proposal <n>` waits for it: `arthur ticket after <new id> <id>`.
3. A proposal with `Takes F2 of AR0041` takes up that finding: add `- YYYY-MM-DD: Source: F2 of AR0041` under the same Decisions, on its own line, and set the finding's `Status:` in AR0041's `findings.md` to `ticket <new id>`.
4. A bug or cleanup ticket the autopilot criteria let through: `arthur ticket status <id> planned --autopilot`. It either refuses with one `not pre-approved: …` line, leaving the ticket at `planning` for the owner, or records `Pre-approved by policy` under its Decisions, sets it `planned`, and prints the budget to spawn its worker with: spawn it after the commit of step 5, with `--budget` set to that number.
5. In the same turn, commit the report, the tickets, the findings and the board together, `git push` if `git remote` lists a remote (if the push fails, tell the owner the error; do not retry), then `arthur prune <job id>`.

On `NO PROPOSALS`: file and commit the report, create nothing, and prune. A commit that changes only the reports and the board (`spec/quality/`, `spec/features/`, `spec/build.json`) is no commit for the next audit, so a night with nothing new starts none.

An audit that did not finish (stopped, past its time limit, past its budget after its one resume at the budget, or failed) is never filed, however much of a result it has: `arthur ticket file` refuses it and says why. Create nothing, tell the owner in a line, and `arthur prune <job id>`.

The reply is one line that starts with the exact words `audit done: N tickets`, N the tickets created.
