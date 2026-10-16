# Review

> Guide for review jobs on Arthur. The reviewer reads it with the styleguide, the instruction that produced the branch, the worker's final message, and the diff. It says what "mergeable" means here.

## The question

Can the owner merge this branch as it is? Judge the branch against its instruction and ticket, and against the ticket's entry in `spec/roadmap.md`, not against what you would have built.

## PASS when all hold

- The diff does what the instruction and its `Ticket:` ask, end to end, and meets every Done means point they name, edge cases included.
- `npm ci`, `npm run check` and `npm test` pass when you run them yourself.
- Everything the worker's final message claims (checks, behavior, files) matches what you see.
- The diff changes nothing outside the instruction, unless the final message gives a reason for it.

## FAIL when any one holds

- A requirement is missing, stubbed, faked, or only claimed in the final message.
- A check fails, or a claimed result does not reproduce.
- A boundary breaks: a plugin imports another plugin, a core file by path, or anything outside `@arthur/core`'s published exports; the core imports a plugin; a plugin reads or writes another plugin's folder under `.arthur/`, or reads a file beyond the one path another plugin handed it in an event or a `collect` answer (a message part's `path`).
- The styleguide's Shape rules break: a runtime dependency, an `index.ts`, `types.ts` or `utils.ts`, a class or enum, non-erasable TypeScript, a file over 200 lines, a line budget exceeded.
- A new behavior has no test, its test would still pass with the behavior removed, or only the happy path is tested. A mutation of a key behavior (condition removed or inverted, refusal disabled, limit moved by one) that the tests do not catch is the same FAIL: name the mutation.
- A plugin is tested against another real plugin instead of the fake host, or a fake of an outside service answers in a shape its documentation does not show.
- A test uses a production resource name (tmux socket, systemd unit, bot, port, fixed `/tmp` path, a checkout's `.arthur/`) or leaves one behind.
- Something can lose the owner's work: deleting worktrees, branches or job records without Git's own safety (`git worktree remove` without `--force`, `git branch -d`, not `-D`), or without being asked.
- A secret can leak: a value in the config, a fixture or the code; a value printed in an error or a log; a job able to read `.env`.
- Something listens on a public address, or a text that is not English reaches code, docs or the user.
- Code beyond what the change needs, by the styleguide's Simplest solution.

## How code here should look

- Plain functions in small files, one job per file, in the package that owns the capability (`spec/roadmap.md` names it).
- A plugin is a function that takes its options and returns what the host calls; everything it needs from Arthur comes through the host API.
- Job and board data are plain files; `state` is written last, so a reader who sees a finished state can trust every other file.
- Git is the safety net. Code asks Git and reports Git's refusal in one line instead of forcing.
- Error messages name the id, branch, file, option or variable, and the next command to run.
- Comments are one line above the code and say why, not what.
- A new or changed command updates its doc page, which `arthur <cmd> --help` prints; a new option updates `arthur.config.example.ts`.

## What a worker branch usually looks like

- One to three focused commits, Conventional Commits with the ticket id as the scope.
- A final message that lists what changed, the checks it ran with their real output, and its commits.
- Every new behavior covered by a test in the package's `test/`, edge cases included.

## Not reasons to FAIL

These go under notes, not findings:

- Taste: naming or structure you would have done differently when the code already follows the repo's way.
- Features the instruction did not ask for that you would add.
- Wording of messages and comments, unless it misleads.
- Refactors next to the change that keep behavior identical and stay small.
