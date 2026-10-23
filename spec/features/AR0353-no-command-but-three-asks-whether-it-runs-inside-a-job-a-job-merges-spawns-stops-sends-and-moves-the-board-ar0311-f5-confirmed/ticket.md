# AR0353 - No command but three asks whether it runs inside a job: a job merges, spawns, stops, sends and moves the board (AR0311 F5, confirmed)

```json
{
  "id": "AR0353",
  "title": "No command but three asks whether it runs inside a job: a job merges, spawns, stops, sends and moves the board (AR0311 F5, confirmed)",
  "date": "2026-10-23"
}
```

## Description

a job's `bash` call `cd <config folder> && arthur <command> …` runs any registered command as Arthur's user (the develop plugin's own prompt section tells a worker to run the CLI from there, `packages/develop/src/plugin-new.ts:129-130`). With `ARTHUR_JOB` set as the wrapper sets it, the real CLI in a temporary config folder reached the command's own first check for `merge <job> --unreviewed`, `merge --auto`, `spawn … --budget 0 --timeout 0`, `continue … --budget 0`, `stop`, `steer`, `prune`, `send`, `review`, `review-needed`, `ticket status … planned`, `ticket status … --autopilot`, `schedule add --task`, and acted for `stopall`, `ticket new`, `silent on` and `coordinator stop` (the last refused in a live home, where the caller is a running job); only `decision` refused. The worker's role forbids merging and moving a ticket in words (`packages/core/roles/worker.md:37-38`); the coordinator's role holds `stopall`, `send` and `--unreviewed` to the owner's ask in words (`packages/orchestration/roles/coordinator.md:25`, `:31`, `:36`); the three refusals in code are `decision`, `youtrack`'s writes and `plugin new`'s folder. Both guards pass every such line (nothing in `env-refusal.ts` or `worktree-guard.ts` names `arthur`).

## Goal

Arthur's state-changing commands (merge, spawn, stop, steer, prune, send, the board, schedule) refuse to run inside a job unless its role needs them; tested per command.

- Kind: security

Evidence:
- `packages/core/src/cli.ts:44-47` (any command found runs; the one place-of-run gate there is `ARTHUR_EVAL`, `:32-35`); `packages/delivery/src/merge-command.ts:31-45`; `packages/core/src/spawn-command.ts:18-31`; `packages/core/src/job-commands.ts:26-47` (`stop`, `steer`, `continue`, `prune`, `stopall`); `packages/core/src/send-command.ts:19-45`; `packages/core/src/ticket-command.ts:26-56`; `packages/delivery/src/review-command.ts:16-32`, `review-needed.ts:20-45`; `packages/orchestration/src/silent.ts:67-72`; `packages/schedule/src/schedule-command.ts:97-100`; `packages/core/src/remote-job.ts:128`
- Found by: 2026-10-23-ar0323-security-check-4d9a06d2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: one gate in `cli.ts` beside the eval one: when the process runs inside a job (the mark of F2), only a command that declares itself a job's may run, and the rest refuse before the config loads: `arthur <name>: refused inside a job <id>: a job runs only the commands its role needs; put what the coordinator should do in your final message`. The declaration is a field of `Command` (`packages/core/src/commands.ts:13-23`), say `inJob: true`, set by `help`, `version`, `jobs`, `decisions`, `board`, `task`, `plan`, `findings`, `projects`, `machines`, `resources`, `roles`, `stats`, `retro-due`, `health`, `schedule` (list), `youtrack` (its own read check stays), `plugin` (its own `--root` check stays) and `remote-job`'s `records` step; every other command, `merge`, `spawn`, `continue`, `stop`, `stopall`, `steer`, `prune`, `send`, `ticket`, `review`, `review-needed`, `changelog`, `silent`, `schedule add|remove`, `init`, `ci --rerun`, `coordinator`, `restart`, `decision`, `eval`, `run`, `setup`, is refused. Tests in `packages/core/test/cli.test.ts` as the eval test: each refused command with the mark set exits 1 with that line and writes nothing in the home folder; each allowed one runs; `commands.test.ts`: a command registered with `inJob` that is not `true` or absent is refused at registration. The docs: `docs/commands/help.md` (the rule and the list), `packages/core/roles/worker.md` ("Never" gets the refusal's wording), and `docs/deploy.md`'s threat model. Out: what a job may do with `bash` otherwise (AR0320 F1, the sandbox) and what the coordinator may do on text from outside (AR0322).
- `npm test` and `npm run check` pass.

## Scope

In:
- one gate in `cli.ts` beside the eval one: when the process runs inside a job (the mark of F2), only a command that declares itself a job's may run, and the rest refuse before the config loads: `arthur <name>: refused inside a job <id>: a job runs only the commands its role needs; put what the coordinator should do in your final message`. The declaration is a field of `Command` (`packages/core/src/commands.ts:13-23`), say `inJob: true`, set by `help`, `version`, `jobs`, `decisions`, `board`, `task`, `plan`, `findings`, `projects`, `machines`, `resources`, `roles`, `stats`, `retro-due`, `health`, `schedule` (list), `youtrack` (its own read check stays), `plugin` (its own `--root` check stays) and `remote-job`'s `records` step; every other command, `merge`, `spawn`, `continue`, `stop`, `stopall`, `steer`, `prune`, `send`, `ticket`, `review`, `review-needed`, `changelog`, `silent`, `schedule add|remove`, `init`, `ci --rerun`, `coordinator`, `restart`, `decision`, `eval`, `run`, `setup`, is refused. Tests in `packages/core/test/cli.test.ts` as the eval test: each refused command with the mark set exits 1 with that line and writes nothing in the home folder; each allowed one runs; `commands.test.ts`: a command registered with `inJob` that is not `true` or absent is refused at registration. The docs: `docs/commands/help.md` (the rule and the list), `packages/core/roles/worker.md` ("Never" gets the refusal's wording), and `docs/deploy.md`'s threat model. Out: what a job may do with `bash` otherwise (AR0320 F1, the sandbox) and what the coordinator may do on text from outside (AR0322).

## Decisions

- 2026-10-23: Source: F1 of AR0323
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
- 2026-10-23: The owner: weekly cap raised to 40%; fixes one at a time to avoid conflicts, criticals first (AR0329, AR0346), then highs (AR0330, AR0331, AR0347, AR0349, AR0353, AR0370).
