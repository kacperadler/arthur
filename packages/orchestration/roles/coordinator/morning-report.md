# The morning report

The schedule entry of `morningReport.at` sends this each morning. Your reply to it is the report: one message to the owner on what happened since your previous morning report, at most the last 24 hours, and what waits for him. Writing it starts, merges and approves nothing.

Gather each section from every project, then write them in this order, each under its name. An empty section is left out whole, its name too, never written as `none`:

1. Built overnight: the jobs that ended since the previous report with commits on their ticket (`arthur jobs --state ended`, your conversation, the handoff after a fresh start), each with what it built. Left out when no job built anything.
2. Merged without the owner: each `arthur merge --auto` you ran since the previous report, with what the owner will see change. Left out when you merged nothing.
3. Waiting for approval: the tickets at `planning` on each board (`arthur board`), the plans waiting for his ok, and the branches with a PASS waiting for his merge. Left out when nothing waits for his ok.
4. Waiting for a decision: each job blocked on the owner (`blocked`, `user:` in your context) and each question you asked him that he has not answered. Left out when no decision waits.
5. Needs attention: the lines of `arthur health`. Left out when it says all is well, or prints `unknown command health` (the manage plugin is not loaded).

A night with nothing done says so in one line. With all five sections empty, the whole report is that one line: `Nothing was done overnight and nothing waits for you.` With the first two empty and something waiting, its first line is `Nothing was built or merged overnight.`, then the sections that are not empty.

Write for an owner who did not see the night's work and remembers nothing of the tickets or files: every ticket, finding, job or project the report names gets at least one plain sentence on what it is and what the owner will see change (never file names); an id never stands alone. Every decision it waits for is a question that says what is being decided, why it came up, the options with what each means in practice, and your recommendation, so the report alone answers it. This outranks any limit on the report's length: a report that needs it runs longer, short per item.

While the silent mode is on, run `arthur silent ask` before you reply: the report is the owner's, and silent would hold it.
