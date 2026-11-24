# AR0716 - Outcome

- Merged: 2026-11-24, `75f8c7b3`
- Branch: arthur/2026-11-23-worker-f865eac7
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $12.44, reviews $2.26; review rounds 2

## What went in

- docs/plugin-api.md: records that `coordinator.checkoutContext` also takes `agent`, a boolean, in the change list and the provided-names table.
- evals/baseline.json: holds a placeholder rate, 0 of 1, for `session/after-restart-agent`, to be measured after the merge.
- packages/develop/docs/commands/eval.md: documents the scenario key `agent`, its two refusals (a path outside the repository as written, a fixture link on the path), the turn's `ARTHUR_SESSION_FOLDER`, the project role's context, and lists `after-restart-agent`.
- packages/develop/src/eval-command.ts: asks orchestration for a project agent's context when the scenario has `agent`.
- packages/develop/src/eval-run.ts: makes the scenario's `agent` folder in the run's repository, never through a link the fixture ships, and names it in the turn's `ARTHUR_SESSION_FOLDER`.
- packages/develop/src/eval-scenario.ts: reads a scenario's `agent`, refusing a path that is not text, is absolute, or as written is not inside the repository.
- packages/develop/test/eval.test.ts: tests an `agent` scenario's context, folder and variable, each refused path (the cwd-name ones included), three fixtures with a link, and that a live `ARTHUR_SESSION_FOLDER` never reaches a turn.
- packages/develop/test/scenarios.test.ts: plays the right and wrong turn of `session/after-restart-agent`; counts 20 scenarios.
- packages/orchestration/docs/commands/coordinator.md: documents `agent` on `coordinator.checkoutContext` and its refusal message.
- packages/orchestration/roles/project.md: tells a project agent to write the owner's after-restart steps to `$ARTHUR_SESSION_FOLDER/after-restart.md`, not the coordinator's file.
- packages/orchestration/src/context.ts: a checkout's context is the project role's when `agent` is true.
- packages/orchestration/src/orchestration.ts: `coordinator.checkoutContext` takes `agent` and refuses anything but a boolean.
- packages/orchestration/test/context.test.ts: tests the checkout context with `agent` true, false and wrong values.
- packages/session/docs/commands/restart.md: says `after-restart.md` is written by the coordinator, or by a project agent in its own folder.
- packages/session/evals/after-restart-agent/scenario.json: the project agent's scenario: steps expected in `.arthur/session/agents/arthur/after-restart.md`, none in `.arthur/session/after-restart.md`.
- packages/session/evals/after-restart-agent/fixture/.gitignore: the fixture's ignore of `.arthur/`, copied from `after-restart-plan`.
- packages/session/evals/after-restart-agent/fixture/README.md: the fixture's README, copied from `after-restart-plan`.
- packages/session/evals/after-restart-agent/fixture/spec/build.json: the fixture's board, copied from `after-restart-plan`.
- packages/session/evals/after-restart-agent/fixture/spec/features/AR0090-name-the-machine-in-arthur-jobs/review-1.md: the fixture's review, copied from `after-restart-plan`.
- packages/session/evals/after-restart-agent/fixture/spec/features/AR0090-name-the-machine-in-arthur-jobs/ticket.md: the fixture's merged ticket, copied from `after-restart-plan`.
- packages/session/evals/after-restart-agent/fixture/spec/features/AR0091-sort-arthur-jobs-by-machine/ticket.md: the fixture's unblocked ticket, copied from `after-restart-plan`.
- packages/session/evals/after-restart-agent/fixture/spec/vision.md: the fixture's vision, copied from `after-restart-plan`.
- packages/session/roles/coordinator/handoff-fresh.md: the fresh-start handoff request says "this session restarts in a fresh conversation".
- packages/session/roles/coordinator/handoff-restart.md: the restart handoff request says "this session restarts and goes on with this conversation".
- packages/session/test/handoff-extension.test.ts: pins the two new request texts word for word.
- packages/session/test/restart-command.test.ts: expects the new restart request text.
- packages/session/test/restart-setup.ts: its `ask` helper builds the request with "this session restarts".
- packages/session/test/service.test.ts: expects the new restart request text.
- packages/session/test/sessions.test.ts: expects the new restart request text in a project agent's session.
- spec/features/AR0716-a-project-agent-is-never-told-where-its-after-restart-steps-go-and-its-handoff/findings.md: findings F1 to F4, all open.
- spec/roadmap.md: entries 67 and 68 name the project agent's turn and scenario (AR0716).
- test/structure.test.ts: the develop line budget is 769, up from 760.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1853/1924 passed.

## Left open

- Deferred (client summary): F1. The baseline rate of session/after-restart-agent is a placeholder, not a measurement
- Deferred (client summary): F2. Two more texts of the handoff extension call a project agent's session the coordinator
- Deferred (client summary): F3. An eval scenario with `agent` runs on the coordinator's model, not the project agents'
- Deferred (client summary): F4. A link the fixture ships takes the eval stub's files out of the run's repository
- Deferred (client summary): F5. a project agent's eval turn has no `ARTHUR_PROJECT`, though `project.md:10` says Arthur sets it
