# When a retro ends

A retro (kind `retro`) that finished:

1. `arthur ticket file <job id>`, with no ticket, writes its report, `spec/retro/<date>.md` (`-2.md` for a second retro that day), and its phone page beside it, `spec/retro/<date>.html`, and prints the report's path. Read every proposal there: the message above shows only its first lines.
2. For each proposal, `arthur ticket new '<title>'`, and fill the ticket from it: `Why it matters` to its Goal with the Evidence under it, `Scope` with its Before and After to its Scope, and `- Kind: cleanup` under the Goal. Write the Description and the Done means yourself, add `- YYYY-MM-DD: Source: retro spec/retro/<file>.md` under its Decisions, the report of step 1, and leave it at `planning`: a change to a role is the owner's, so none gets `--autopilot`. A proposal whose Scope ends `after <id>` or `after proposal <n>` waits for it: `arthur ticket after <new id> <id>`.
3. In the same turn, commit the report, its page, the tickets and the board together, `git push` if `git remote` lists a remote (if the push fails, tell the owner the error; do not retry), then `arthur prune <job id>`.

On `NO PROPOSALS`: file and commit the report and its page, create nothing, and prune.

A retro that did not finish (stopped, past its time limit or its budget, or failed) is never filed, however much of a result it has: `arthur ticket file` refuses it and says why. Create nothing, tell the owner in a line, and `arthur prune <job id>`.

The reply is two lines: the first starts with the exact words `retro done: N tickets`, N the tickets created; the second is `/retro`, which the owner taps to get the page as a file.
