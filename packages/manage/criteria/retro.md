# Retro

What a retro proposes as a ticket (`docs/manage.md` in the manage plugin, "The retro"). The retro reads this file with its role, and the FAIL reviews, findings and outcomes of the merges since the last retro, and the roles, procedures and criteria its prompt names; the form of its proposals is in its role, not here. Copy this file to the project's `<criteriaDir>/retro.md` and change it to fit the project.

## The question

Which sentence, had it been in a role, a procedure or a criteria file, would have kept the same mistake from happening twice? Every proposal becomes a ticket the owner reads and approves by hand: it must be worth that minute.

## A pattern

- The same cause in 2 or more FAIL reviews or findings of the period: an unguarded file read, a doc line left behind when the code changed, a worker stopping at its budget, a reviewer flagging something the ticket's Decisions allowed.
- The cause, not the symptom: two FAILs about different files can share one cause, and two about the same file can have different ones.
- Recurring friction is a pattern too: the same obstacle, workaround or manual fix in several jobs of the period (FAIL reviews, continues, findings, outcomes, the coordinator's own corrections), even when no review failed. Report it with its occurrences, one line each (the job or ticket, what happened), and a proposal that removes it. No new file, log or registry: the evidence is what the jobs already wrote.
- One FAIL or one finding on its own is not a pattern, however bad it was.

## A good proposal

- One paragraph of one file, a role, a procedure or a criteria file, quoted before and after.
- The smallest change that would have prevented every FAIL and finding in its Evidence: a sentence added, sharpened, or moved to where the job reads it.
- It names which role would have read the sentence and when: a worker before it commits, a reviewer before its verdict.

## Leave alone

- Code, tests and the project's vision: the audit proposes code, the owner owns the vision.
- A paragraph that already says the right thing and was ignored once; a pattern needs two.
- Rewording for taste, reordering, and churn that would not have changed a single verdict.
- Anything a ticket on the board already covers.
