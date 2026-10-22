# Autopilot

The coordinator's judgement on pre-approving a ticket by policy (`arthur coordinator --help`, "Autopilot"). Copy this file to the project's `<criteriaDir>/autopilot.md` and change it to fit the project.

## The question

Would the owner, reading this ticket cold, approve it without asking anything? If a question comes to mind, the ticket waits for the owner.

## Pre-approved when all hold

`arthur ticket status <id> planned --autopilot` checks these and refuses otherwise: the ticket came from a finding or an audit, its kind is bug or cleanup, its Scope names at most 3 files and none on the always-review list, its budget is above 0 and within the cap.

Before running it, the coordinator also checks what the command cannot:

- The Goal names the defect or the dead weight with its evidence (a file and line, a command and its output), not a wish.
- Done means names the test that fails before the change and passes after it.
- The fix decides nothing for the owner: no new option, command, message wording, dependency or behaviour a user would notice beyond the fix itself.
- The Scope names every file the change needs; a fix that grows past it is a new ticket, not a larger one.
- The finding or audit proposal it came from does not ask for the owner's word.

## What pre-approval does not change

- The worker runs with the recorded budget (`--budget`), and its review and merge go as for any ticket.
- The coordinator names every ticket it pre-approved in its next message to the owner, who may set it back to planning or drop it.
- A refusal is not a reason to rewrite the ticket until it passes: it waits for the owner.
