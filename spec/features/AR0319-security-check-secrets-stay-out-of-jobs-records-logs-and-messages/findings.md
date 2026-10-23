# AR0319 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

Every entry below is a gap of `check.md` beside this file (its row is named), written as the check that is missing, never as steps of an attack. F1 to F4 confirm the notes F8, F9, F10 and F17 of AR0311.

## F1. MCP secrets lie in every job's record, which every other job can read, until the prune

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `packages/core/src/job-record.ts:31`, `packages/orchestration/src/mcp.ts:95`, `packages/core/src/env-refusal.ts:12` (the guard's names), `packages/core/src/job-records.ts:165` (the one removal, at `arthur prune`)
- Rule: a secret never reaches a job record another job can read (`check.md`, row 8).
- Input not covered: a tool call of any job, or of the coordinator, that names `<home>/jobs/<other job>/mcp/.mcp.json` or `<home>/orchestration/mcp/.mcp.json`: mode 0600 keeps other Linux users out, every job runs as the same user, the env guard names `.env` files only (its probe answers PASS to `cat jobs/j1/mcp/.mcp.json` and to `read` of the same path), and a record's file stays after the job's run ended.
- What: a token meant for one role (the reviewer's GitHub token of the example in `packages/orchestration/docs/commands/coordinator.md`) is readable by every job of every project for as long as the record lives; `coordinator.md:141` says the agent's own tools can read its own file, not that every other job can, nor that it stays.
- Suggestion: remove `<record>/mcp/` when the job's run ends, in the wrapper's end (`packages/core/src/wrapper.ts`, with `commits`), and at `arthur continue` write it again from the role's answer; add `.mcp.json` to the env guard's names (`env-refusal.ts`, `NAME`), with its row in the `PROJECT` table of `packages/core/test/env-guard.test.ts`; say in `coordinator.md`, "MCP servers", that every job of the user can read the file while it exists. Tests: a wrapper test that the record holds no `mcp/` once `state` is `ended` and a continue writes it back; the guard table rows. Out: a sandbox between jobs (AR0320).
- Status: ticket AR0337

## F2. A secret exported in the shell reaches every job's environment

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `packages/core/src/job-scope.ts:68` (`{ ...process.env, ARTHUR_AGENT_MODEL: undefined, ...env }`), `packages/core/src/wrapper.ts:129` (`{ ...process.env, ARTHUR_JOB: folder }`)
- Rule: a secret never reaches a job's environment (`check.md`, row 5).
- Input not covered: `arthur run` or `arthur spawn` started from a shell that exports a `...Env` variable (a shell variable wins over the env file, `packages/core/docs/commands/config.md:14`): the launch and the wrapper pass the process environment whole, so the variable is in the agent's environment and in `/proc/<pid>/environ` of the agent and of every program its tool calls run. The service of `docs/setup.md` passes `PATH` only, so the documented start is not affected; a start by hand, or `arthur spawn` from a shell with the variables, is.
- What: the tokens of Telegram, GitHub, YouTrack, the MCP servers and the providers in every job's `env`, which the env guard does not see (its probe answers PASS to `env` and to `cat /proc/self/environ`).
- Suggestion: in `launch`, build the environment from `process.env` minus every variable the loaded config's `...Env` options name (`checkEnv(...).variables`, handed to `launch` by the runner) and minus every other `ARTHUR_*` but the job's own; the wrapper the same for the agent. Test in `packages/core/test/scope.test.ts` (or `wrapper.test.ts`): a job spawned with `ARTHUR_TEST_TOKEN` exported, its agent a script that dumps `env` to a file, the file holding `ARTHUR_JOB` and the prepare's variables but not the token; the test sets the variable itself, since `packages/core/src/testing.ts:25` strips `ARTHUR_*` at the start. Out: a provider's key a `prepare` returns on purpose (`check.md`, row 6).
- Status: ticket AR0338

## F3. A recursive search from the coordinator's own folder prints the env file

- Kind: risk
- Severity: medium
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `packages/core/src/core-options.ts:33` (`.env` beside the config by default), `packages/orchestration/src/coordinator.ts:118` (the coordinator's agent runs in the folder `arthur run` runs in), `packages/core/src/env-refusal.ts:53-66` (a name in the call's text is the only thing looked for)
- Rule: the env guard covers the ways our own jobs and the coordinator read files (`check.md`, row 22).
- Input not covered: a call that names the folder holding the env file and not the file: the guard's probe answers PASS to `grep -rn TOKEN .`, `rg ARTHUR_ .`, `find . -name '*nv' -exec cat {} +`, `tar cf - . | base64` and to the `grep` tool with `{ pattern: "TOKEN", path: "." }`, each run in a folder with a `.env`. The coordinator's working folder is that folder; a job's worktree holds no `.env` of Arthur's, but may hold a project's.
- What: the honest mistake the guard exists for, a search for a variable's name, puts its value in the coordinator's transcript, which the model provider keeps.
- Suggestion: either of two, the first the smaller: default `core.envFile` to a folder no agent works in (`~/.config/arthur/env`, next to `arthur.env` of `docs/setup.md`, step 8), `arthur setup` and `docs/setup.md` saying so, and `arthur doctor` warning when `core.envFile` lies inside a project's checkout or the config's folder; or refuse, in `envRefusal`, a recursive search (`grep -r`/`-R`, `rg`, `find`, `tar`, `zip`, the `grep` tool with a folder `path`) whose folder, resolved from `cwd`, holds a secrets file, naming it. Tests: a `PROJECT` row per command in `packages/core/test/env-guard.test.ts` (refused in a folder with `.env`, allowed in one without), or a doctor test for the warning.
- Status: ticket AR0339

## F4. The redaction of notices and the decision log reads secrets from an environment that holds none of the env file

- Kind: bug
- Severity: low
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `packages/session/src/credential.ts:9`, `packages/orchestration/src/credential.ts:10` (`Object.entries(process.env)`), their callers `packages/session/src/start-notice.ts:20`, `packages/session/src/turn-extension.ts:44`, `packages/orchestration/src/decision-log.ts:170,190`, `packages/orchestration/src/decision-hooks.ts:27,53`, `packages/orchestration/src/inbox-extension.ts:116`
- Rule: a secret never reaches an error, a notice or the decision log (`check.md`, row 14).
- Input not covered: a value of `core.envFile` outside the shape rules: under the service the loaded values are in each plugin's `host.env`, never in `process.env` (`packages/core/src/host.ts:54`), so the first rule of `redact` matches nothing and only the shapes are left; `redact("perm:dXNlcg==.NDItMQ==.abc12345678901")` and `redact("key hunter2-short")` come back unchanged (a run of under 20 characters, no vendor prefix, no `Bearer`). The tests that prove the first rule set `process.env` themselves (`start-notice.test.ts`, "no LLM access: ..."; `decisions.test.ts`, "a key, a job id and a commit hash ... are redacted ...").
- What: a token in a model's error text, a job's question or the owner's answer reaches a Telegram notice or `spec/decisions.jsonl`, which is committed.
- Suggestion: `redact` takes the values to replace as an argument, and the host hands every plugin, with `host.env`, the set of all loaded values (`host.secrets`, values only, no names; or the core provides `redact` itself in `@arthur/core/credential`, both plugins importing it, which also ends the duplicate); the two `credential.ts` keep the shape rules. Tests: each caller's test with a value in the env file and none in `process.env`, asserting `[redacted]`.
- Status: ticket AR0340

## F5. A blocked job's question goes to the phone as written, while the decision log redacts it

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `packages/orchestration/src/blocked-notice.ts:40-51` (the `notice` text), `packages/orchestration/src/decision-hooks.ts:27` (the same question, redacted, for the log); the hand-over of a job's final message, `packages/orchestration/src/hand-over.ts`, the same way
- Rule: a secret never reaches Telegram (`check.md`, row 18).
- Input not covered: a job's `Blocked: user ...` line, or its final message, holding a secret the job read by a way the guard does not see (a program, a recursive search of a project's folder, F3): the notice and the hand-over send the text as written; `arthur decision` writes `[redacted]` into the log for the same text.
- What: a credential on the owner's phone and in the coordinator's transcript, with the log alone clean.
- Suggestion: pass the notice's text and the hand-over's message through `redact` (with F4's values); test in `packages/orchestration/test/job-states.test.ts` or a blocked-notice test: a job blocked on `user: the key is sk-live-4f9a8b7c6d5e4f3a2b1c?` emits a notice holding `[redacted]`. Out: redacting a job's log or result in its record (its own folder).
- Status: ticket AR0341

## F6. A project's `repo` URL is printed by the clone's refusals, with any credential it holds

- Kind: bug
- Severity: low
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `packages/projects/src/clone.ts:34` (`holds ${url}, not ${repo}`), `packages/projects/src/clone.ts:43` (`git clone ${repo} failed: <git's last line>`)
- Rule: a secret never reaches an error (`check.md`, row 13).
- Input not covered: a `repo` of the form `https://user:token@host/owner/name.git` in `projects.list`, or an existing clone whose origin has that form: both refusals print the URL whole, and git's own last line may repeat it; the refusal is the load's, printed by `arthur run`, `arthur setup` and every command, and kept in the journal. The github plugin's push replaces such a URL with `origin` (`packages/github/src/github-git.ts:56`); the clone does not.
- What: a credential in the service's journal and on the terminal.
- Suggestion: print the URL with its userinfo removed (`new URL(repo)` when it parses, `username` and `password` set to `""`; a `git@host:path` form has none), and replace `\S+://\S+` in git's line as the push does; or refuse at the options check a `repo` with userinfo, telling the owner to use SSH or git's credential helper, as `arthur.config.example.ts:357` says pushes do. Test in `packages/projects/test`: a `repo` with userinfo that fails to clone; the refusal names the host and the path and never the credential.
- Status: ticket AR0342

## F7. Git ignores `.env` only, while `core.envFile` may be any name the guard counts as a secrets file

- Kind: risk
- Severity: low
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `.gitignore:2`, `packages/core/src/core-options.ts:33` (any path), `packages/orchestration/roles/coordinator/plan-ended.md:10` (the coordinator commits in the config's folder), `packages/core/src/env-refusal.ts:12` (`.env<suffix>` is a secrets file to the guard)
- Rule: a secret never reaches a commit (`check.md`, row 19).
- Input not covered: a `core.envFile` named `.env.prod`, `.env.local` or `env` beside the config, which `.gitignore` does not match (`git check-ignore .env.local` prints nothing), followed by a coordinator commit with `git add -A` or `git add .`, which names no secrets file and so passes the guard; `review-needed` (`packages/delivery/src/review-needed.ts:61`) sees a job's branch, not the coordinator's commits on main.
- What: the env file pushed to origin with the ticket and the board.
- Suggestion: `arthur doctor` (the core's requirements, `packages/core/src/requirements.ts`) warns, critical, when `core.envFile` lies inside a Git checkout and `git check-ignore -q <file>` fails; and `.gitignore` takes `.env.*`. Test in `packages/core/test/doctor.test.ts`: a config folder that is a repository with `envFile: "env"` not ignored gets the line; ignored, `ok`.
- Status: ticket AR0343

## F8. A pasted secret of capitals, digits and `_` in a `...Env` option is printed by the refusal

- Kind: bug
- Severity: low
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `packages/core/src/env.ts:24` (`VARIABLE`), `packages/core/src/env.ts:102-103`
- Rule: a `...Env` option's text that is no variable name is not shown, since it may be the secret pasted by mistake (`packages/core/src/env.ts:101`; `check.md`, row 1).
- Input not covered: a pasted value that happens to match `^[A-Z][A-Z0-9_]*$` (an uppercase hex key, a numeric id with a capital first letter): it passes `VARIABLE`, fails the prefix check, and the refusal prints it as `got <value>` (`env.ts:103`), in `arthur config check`, `arthur setup` and the load's refusal.
- What: the one shape of pasted secret the "not shown" rule misses.
- Suggestion: print the name only when it starts with `ARTHUR_` (then it is a name of the wrong owner, which `env.ts:106` already tells), else `the text given is not shown` as `env.ts:102` does. Test in `packages/core/test/env.test.ts`, "an option that is not a name is refused without showing it": one more option whose value is `DEADBEEF0123` and the assertion that no problem line holds it.
- Status: ticket AR0344

## F9. Two docs disagree on what Arthur sends another machine

- Kind: cleanup
- Severity: low
- Found by: 2026-10-23-ar0319-security-check-93862bb2 (worker), 2026-10-23
- Where: `packages/orchestration/docs/commands/coordinator.md:139` ("A job on another machine starts with none, since Arthur sends another machine no secret"), `packages/core/docs/commands/spawn.md:61` ("a secret only as a `prepare`'s variable on the launch's stdin (a provider's key of the models plugin, for the job's agent)"), `packages/core/src/jobs.ts:176` (the spawn's warning says the same as `coordinator.md`)
- Rule: a secret reaches only the code that needs it; what is sent elsewhere is said once, the same everywhere (`check.md`, rows 6 and 24).
- Input not covered: none; the code does what `spawn.md` says (`packages/core/test/machine.test.ts`, "a prepare's variables reach the agent there through the launch's stdin, ...").
- What: the reader of `coordinator.md`, or of the spawn's warning line, takes it that nothing secret leaves the host; a provider's key does.
- Suggestion: `coordinator.md:139` and the warning in `jobs.ts:176` say "Arthur sends another machine no MCP secret" and point to `spawn.md`, "On another machine"; `spawn.md:22` adds that a `prepare`'s variable is in the environment of every tool call of the job too, as `coordinator.md:141` says for MCP. No test: docs only; the warning's test in `machine.test.ts` ("a job on another machine starts with none of its role's MCP servers, and its spawn warns, naming them") changes with the line.
- Status: ticket AR0345
