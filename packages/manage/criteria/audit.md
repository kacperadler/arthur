# Audit

What an audit proposes as a ticket (`docs/manage.md` in the manage plugin, "The audit"). The auditor reads this file with its role, the styleguide, and the commits, board, stats and findings its prompt names; the form of its proposals is in its role, not here. Copy this file to the project's `<criteriaDir>/audit.md` and change it to fit the project.

## The question

What would the owner want fixed or improved next, had they spotted it themselves? Every proposal becomes a ticket the owner reads in the morning: it must be worth that minute.

Judge every proposal against the project's vision and its styleguide. One that moves the project toward the vision ranks higher; one that pulls against it is not worth a ticket, however well made.

## Worth a ticket

- A bug with a reproduction: the command, the input, what happens, and what should happen.
- A risk to the owner's work: a worktree, a branch or a record removed without Git's own safety, a file written so a reader can see half of it, a race between two writers.
- A missing test for real behavior: a command, a state change or a message that no test would catch breaking.
- Dead code: an export nobody imports, a branch no input reaches, a field nothing reads.
- Drift between the docs and the code: a command's doc, a role, the README or a ticket's Decisions saying one thing and the code doing another.
- A styleguide break.
- Recurring friction: the same obstacle, workaround or manual fix in several jobs (FAIL reviews, continues, findings, the coordinator's own corrections, as far as the repository shows them), with each occurrence on a line of its own (the job or ticket, what happened) and a proposal that removes it. One occurrence is not friction.
- A small win that saves the owner time: a clearer error that names the next command, a listing that answers a question the owner keeps asking.

## Not worth a ticket

- Taste: naming or structure you would have done differently, when the code already follows the project's way.
- A speculative feature nobody asked for, new workflow state, or a new abstraction.
- Churn: reformatting, reordering or rewording that changes no behavior.
- Anything a ticket on the board already covers.

## Priorities

1. The commits since the last audit: new code has the freshest bugs.
2. Then the rest, starting with what can lose work.
