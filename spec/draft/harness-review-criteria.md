# Review

> Project-owned guide for review jobs. The reviewer reads it with the styleguide, the instruction that produced the branch, the worker's final message, and the diff. It says what "mergeable" means here. The output format is in `roles/reviewer.md`, not here.

## The question

Can the human merge this branch as it is? Judge the branch against its instruction and ticket, not against what you would have built.

## PASS when all hold

- The diff does what the instruction and its `Ticket:` ask, end to end, and meets every acceptance point they name.
- `npm run check` and `npm test` pass when you run them yourself. Run `npm ci` first if the worktree has no `node_modules`.
- Everything the worker's final message claims (checks, behavior, files) matches what you see.
- The diff changes nothing outside the instruction, unless the final message gives a reason for it.

## FAIL when any one holds

- A requirement is missing, stubbed, faked, or only claimed in the final message.
- A check fails, or a claimed result does not reproduce.
- Existing behavior changes without the instruction asking for it: command output, usage lines, job files, state transitions, or the wake and Telegram messages.
- Something can lose the human's work: deleting worktrees, branches, or `.h/jobs` records without Git's own safety (`git worktree remove` without `--force`, `git branch -d`, not `-D`), or without the human asking.
- The styleguide's Shape rules break: a runtime dependency, an `index.ts`, `types.ts` or `utils.ts`, a class or enum, or a line budget exceeded.
- Code beyond what the change needs, by the styleguide's Simplest solution.
- A new behavior has no test, or its test would still pass with the behavior removed. A mutation of a key behavior (condition removed or inverted, refusal disabled) that the tests do not catch is the same FAIL: name the mutation.

## How code here should look

- Plain functions in small files, one job per file. Names use the repo's words: job, worktree, pulse, wake, ticket, board.
- Job data is plain files under `.h/jobs/<id>/`, written with `writeField`. `state` is written last, so a reader who sees a finished state can trust every other file.
- Git is the safety net. Code asks Git and reports Git's refusal in one line instead of forcing.
- Error messages name the id, branch, or file and the next command to run.
- Comments are one line above the code and say why, not what.
- Tests use a real Git repo in a temp directory and real files. Only `omp` is faked, as a script on `PATH`. An eval scenario is scored the same way: by what the run left behind (the file as committed, the refs, the stub's `h.log`), never by which tool ran or what text a call's arguments held.
- A new or changed command or flag updates the usage line in `src/main.ts`, `.env.example` for an `H_` variable, and `docs/commands/<cmd>.md`; `roles/coordinator.md` gets at most one line, when to run it and what its result means. A description of how it works added to `roles/coordinator.md` is a FAIL. So is a procedure for a rare event added to `roles/coordinator.md` instead of `roles/coordinator/<event>.md`, which the harness sends with the event.

## What a worker branch usually looks like

- One to three focused commits on `h/<job id>`, based on the HEAD the job started from.
- A final message that lists what changed, the checks it ran with their real output, and its commits.
- Every new behavior covered by a test in `test/`.

## Not reasons to FAIL

These go under notes, not findings:

- Taste: naming or structure you would have done differently when the code already follows the repo's way.
- Features the instruction did not ask for that you would add.
- Wording of messages and comments, unless it misleads.
- Refactors next to the change that keep behavior identical and stay small.
