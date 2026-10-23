# AR0338 - A secret exported in the shell reaches every job's environment

```json
{
  "id": "AR0338",
  "title": "A secret exported in the shell reaches every job's environment",
  "date": "2026-10-23"
}
```

## Description

the tokens of Telegram, GitHub, YouTrack, the MCP servers and the providers in every job's `env`, which the env guard does not see (its probe answers PASS to `env` and to `cat /proc/self/environ`).

## Goal

A job's environment carries only what Arthur passes it, not secrets exported in the shell that started Arthur; tested.

- Kind: risk

Evidence:
- `packages/core/src/job-scope.ts:68` (`{ ...process.env, ARTHUR_AGENT_MODEL: undefined, ...env }`), `packages/core/src/wrapper.ts:129` (`{ ...process.env, ARTHUR_JOB: folder }`)
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in `launch`, build the environment from `process.env` minus every variable the loaded config's `...Env` options name (`checkEnv(...).variables`, handed to `launch` by the runner) and minus every other `ARTHUR_*` but the job's own; the wrapper the same for the agent. Test in `packages/core/test/scope.test.ts` (or `wrapper.test.ts`): a job spawned with `ARTHUR_TEST_TOKEN` exported, its agent a script that dumps `env` to a file, the file holding `ARTHUR_JOB` and the prepare's variables but not the token; the test sets the variable itself, since `packages/core/src/testing.ts:25` strips `ARTHUR_*` at the start. Out: a provider's key a `prepare` returns on purpose (`check.md`, row 6).
- `npm test` and `npm run check` pass.

## Scope

In:
- in `launch`, build the environment from `process.env` minus every variable the loaded config's `...Env` options name (`checkEnv(...).variables`, handed to `launch` by the runner) and minus every other `ARTHUR_*` but the job's own; the wrapper the same for the agent. Test in `packages/core/test/scope.test.ts` (or `wrapper.test.ts`): a job spawned with `ARTHUR_TEST_TOKEN` exported, its agent a script that dumps `env` to a file, the file holding `ARTHUR_JOB` and the prepare's variables but not the token; the test sets the variable itself, since `packages/core/src/testing.ts:25` strips `ARTHUR_*` at the start. Out: a provider's key a `prepare` returns on purpose (`check.md`, row 6).

## Decisions

- 2026-10-23: Source: F2 of AR0319
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
