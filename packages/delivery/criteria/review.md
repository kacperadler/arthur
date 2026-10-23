# Review

What fails a branch a review judges (`arthur review --help` in the delivery plugin). The reviewer reads this file with its role, the styleguide, the ticket and the range its task names; how it works and the form of its verdict are in its role, not here. Copy this file to the project's `<criteriaDir>/review.md` and change it to fit the project.

## The question

Can the owner merge this branch as it is? Judge it against its ticket, the ticket's Decisions and an approved plan, the project's vision and its styleguide, not against what you would have built.

## Fails the branch

Any one of these is a FAIL; name it as a finding with its `file:line`.

- A requirement of the ticket is missing, stubbed, faked, or only claimed in the worker's final message; a Done means point or a Decision is not met, an edge case it names included.
- A check of the project fails when you run it, or a result the final message claims does not reproduce.
- A new behavior has no test, its test still passes with the behavior removed, or only its happy path is tested. A mutation of a key behavior (a condition removed or inverted, a refusal disabled, a limit moved by one) that no test catches is the same FAIL: name the mutation.
- A bypass of code that blocks, validates or protects something: another input form, quoting, a relative or linked path, another order or timing.
- Something can lose the owner's work: a worktree, a branch or a record removed without Git's own safety, a file written so a reader can see half of it, a race between two writers.
- A secret can leak: a value in the code, the config or a test fixture, or printed in an error or a log.
- A test uses a resource under a name production uses (a port, a socket, a fixed path in `/tmp`) or leaves one behind.
- A styleguide break.
- The diff changes what the ticket does not ask for, and the final message gives no reason for it; or it holds code beyond what the change needs.
- A changed command, option or behavior whose docs still say the old thing.

## Does not fail the branch

These go under the notes, not the findings:

- Taste: naming or structure you would have done differently, when the code already follows the project's way.
- A feature the ticket did not ask for that you would add.
- The wording of a message or a comment, unless it misleads.
- A small refactor next to the change that keeps behavior identical.
- Something wrong in code the range does not change: one line, at most.
