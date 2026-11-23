# AR0716 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The baseline rate of session/after-restart-agent is a placeholder, not a measurement

- Kind: test
- Found by: 2026-11-23-worker-f865eac7 (worker), 2026-11-23
- Where: `evals/baseline.json:70`
- What: `packages/develop/test/scenarios.test.ts` asks for a rate in the baseline for every scenario, and a job may not run `arthur eval` (it is not an `inJob` command, and it runs the real agent), so the new scenario's entry is `{ "passed": 0, "runs": 1 }`, written by hand. It is the only entry with 1 run. Until it is measured, `arthur eval` compares the scenario against a rate nobody saw. The coordinator's twin, `session/after-restart-plan`, stands at 0 of 3 in the same file, so the agent's may fail as often (an inference: no run of it exists).
- Suggestion: once the branch is merged, run `arthur eval session/after-restart-agent --save-baseline` in the main checkout and commit `evals/baseline.json`. If it fails every run, read the transcripts (`<home>/develop/evals/<time>/session-after-restart-agent-<n>/`) before changing the role.
- Status: open

## F2. Two more texts of the handoff extension call a project agent's session the coordinator

- Kind: fix
- Found by: 2026-11-23-worker-f865eac7 (worker), 2026-11-23
- Where: `packages/session/src/handoff-extension.ts:141`, `packages/session/src/handoff-extension.ts:113`
- What: the session plugin hands the same extension to every session (`packages/session/src/session.ts:65`), so a project agent whose conversation starts with its handoff reads `[Arthur] The coordinator just started again. Before that you wrote this handoff (...)` (line 141), and a handoff it did not write is noted as `no new handoff when the coordinator's turn ended` (line 113), which `arthur run` prints in that agent's `session: agent:<project>: ...` line. The ticket's Scope names only the two request texts, which now say "this session".
- Suggestion: say "This session just started again" and "when the turn ended"; update `packages/session/docs/session.md:33`, `packages/session/test/restart-setup.ts:19` and the tests that quote the second line. Nothing else changes.
- Status: open

## F3. An eval scenario with `agent` runs on the coordinator's model, not the project agents'

- Kind: fix
- Found by: 2026-11-23-worker-f865eac7 (worker), 2026-11-23
- Where: `packages/develop/src/eval-command.ts:64`
- What: `arthur eval` asks `roles.model` for the role `coordinator` once and starts every run with that model and thinking level. A live project agent starts with `roles.project`'s (`packages/orchestration/src/sessions.ts:32`), so where the two differ, `session/after-restart-agent` measures the project role on another model than the one that reads it live. `packages/develop/docs/commands/eval.md` says so ("for a project agent's turn too").
- Suggestion: ask `roles.model` for `project` when the scenario has `agent`, and name both models in the eval's first line.
- Status: open
