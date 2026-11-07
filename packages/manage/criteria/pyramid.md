# Pyramid

What a pyramid audit proposes (`docs/manage.md` in the manage plugin, "The pyramid audit"). The pyramid role reads this file with the corrections, prose and checks its prompt names; the form of its proposals is in its role, not here. Copy this file to the project's `<criteriaDir>/pyramid.md` and change it to fit the project.

## The four layers

Highest first; most effort belongs at the top, least at the bottom.

1. The codebase: types, invariants, boundaries, a default that makes the easy thing the right thing. A mistake it rules out cannot happen.
2. Static analysis: tests, type checks, lint, CI, a guard. A mistake it catches never reaches a review.
3. Prose: a role, a rule, AGENTS.md, a criteria file, a procedure. A mistake it names is still made when the sentence is missed.
4. Human review: a FAIL, a finding, a steer, the owner's answer. Each one is a correction a higher layer did not hold.

## The question

Each time an agent is corrected, how high up could that correction have been held? Every proposal is part of one ticket the owner reads and approves by hand: it must be worth that minute.

## Moving up

- A correction caught twice at a lower layer moves up: the same cause in two FAILs, findings or steers becomes a sentence at least, a sentence broken twice becomes a check, a check that keeps firing on the same mistake becomes code that cannot make it.
- The cause, not the symptom: two corrections about different files can share one cause, and two about the same file can have different ones.
- Move to the highest layer that holds every correction in the proposal; a lower one only with the reason the higher cannot hold it.
- A project with no Arthur history: its fix-up, revert and "address review" commits are its corrections.

## Dead prose

- A prose line the code now enforces is dead: a type, a check or a test that fails without it makes the sentence redundant. Propose deleting it, with its file and line.
- A proposal that adds a check or code names the prose it makes removable, so the prose shrinks as the pyramid fills.

## Leave alone

- The project's vision: the owner owns it.
- A correction seen once: a pattern needs two.
- Anything a ticket on the board already covers.
- Rewording for taste, and churn that would not have changed a single correction.
