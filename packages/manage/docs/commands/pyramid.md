# arthur pyramid

Usage: `arthur pyramid [--project <name>] ['<focus>']`, and `/pyramid [<project>] [<focus>]` on a channel. Comes with the `manage` plugin (AR0563).

Starts one pyramid audit of the project, the main one unless `--project` names another: a read-only job of the kind `pyramid`, and prints `pyramid: started job <id>`. The job reads the project's corrections (FAIL reviews, open and deferred findings, the `arthur repeats` digest, the questions jobs are blocked on for the owner, the steers its jobs got), the prose its agents read and its checks, and ends with proposals that move each correction as high up the pyramid as it goes: the codebase, static analysis, prose, human review (docs/manage.md, "The pyramid audit"). The focus, when given, goes under its task as `Focus: <focus>`.

- `/pyramid` does the same from a channel and answers the same line. Its first word is the project when it names one on the list, else the focus starts there: `/pyramid web-shop flaky tests` audits `web-shop` with the focus `flaky tests`, `/pyramid flaky tests` the main project.
- When it ends, the coordinator's wake brings the procedure: the report filed as `spec/pyramid/<date>.md` with its before and after page `spec/pyramid/<date>.html`, one `planning` ticket with every proposal, the page sent to the owner. Nothing is pre-approved.
- Its budget is `pyramid.budgetUsd`, else the core's `jobs.budgetUsd`.

Refused, exit 1, with nothing started, printing `arthur pyramid: <reason>`:

- A project without a board: `refused by manage: project <name> has no board, <path>/spec/build.json: arthur init <name> first`.
- A pyramid audit of that project in a run: `refused by manage: a pyramid audit of <name> runs already: job <id>; wait for its end, or arthur stop <id>`. Both refusals hold `arthur spawn --kind pyramid` too.
- An unknown project, with the board's refusal; any other refusal of `arthur spawn`, such as `maxAgents` reached.

More than one focus argument, or an unknown flag, prints `usage: arthur pyramid [--project <name>] ['<focus>']` and exits 2. On a channel a refusal answers `/pyramid failed: <reason>`.
