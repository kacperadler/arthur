# arthur plan

Usage: `arthur plan <id>`; on a channel `/plan <id>`. Comes with the `orchestration` plugin, which every config holds, with the planning of large tickets below.

A ticket's status and its `plan.md` as the project's main checkout holds it, whole, answered without the model: the first line is `<id> <status>`, then the file. A ticket without one answers `<id>: no plan (<path> does not exist)`. A channel sends a long reply in slices.

The id is `14` (the number alone, in the main project, or in `--project <name>` in the shell), `AR14`, or the full id `AR0014`, letters in either case. Its prefix picks the project, so an id with another project's prefix answers from that project's board.

Refused: a prefix no project has (`unknown prefix <prefix>; prefixes: ...`); an id not on its project's board (`<id>: not on the board of project <name>`); a `plan.md` that exists but cannot be read; a board file broken by hand; an unknown `--project`. In the shell these exit 1; on a channel the reply is `/plan failed: <reason>`. When `arthur.config.ts` does not load, the command is not there: `arthur plan` prints `arthur: unknown command plan`, the core's commands and why the config did not load, and exits 2.

Wrong usage (no id, more than one word, anything but letters then digits): `usage: /plan <id>` on a channel, `usage: arthur plan <id>` and exit code 2 in the shell.

## Planning of large tickets

A ticket with the line `- Plan: yes` under its `## Goal` gets a plan the owner approves before any code. The flow, which the coordinator follows from the procedure its wake carries (`packages/orchestration/roles/coordinator/plan-ended.md`):

1. `arthur spawn --kind plan 'Ticket: spec/features/<id>-<slug>/ticket.md'` starts a planner: role `planner` (`packages/orchestration/roles/planner.md`), read-only, in a detached checkout of HEAD, on `roles.planner` of the options or the agent's own model. Lines below the `Ticket:` line, such as what the owner wants changed in an earlier plan, are the planner's too. Its final message is the plan: approach, what is not available directly, files, risks, how to test, open questions. Its budget is `plan.budgetUsd` (default 5), with one resume at the budget, the budget doubled (`arthur spawn --help`); `--budget` wins.
2. `arthur ticket file <id> <plan job>` files it as the ticket's `plan.md` (below); the coordinator commits it and sends the owner the plan in a few lines.
3. The coordinator asks the owner with `arthur decision ask --kind plan --ticket <id>`, naming the decision id; on his ok, `arthur decision answer <decision id> --decided 'Plan approved by the owner: plan.md at <commit>' '<his words>'` writes `- YYYY-MM-DD: Plan approved by the owner: plan.md at <commit>; the owner: "<his words>" (<decision id>)` under the ticket's Decisions (`arthur decision --help`); then it sets the ticket `planned`, commits, and spawns the worker with `Ticket: spec/features/<id>-<slug>/ticket.md` and `Plan: spec/features/<id>-<slug>/plan.md`.

`arthur spawn --kind plan-review 'Ticket: spec/features/<id>-<slug>/ticket.md'` reviews the committed `plan.md`, when the owner asks: role `plan-reviewer` (`packages/orchestration/roles/plan-reviewer.md`), read-only, in a detached checkout of HEAD, on `roles.plan-reviewer` or the agent's own model, with the core's limits (`core.jobs`). Its final message ends with the verdict `PASS` or `FAIL` on its last line: the kind is registered with `verdicts: ["PASS", "FAIL"]`, so a run without one is resumed once and then ends `failed: no verdict: ...` (`arthur spawn --help`), and is never filed. Neither kind moves a ticket.

Each job's end wakes the coordinator with the procedure of `plan-ended.md` after the first lines of the job's final message (`arthur coordinator --help`, "The coordinator's inbox").

### Refused before a spawn

Each refusal comes before any worktree or record exists, as `refused by orchestration: <reason>`:

- A plan or a plan review whose task does not name exactly one ticket, as `Ticket: spec/features/<id>-<slug>/ticket.md`: `a plan job names its one ticket on a line Ticket: spec/features/<id>-<slug>/ticket.md; its task names none` (or the paths it names). So every such job carries its ticket, and placement (the machines plugin's `jobs.place`) reads the ticket's `requires` labels.
- A plan or a plan review of a ticket not on the board: `<id> is not on the board`.
- A plan review of a ticket whose `plan.md` is not committed at HEAD: `<id> has no committed plan.md to review; file its plan first (arthur ticket file <id> <plan job>) and commit it`.
- A worker (a spawn or `arthur continue`) whose `Ticket:` files lie in a ticket whose `ticket.md` at HEAD has `- Plan: yes` under its Goal, one reason per such ticket, joined by `; `:
  - no `plan.md` committed at HEAD: `<id> says "- Plan: yes" and has no committed plan.md; plan it first: arthur spawn --kind plan 'Ticket: <folder>/ticket.md', then the owner's ok`;
  - no line `- YYYY-MM-DD: Plan approved by the owner: plan.md at <commit>` under the ticket's `## Decisions` names a commit whose `plan.md` is the one at HEAD, so a plan filed again after the approval needs a new one: `<id>: its plan.md at HEAD is not one the owner approved: ...`;
  - the task has no line `Plan: <folder>/plan.md`: `<id>: the task needs the line Plan: <folder>/plan.md, so the worker follows the approved plan`.
  The core refuses a worker on a ticket still in `planning` on its own (`arthur spawn --help`). A ticket without the line, and every other kind, is not checked.

### Filing

`arthur ticket file <id> <job>` (`arthur ticket --help`) files a plan or a plan review that finished on ticket `<id>`, and prints the path it wrote:

- A plan replaces `spec/features/<id>-<slug>/plan.md`, so a ticket planned again keeps one `plan.md`, its earlier versions in Git history. The file is `# <id> - Plan`, the lines `- Job: <job>` and `- Planned at: <commit it started from>`, a blank line, then the final message byte for byte. It is written to `.plan.md.<pid>` in the folder and renamed, so a reader never sees half of it.
- A plan review becomes the next `plan-review-N.md` in the ticket's folder, one above the highest N there, so the numbers go on after a gap: `# <id> - Plan review <N>`, `- Job: <job>`, `- Plan reviewed: <folder>/plan.md at <commit>`, `- Verdict: PASS`, `FAIL` or `none` (the last non-empty line of the final message, exactly one of the two), a blank line, then the final message. It never replaces a file: a job already filed is refused (`<job> is already filed as <path>`), and a second filer that took the same N meanwhile is refused (`<path> was written meanwhile; file <job> again`).

The coordinator commits what was filed; a worker's spawn reads `plan.md` at HEAD.

## Options

`plan: { budgetUsd }` in `orchestration({ ... })`: the budget of a plan job in USD, 0 or more, `0` no limit; default 5, since plans of the harness Arthur replaces stopped at $2 twice. The models are `roles.planner` and `roles.plan-reviewer` (`arthur coordinator --help`, "Options").
