# AR0276 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The eval words a turn with a copy of orchestration's wake and inbox lines, which can drift

- Kind: risk
- Found by: 2026-10-22-ar0276-evals-runner-eda48620 (worker), 2026-10-22
- Where: `packages/develop/src/eval-scenario.ts` (`turnText`), copying `packages/orchestration/src/inbox.ts` (`wake`) and `packages/orchestration/src/inbox-extension.ts` (the `[Arthur]` / `[via <channel>]` marks and the `ARTHUR` line)
- What: develop may not import orchestration, and no provided name gives the text the inbox hands the coordinator for an event, so `arthur eval` builds the turn with its own copy of that wording. A change to the wake's or the inbox's wording in orchestration leaves the evals replaying the old text, and nothing fails.
- Suggestion: orchestration provides a name (say `coordinator.turn`) answering `(event name, data, result)` with the text its inbox would queue for it, the wake with the plugins' `coordinator.wake` lines included; develop asks it and drops its copy. Out: the inbox's queueing itself.
- Status: open

## F2. In an eval run, `arthur <command> --help` answers only what the scenario's stub says

- Kind: improvement
- Found by: 2026-10-22-ar0276-evals-runner-eda48620 (worker), 2026-10-22
- Where: `packages/develop/src/eval-stub.ts`
- What: the coordinator reads a command's page with `arthur <command> --help` before it acts; in a run the stub prints nothing for it unless the scenario's `stub` has an answer for that line, so a turn that reads the help sees an empty page where the live coordinator sees the doc. No member of the published host API lists the registered commands with their doc pages (`commands.phone()` lists only phone commands), so develop cannot print them.
- Suggestion: a host member (or provided name) that lists every registered command with its doc URL, recorded in docs/plugin-api.md; the stub prints the page for `--help` and `arthur help <command>`, noting the call as help so no expectation counts it.
- Status: open

## F3. An eval turn gets the coordinator's role but not its context, nor a time of day

- Kind: improvement
- Found by: 2026-10-22-ar0276-evals-runner-eda48620 (worker), 2026-10-22
- Where: `packages/develop/src/eval-command.ts` (`host.jobs.prompt("coordinator")`)
- What: the live coordinator reads `arthur coordinator context` before every turn: its role, the board digest, the jobs by state, the plugins' context lines and the local time. In a run the real CLI refuses (the eval session), so the turn's system prompt is the role and criteria alone, built for the main project, not the fixture's board, and the agent's clock is the machine's. A scenario whose procedure depends on the board in the context, or on the hour (night answers, quiet hours), cannot be replayed as the coordinator sees it.
- Suggestion: orchestration provides the context for a given checkout (its board and visions, no live jobs), develop appends it for the fixture's copy; and a scenario `hour`, the session's `TZ` set so the local hour is that one, as the predecessor's evals did.
- Status: open
