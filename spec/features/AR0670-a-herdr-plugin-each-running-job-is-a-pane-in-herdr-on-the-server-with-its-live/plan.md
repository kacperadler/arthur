# AR0670 - Plan

- Job: 2026-11-09-plan-4889b41b
- Planned at: 7fa45b439a75148828f76b8fa8852f1dfdf2e491

## Approach

Two parts. Both run on the machine that runs `arthur run`. Nothing listens on a port, and jobs stay headless in their systemd scopes.

**1. The follow view (core): `arthur jobs --follow <id>`.** This name is final. It takes a full or short id. It prints the job's `log` from its first line, then each new line as it is written. A state line (`state: <state> (<reason>)`, through `told` in `job-state.ts`) is printed at the start and on each change of `state` or `reason`. It ends after its run ends, with exit code 0: `ended`, or `blocked` once the run is over (`inRun` is false). Its last line is the final state.

- **Why it ends at the run's end:** `arthur continue` emits `job-started` again, and the herdr plugin then opens a new tab for the next run.
- **What it reads:** only the job's own files, through `field` and `current` in `job-state.ts`. It never calls the model. It wakes on `fs.watch` of the record folder, as `packages/core/test/wrapper.test.ts:82` already watches one, so it needs no poll interval.
- **Partial input:** a line without its line break, or with a UTF-8 character split across reads, waits until it is complete.
- **Refused:**
  - an unknown id: `findJob`'s refusal, exit 1;
  - a record removed while it follows: `<id>: its record is gone`, exit 1;
  - `--follow` with `--state`: the usage line, exit 2.
- **A job on another machine** works as it is: the sweep copies its `log` and `state` here.
- **The agent's text is not in any file today.** `run-record.ts` writes only the tool lines, `[arthur …]` notes, stderr and non-JSON stdout to `log`; message text reaches only `result`, at the end. So `runRecord.apply` also appends each assistant message's text to `log`, one line per text line, each starting with `> `. It goes through the same `save`, so secret values stay named.
- **Its help:** a `--follow` section in `packages/core/docs/commands/jobs.md`. That is the page `arthur jobs --help` prints; `groupPage` only takes words, not flags.

**2. The `herdr` plugin (`packages/herdr/`).**

- **Options:** none but `enabled`.
- **When it acts:**
  - `setup` registers the event handlers and a `jobs.cleanup` hook.
  - It acts on events only after `start`, so only `arthur run` touches herdr. Other `arthur` processes load it too, and the stats plugin waits for `start` for the same reason.
  - Every herdr call goes through one promise chain, one at a time, as `herdr <args>` (`execFile`, 5 s timeout). Its stdout's `result` is read; a failure is swallowed.
- **Layout:**
  - One herdr workspace labelled `arthur`, found by its label in `herdr workspace list`, or made with `herdr workspace create --label arthur --cwd <arthur run's folder> --no-focus`.
  - Its first tab is renamed `coordinator` and runs `while :; do arthur attach; sleep 5; done`, so it attaches again after each coordinator restart.
  - Each job gets a tab of its own: `tab create --workspace <ws> --label "<ticket> <kind> <short id>" --cwd <arthur run's folder> --no-focus`, with no ticket part for a job without one. Its root pane gets `pane run <pane> "arthur jobs --follow <id>"`.
  - One tab per job, rather than per project, avoids splitting panes too small to read.
- **Starts and reports:**
  - **`job-started`** for a job in a run (checked in `host.jobs.list()`): close that job's tab if one exists, open a new one, then report `working`.
  - **At `start`:** the same for every job in a run, and a report of the current state for every ended job that still has a tab. This covers events replayed before `start` and a herdr that came up later.
  - **`job-state`:** a report through `herdr pane report-agent <pane> --source arthur --agent arthur --state <s> [--message <m>]`:
    - `working` → `working`;
    - `idle` → `working`, message `idle`;
    - `blocked` → `blocked`, message the reason;
    - `ended` → `idle`, message `ended: <reason>`.
- **Prune:** the `jobs.cleanup` hook closes the job's tab (`tab close`). It runs in whichever process prunes, so it does not wait for `start`.
- **herdr missing or not running:**
  - every call fails fast and is ignored; no event and no notice is emitted;
  - `start` never throws, since a failed `start` ends `arthur run` with exit code 1;
  - nothing hooks `beforeSpawn` or `prepare`, so a spawn never depends on herdr;
  - the plugin's own `doctor` gives one requirement, not critical: `herdr: ok`, `missing: herdr not found on PATH`, or `missing: herdr workspace list: <first stderr line>`, or `... did not answer in 5 s`.
  - `arthur doctor` prints it, and `arthur run`'s start sends it at most once a day: that is the "says so once".
- **Jobs on other machines** get a tab too, at no extra code, since their records are copied here. herdr's `--machine` would only matter for a herdr on another machine; it is not used.

**Docs and roadmap:**
- `packages/herdr/docs/herdr.md`;
- roadmap entry 115, `- Tickets: AR0670`, which the roadmap page shows as built once AR0670 merges;
- a `herdr` row in the vision's plugin table;
- a README feature line;
- `arthur.config.example.ts`.

**Left alone:**
- the wrapper's run, the sandbox and the scopes;
- the plugin API: no new host call or event;
- `docs/setup.md`;
- the diagrams (`arthur.mmd`, `docs/architecture/*.mmd`, the README's mermaid block), which do not list the activity plugin either;
- `--machine`.

The plan follows the recommended options of Not available directly.

## Not available directly
- **herdr 0.9.3 cannot report a `done` state.** In `herdr api schema --json`, `PaneAgentState` accepts only `idle|working|blocked|unknown`; `done` exists only as the server's derived `AgentStatus`.
  - Option 1: report `idle` with message `ended: <reason>` - cost none, risk: herdr shows it as done only until the tab is viewed, then as idle [INFERENCE from `herdr --skill`: "idle and done … the server's seen state distinguishes them"].
  - Option 2: `pane release-agent` at the end - cost one call, risk: the sidebar shows no agent at all, so an ended job looks like a plain shell.
  - Option 3: `idle` plus `pane report-metadata --state-label idle=ended` - cost one more call per tab, risk: how herdr displays state labels is not verified here.
  - Recommendation: Option 1
- **No herdr command opens a pane that runs a given command.** In `herdr workspace`, `tab` and `pane` help and in `WorkspaceCreateParams`, `TabCreateParams` and `PaneSplitParams`, creation takes only cwd, env, label and focus.
  - Option 1: create the tab, then `herdr pane run <pane> "<command>"`, which types the line and Enter into its shell - cost none, risk: `arthur` must be on the `PATH` of herdr's shells (setup step 4 puts it in `~/.bashrc`); a miss shows in the tab as `command not found`.
  - Option 2: a tab `--env` that makes the shell's rc file run the command - cost: a shell-specific hack, risk: breaks with another shell or rc file.
  - Option 3: herdr's own plugin API (`plugin.pane.open` in the schema) - cost: a herdr-side plugin besides Arthur's, risk: undocumented here, a second component to install.
  - Recommendation: Option 1

## Files
- `packages/core/src/job-follow.ts` (new, about 70 lines): the follow view, `followJob(home, query, write)`, which resolves to its exit code.
- `packages/core/src/job-commands.ts`:
  - the `jobs` flags get `follow` (`text` from `flags.ts`);
  - `--follow` with `--state` is refused;
  - the usage line becomes `usage: arthur jobs [--state <state> | --follow <id>]`;
  - `--follow` calls `followJob`.
- `packages/core/src/run-record.ts`: a message with text appends its lines to `log`, each starting with `> `; update the header comment.
- `packages/core/docs/commands/jobs.md`: the usage line, and a `## --follow <id>` section: what it prints, when it ends, refusals and exit codes.
- `packages/core/docs/commands/spawn.md` (line 80, the `log` item): the agent's text lines, `> `.
- `packages/core/test/job-follow.test.ts` (new): the follow view's tests (How to test).
- `packages/core/test/wrapper.test.ts`: the log regex of "a finished worker" (around line 128) now expects `> Reading first.` and `> Fixed the README.` / `> All tests pass.` in order.
- `packages/core/test/job-records.test.ts` (lines 499-502): the new usage string; add the `--follow` and `--state` refusal and `--follow` with no value.
- `packages/herdr/package.json` (new): `@arthur/herdr`, version `0.1.0`, `exports` `"."` and `"./options"` → `./src/herdr.ts`, no dependencies.
- `packages/herdr/src/herdr.ts` (new, at most 200 lines):
  - `summary`;
  - `tools` (`herdr`, `["herdr", "--version"]`);
  - an empty `table`;
  - `checkOptions`, which refuses every key;
  - the plugin: `doctor`, `setup` (handlers and cleanup), `start` (the workspace, the coordinator tab, the start-up pass over the records).
- `packages/herdr/src/herdr-cli.ts` (new):
  - one herdr call with its 5 s timeout and its errors: not on PATH, exit code with stderr's first line, timed out;
  - finding the `arthur` workspace;
  - finding a job's tab by its label's last word, the short id, and its pane from `pane list --workspace`;
  - the label.
- `packages/herdr/docs/herdr.md` (new):
  - setup on the server: herdr 0.9.3 in `~/.local/bin`, which is already on the service's `PATH` (setup step 8); its server kept running [INFERENCE: `herdr server` as a systemd user unit, to be checked on the server]; `arthur` on the PATH of interactive shells; `herdr()` in the plugin list; `arthur doctor` shows `herdr: ok`;
  - the workspace, its tabs, and what each herdr state means for a job;
  - other machines.
- `packages/herdr/test/fake-herdr.ts` (new): an executable `herdr` written into a temporary folder for `PATH`.
  - It keeps its workspaces, tabs and panes in a JSON file and logs each call's arguments.
  - It answers each command it serves as `{ id, result: { type, ... } }`, with every key the schema shows.
  - Its modes: server down (stderr `Error: Os { code: 2, kind: NotFound, message: "No such file or directory" }`, exit 1, the same form as the `Os` error the real CLI printed here), hang, and a server error (`{ id, error: { code, message } }` on stderr, exit 1).
- `packages/herdr/test/herdr-shapes.json` and `packages/herdr/test/fake-shapes.test.ts` (new):
  - the keys of `WorkspaceInfo`, `TabInfo`, `PaneInfo` and of each result type the fake answers (`workspace_list`, `workspace_created`, `tab_list`, `tab_created`, `pane_list`, `ok`), recorded from `herdr api schema --json` of 0.9.3, which runs without a server;
  - the test compares them key by key, like `packages/dokploy/test/fake-shapes.test.ts`.
- `packages/herdr/test/herdr.test.ts` (new): the plugin against `fakeHost` and the fake `herdr` (How to test).
- `test/structure.test.ts`: `herdr` gets its first budget, and core's budget goes up (Open questions).
- `test/option-tables.test.ts`:
  - import `@arthur/herdr` and its options;
  - add `herdr` to `PLUGINS`;
  - add it to the list of empty tables;
  - the tools list gets `"herdr"`.
- `package-lock.json`: `npm install` adds the workspace (`plugin-range.test.ts` checks its version).
- `arthur.config.example.ts`: `herdr` in the header's list of built plugins, its import, and a `herdr()` entry with a comment on what it does and its doc path.
- `spec/roadmap.md`:
  - a section `## Herdr` after `## Stats`, with `### 115. Herdr: a tab per job with its live view, its state in herdr's sidebar`;
  - its lines: Package core and herdr; Tickets AR0670; Delivers; Done means; Depends on 15, 16, 71, 80, 93; Size a day; Covers none (new, AR-D587);
  - one order paragraph in the intro, as Uptime's and Video's have: "took the next free number after 114".
- `spec/vision.md`: a plugin-table row `herdr (named) | first | Each job a tab in herdr on this server, running arthur jobs --follow, its state in herdr's sidebar; a tab for arthur attach; nothing listens.`
- `README.md`:
  - a `**herdr**, built: …` feature line with its doc link;
  - the README is at its 120-line cap (`test/structure.test.ts`), so line 9 ("In short; the whole of it is spec/vision.md") and the blank line after it go; "Read more" (line 112) already links the vision.

## Risks
- **Core budget:** core is exactly at its budget (7445 counted lines, measured with `checkStructure`), so any core line fails `test/structure.test.ts` until the raise is approved (Open questions).
- **Double tabs from other processes:** without the `start` gate, a `job-started` emitted in an `arthur spawn` process would open a tab there as well as in `arthur run`. Handlers act only after `start`, and the test asserts nothing happens before it.
- **Out-of-order reports:** `deliver` in `events.ts` does not await async handlers, so a `job-state` could reach herdr before its tab exists. All calls go through one chain, and a test emits `job-started` and `job-state` back to back.
- **Replayed events:** events replayed at `arthur run`'s start arrive before `start` and are dropped. The start-up pass rebuilds the tabs from the records, so nothing is lost or doubled. Every restart reopens the tabs of jobs in a run, which costs the owner his scroll position.
- **herdr down at start:** a `start` that throws ends `arthur run` with exit code 1 (`run.ts`). Every herdr failure is caught inside the plugin, and a test runs `start` with herdr absent, down and hanging.
- **A slow herdr:** each call is capped at 5 s, so the doctor line names herdr rather than the doctor's 10 s cut. A hung herdr delays only the plugin's own chain, never a spawn.
- **A larger log:** messages now go into `log`. A job on another machine copies more bytes per sweep (256 KiB a copy), and a long final report lengthens the log.
- **Tab cost:** each tab is a `node` process that loads the full config and plugins [INFERENCE: tens of MB each]. Each follow's exit logs one `command-ran` event, which the activity plugin records.
- **Unverified herdr behaviour:** the CLI output form `{ id, result }`, a free `--agent arthur` label being accepted, and a plain API command not starting a server are [INFERENCE]. They come from the schema and `herdr --skill`, not from a live server. Inside this checkout `herdr workspace list` fails at `socket(AF_UNIX) = EACCES` (strace), as `spawn.md` says a job's sandbox refuses Unix sockets. The worker cannot run real herdr either: the fake is the evidence, and the owner's run on the server (How to test) settles it.
- **Mutation testing:** timing constants give equivalent mutants. `fs.watch` removes the follow's interval. The 5 s timeout should come from one constant that the doctor line prints, so a ±1 mutant changes text a test asserts.
- **Roadmap number:** 115 is free today (no `115` anywhere in `spec/` or `site/scripts`). A plan merged meanwhile that takes it means renumbering.

## How to test
- **The follow view (core).** `packages/core/test/job-follow.test.ts` waits with `until`, never a fixed time:
  - a job of the fake agent with a message, two tool calls and a gate prints, in order, `> ` text lines, `read README.md`, `bash npm test` and `state: working`; after the gate, `state: ended (finished)`; exit 0;
  - a job blocked on the user at the end of its run ends with `state: blocked (user: …)`;
  - an already ended job prints its whole log and ends at once;
  - a record folder removed mid-follow exits 1 with `<id>: its record is gone`;
  - a hand-made record whose `log` gets `half` and then `line ✓\n` (a UTF-8 character split across two writes) prints `halfline ✓` once;
  - a short id works; an unknown id exits 1 with `findJob`'s refusal.
  - CLI refusals in `job-records.test.ts`: `--follow` with `--state` exits 2, `--follow` with no value exits 2.
  - Updated `wrapper.test.ts`: the `> ` lines are in the log.
  - By hand (verify.md item 4): `npx arthur jobs --help` shows the section, then `arthur jobs --follow <short id>` on a fake-agent job in a temporary folder.
- **The plugin against the fake host and the fake `herdr` on `PATH`** (`herdr.test.ts`):
  - `start` makes workspace `arthur` with tab `coordinator` running the attach loop, cwd `process.cwd()`; a second `start` makes no second workspace.
  - `job-started`, from a real spawn through `fake.host.jobs.spawn` with the fake agent and a ticket path in its task: a tab `AR0001 worker <short>` and `pane run … arthur jobs --follow <id>`, then `report-agent … --state working`.
  - A job with no ticket gets label `worker <short>`.
  - A second `job-started` for the same job closes the old tab first.
  - The `job-state` mapping for `working`, `idle`, `blocked` (with its reason) and `ended` (`idle`, `ended: finished`).
  - A `job-state` for a job without a tab makes no `report-agent` call.
  - Events before `start`: no herdr call.
  - The start-up pass: a job in a run without a tab gets one; an ended job with a tab gets its state.
  - `prune` through `fake.host.jobs.prune` closes the job's tab.
  - herdr absent from `PATH`, down, or hanging: `start` resolves, the spawn's `failed` is undefined and the job ends `finished`, nothing is emitted, and no `plugin herdr: handler … failed` line appears.
  - The doctor lines: ok, missing, down, and did not answer in 5 s.
  - Options: `{}` passes; any key is refused, naming it.
  - `fake-shapes.test.ts`: every answer of the fake matches the recorded 0.9.3 keys.
- **Docs and roadmap:**
  - the files listed exist with the content above;
  - `test/option-tables.test.ts` passes with herdr;
  - the README's 120-line test passes;
  - `site/scripts/roadmap.ts` parses entry 115 with `- Tickets: AR0670`, which turns built when the ticket's status is `merged`.
- **Checks on the clean committed tip,** each in its own bash call:
  - `npm run check`;
  - `npm test` with a timeout of 3600;
  - `npm run mutate -- --max 25`, with no `survived:` line.
- **On the server, after the merge, by the owner** (a job's sandbox cannot reach herdr's socket): the steps of `packages/herdr/docs/herdr.md`.
  - `arthur doctor` shows `herdr: ok`;
  - spawn a job; `ssh` in and run `herdr`: workspace `arthur` with the `coordinator` tab and the job's tab streaming, its sidebar state `working`, then done once it ends;
  - `arthur prune <id>` closes the tab.

## Open questions
- herdr's first line budget, the owner's decision per the styleguide: proposed 250 lines for `packages/herdr/src`, about 230 expected. Record it in the ticket's Decisions.
- The core budget raise: core is at exactly 7445 of its 7445 lines today, and the follow view plus the log's `> ` lines need about 80. Proposed: raise core to at most 7530, the worker setting it to the measured count. Record the reason in Decisions, as a budget raise's goes there.