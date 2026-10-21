import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkStructure } from "./structure.ts";

// The line budget of each package: the number of lines its src/ may hold. They live here only; a raise is a decision recorded in its ticket.
// core: 4372 after AR0018. The core line review (AR0069, spec/quality/core-lines-2026-10-16.md) set one budget for entries 1 to
// 22: 5080 lines for the core and its test kit together. 4189 after the cuts AR0073 to AR0078 and the bug tickets AR0068, AR0070
// and AR0071; the allotment per entry on top: 16 (job state): 250, 21 (another machine: spawn and run): 350, 22 (another machine:
// stop and offline): 200, the open core bug tickets: 95, of which those three took 9. An entry that needs more than its allotment
// cuts elsewhere, or its ticket records the overrun as a decision. The test kit (testing.ts, fake-agent.ts: 268 lines) has a budget
// of its own, so production growth shows on its own: an entry that grows the kit moves lines from core to core/testing.
// projects: 320, set by AR0087 (roadmap 41) for the project list, its context lines, `arthur projects`, the clone and the install.
// AR0094 (roadmap 23): 8 lines from core to core/testing, the fake agent asking `tool_call` handlers as omp does; orchestration:
// 300 for the plugin's options, the coordinator's process, `arthur attach` and `arthur coordinator stop` (276 at the merge).
// AR0080 (proposal B3 of the line review): `/board`, `/task` and `/findings` move from core to orchestration, with
// `host.jobs.list()` and `host.board.full()` in the core; core: 91 lines less (4713), orchestration: 98 more (398).
// AR0084 (roadmap 24): the coordinator's inbox, its OMP extension and the wake, orchestration 260 more (658); the fake agent's
// interactive session moves 64 lines from core to core/testing (4649 and 340), with `host.jobs.result(id)` in the core.
// AR0110 (roadmap 26): `maxAgents`, each role's model and the quick model, orchestration 32 more (690).
// AR0112: the wait before a failed turn's messages go again, its notice, and a new owner message ending it, orchestration 7 more (697).
// AR0111: the inbox's watchdog for a hand-over omp takes and loses, and for a turn that says it goes on and does not, orchestration 21 more (718).
// machines: 280, set by AR0124 (roadmap 30) for the machine list, labels, the SSH checks, `arthur machines` and the doctor lines.
// AR0120 (roadmap 25): the coordinator's context on every turn, its OMP extension, `arthur coordinator context` and the coordinator's
// role registered, orchestration 87 more (805); core within its budget (`host.jobs.prompt`/`vision`, `collectEach`, `prompts`).
// AR0121 (roadmap 27): the jobs not ended in the coordinator's context, the wake's question, the blocked notice and the footer's
// counts by state, orchestration 70 more (875); core within its budget (`since` in `host.jobs.list()`).
// AR0126 (roadmap 32): each job's own CPU and memory caps on its scope, `jobs.limits`, the memory watch of the wrapper (cgroup
// `oom` events, or `ps` samples without a scope) and the once-per-machine notice: core 102 more (4751); resources: 42.
// AR0125 (roadmap 31): placing a job by labels (`--requires`, a ticket's, a project's), machines 95 more (375); core 13 more
// (4764) for `arthur spawn --requires` and `jobs.place` asked about every spawn, main's core being at its 4751 after AR0126.
// AR0123 (roadmap 28): planning of large tickets, the kinds plan and plan-review with their filing, the plan guard on a worker
// and `/plan`, orchestration 132 more; core 64 more for `arthur ticket file`, `host.jobs.file` and a kind's `file`
// (ticket-file.ts), and the kinds' registry moved out of jobs.ts (job-kinds.ts) to keep that file under 200 lines.
// AR0143 (roadmap 35): compaction during the day; orchestration 17 more (892) to load another plugin's OMP extension into the
// coordinator's agent (`coordinator.extension`), which the session plugin needs and cannot add itself; session: 213; the fake
// agent's `ctx.compact` and `hasPendingMessages`, core/testing within its budget (335).
// AR0141 (roadmap 33): caps per feature; core 22 more (4786) for the ticket's slice, `ran`, `cost`/`budget`/`seconds` in
// `host.jobs.list()` and `block(..., stop)`; resources 189 more (231) for `perFeature`, a ticket's `caps`, the sweep and `arthur resources`.
// Merged: core 4786 + 64 (AR0123) = 4850, orchestration 892 + 132 (AR0123) = 1024.
// AR0140 (roadmap 29): autopilot, `ticket.autopilot` with its rules, its record and the move, and the option check of its cap,
// orchestration 111 more (1135); core 14 more (4864) for `arthur ticket status <id> planned --autopilot [--budget]` asking it.
// AR0144 (roadmap 36): the fresh start at `freshAt`, `/restart` and `/restart fresh`, the handoff read at every start and the
// `Restarted.` notice, session 240 more (453); orchestration 11 more (903 alone; 1024 + 11 = 1035 merged with AR0123) for `coordinator.restart` and the start without
// `--continue` after it, which the session plugin needs and cannot do itself.
// AR0142 (roadmap 34): how many jobs run from each machine's free CPU and memory; core 2 more (4852 merged) for `host.jobs.machines()`,
// the list of registered machines a plugin had no way to read; resources 170 more (401) for `keepFree`, the check of each
// machine kept per machine, the room, `resources.free`, the spawn check, the context lines and `arthur resources`/`/resources`.
// Merged with AR0140: core 4852 + 14 = 4866, orchestration 1035 + 111 = 1146.
// AR0153 (roadmap 37): the restart guard; core 7 more (4859 alone; 4866 + 7 = 4873 merged with AR0140) for `host.code`, the
// package folders of the code a load runs, which the session plugin has no other way to know, and `--ignore-restart` reaching
// the `beforeSpawn` checks; session 86 more (539) for the note at the start, the comparison with HEAD, the spawn check, the
// context line and `restartGuard`.
// AR0158 (roadmap 39): schedule entries and the sweep, schedule: 277, for the entries' checks and slots, the claims of the run
// state and the sweep; core unchanged.
// AR0157 (roadmap 38): the start notice and the LLM probe; session 152 more (691) for the probe of the coordinator's model,
// the notice at every start, the turn extension that leaves each coordinator turn failed before any text, its notice, and the
// redaction of a credential in either.
// AR0166 (roadmap 80): `arthur doctor` and its check at every start; core 239 more (5112) for the requirement shape, the checks
// in parallel with their 10 s cut, the core's own requirements, the command, the refusal of `arthur run` and the once-a-day
// record (doctor.ts, requirements.ts); orchestration 16 more (1162) for tmux; session 64 more (755) for the user service and
// linger, and the missing lines that open the start notice; machines 16 more (391) for each tools label checked with
// `command -v` in the machine's check over ssh, named in its doctor line (the owner's decision: a tools label is a command name).
// AR0163 (roadmap 40): registered entries and `arthur schedule`, schedule 220 more (497), for `schedule.register` with its own
// procedure rule (register.ts), the file's entries read and changed under a lock (entry-file.ts) and `arthur schedule
// add|list|remove` (schedule-command.ts); core unchanged but for `@arthur/core/lock` in its exports.
// AR0167 (CI flakes): the fake agent makes each file it notes with its first line, by a link, so a test that reads it while
// the agent runs never sees it empty; core/testing 4 more (344). A record's file removed between the check and the read
// (`hold`, as `arthur stop` polls a job's end) reads empty instead of throwing: core 4 more (4877).
// Merged: core 5112 + 4 (AR0167) = 5116.
// AR0164: the inbox's notice after 3 unanswered turns redacts omp's error as the session plugin does, with a copy of its
// credential.ts (a plugin cannot import another's), orchestration 17 more (1163 alone; 1162 + 17 = 1179 merged with AR0166).
// AR0148: a throw in the session's 500 ms tick no longer ends `arthur run`; session 9 more (700 alone; 755 + 9 = 764 merged
// with AR0166) for the catch around each tick, told once per distinct error, and the fresh start's try noted only once its
// request is written.
// AR0170 (roadmap 93): every option in one table with its meaning and default, which each package's check walks, and each
// package's options file (`./options`: table, summary, tools). Core 66 more for the table's type and walker (option-table.ts)
// and the core's table (core-options.ts); the meanings are most of the rest: orchestration 28 more, projects 5, machines 24,
// resources 57, session 31, schedule 55, the last three each with its check moved into its options file or beside it.
// Merged with main: core 5116 + 66 = 5182, orchestration 1179 + 28 = 1207, projects 325, machines 391 + 24 = 415, resources
// 458, session 764 + 31 = 795, schedule 552.
// AR0160: while a restart is due, `/restart` ends `arthur run` under its service; session 54 more (818 alone; 795 + 54 = 849
// merged with AR0170) for the note at the start whether this `arthur run` is arthur.service's main process with
// `Restart=always`, the reply that says either way, and the end after the coordinator's restart with its
// `Restarted. (arthur run restarted)`.
// AR0173 (CI names each failed test): the wrapper forks the agent with its `oom_score_adj` at 1000 (`oomFirst`, job-memory.ts),
// so a job over its memory cap loses the agent, never the wrapper, to a second kernel kill; core 11 more (5127 alone; 5182 + 11
// = 5193 merged with main).
// AR0179 (roadmap 94): `arthur setup`; core 210 more (5392 alone; 5193 + 210 = 5403 merged with AR0173) for the report
// (setup.ts: its sections, the option paths set and not set, the steps in order and the exit code), the installed plugins'
// options files read by path and each tool's version cut after 5 s (installed.ts), the config's reading shared with `arthur
// config check` (config-check.ts), a missing line's `fix` (doctor.ts), the command (cli.ts) and the core's tool `tailscale`;
// no line cut elsewhere: a scan of the core's exports used by no other file found only public types.
// AR0181 (roadmap 42): `arthur init` and the kind `onboarding`; projects 148 more (473). Cut first: the doctor's `requirement`
// (10 lines) became `requirements`, 8 lines for it and the new board requirement. The rest: init.ts (63: the command, its
// refusals, the skeleton written once per file) and onboarding.ts (83: kind and role, its prompt's paths, the questions cut at
// 10 across runs, `merge.check`).
// AR0187 (roadmap 82): the models plugin, models: 485, for its options and their url checks (model-options.ts), the probes over
// curl on the job's machine with their 30 s reuse (probe.ts), the usage report and its windows (usage.ts), the doctor lines
// (model-doctor.ts), `models.pick`, the job's variables and `arthur usage` (models.ts). Cut first: jobs.ts's sweep, 5 lines to 2,
// and orchestration's refusal of a role's list, which the core now makes. Core 45 more (5448): a spawn's model list and
// `models.pick` with its answer checked (job-model.ts, 24), a prepare's variables checked and carried to the wrapper here and
// on stdin there (jobEnv, launch, launchThere, remote-job launch), `ARTHUR_AGENT_MODEL` in the wrapper, `input` on
// `host.jobs.run`, the record's `model-why`, an awaited `roles.model`, `--model a,b` and the spawn's `model:` line;
// orchestration 6 more (1213) for `models.lists`, every role's model as a list, which the models plugin's doctor lines read.
// AR0189 (roadmap 44): youtrack: 251, set for its instances and their variables checked at load, each project's tracker
// checked against them, the REST reading with its one-line errors and paging, and `arthur youtrack issue|article list|get`;
// a new package, so nothing was cut elsewhere; core unchanged.
// AR0188 (roadmap 43): commit-rules: 168, for the regex checked at load and its commit-msg hook in each job's worktree, the
// project's own hooks forwarded and a shared `core.bare` or `core.worktree` moved into the main one's `config.worktree` first
// (hook.ts, 13 of the 168, after review 1), words or a file in the worker's and reviewer's prompt, and its empty options file.
// AR0197 (roadmap 45): youtrack 110 more (361) for writing: issue and article create and update from a file, the article's
// version check, a custom field set in the shape its type takes, a work item, and the POST in the API call; cut first: the
// usage line to one, and the article's version a word instead of a `--version` flag with its own parsing (7 lines).
// AR0195: youtrack 2 more (363) for `issue list` unresolved by default and `--all`; its query inlined first (1 line).
// AR0196 (roadmap 84): nvm: 84, set for its prepare (the worktree's .nvmrc read and `nvm which` asked on the job's machine, in
// one call, each refusal), its doctor line per machine and its refusal to load after projects; a new package, so nothing was
// cut elsewhere; core unchanged in lines: a prepare's second argument, the variables of the prepares before it, took no new
// line. projects 2 more (475), by the ticket's decision, for its install run with the PATH the prepares before it returned.
// AR0206 (roadmap 46, with AR0204): youtrack 101 more (464) for comment list, add, edit and soft delete (youtrack-comments.ts,
// 38), attachments saved under safe names (youtrack-attachments.ts, 34), a file's bytes from the API (`request`), `issue
// update`'s version, the verbs' wiring, the jobs' rules in the prompt and a write refused inside a job (3); cut first: four
// copies of `field` to one export of youtrack-api.ts (11 lines), and `update`'s article-only branch made the one path for both kinds.
// AR0208 (roadmap 47): telegram: 243, set for its bots checked at load, the long polling with its one-time 409 notice and a 429's wait, the
// owner's text as message-received with its topic's place, the replies and notices sent in slices without a notification in
// quiet hours; a new package. Orchestration 121 more (1334) for the silent mode: `arthur silent` and `/silent`, its state
// file, the summary built from the event log, `coordinator.silent`, the held replies and the `## Silent` context line; cut
// first: the `whole` check onto one line and the state's write inlined (5 lines).
// AR0212 (roadmap 48, with AR0211): telegram 158 more (401) for the outbox (outbox.ts): a file per slice, one retry, a 429's
// wait, the slice that fails queued first for next time, the refused one set aside and told once in a notice cut to one
// message, the lock between processes, the flush after an answered poll; and a reply sent by the bot its messages came
// through (`instance`, 7). Cut first: telegram.ts's own send loop, its start gate and its `polling` closure, which the
// outbox's `flush` and one `begin` replace (29 lines out, 36 in with AR0211's 7), and the sender's five variables on two lines.
// AR0154: a worker, or a continue, on a pre-approved ticket held to the budget its `Pre-approved by policy` line records, until
// the owner's own approval after it; orchestration 19 more (1232) for that `beforeSpawn` refusal (plans.ts: the record and the
// approval read under Decisions, the per-ticket refusals split in two); core/testing 2 more (346) for `continue` on the fake
// host, which no plugin test could reach.
// AR0155: two pre-approvals of one ticket at once record it once; orchestration 11 more (1243) for the lock per ticket around
// autopilot's check, record and move, its body moved into `preApprove`.
// AR0165: a provider outage tells its turn failure once per reason, and once when turns work again; session 18 more (867) for
// the turn extension's last reason told and its working-again mark, and that notice.
// AR0156: autopilot takes the `budget` of the ticket's JSON block when `--budget` is left out; orchestration 10 more (1253) for
// reading it, a block that is not JSON refused.
// AR0168: a plugin's `after`, set up after those plugins when they are loaded, none refused when not; core 3 more (5451) for
// its check beside `requires` and the setup order; orchestration 2 more (1255) for its `after: ["schedule"]`.
// AR0175: a `/restart` that throws in the tick tells the owner; session 6 more (873) for that notice.
// AR0135: inbox files named `<event number>-<time in ms>`, so a log cut by hand never drops a new message; orchestration 5 more
// (1260) for the name, the order by number and the replies' answers given as event numbers.
// AR0137: the burst test moves the agent's clock instead of sleeping; core/testing 3 more (349) for the fake agent's `clock`,
// its doc reflowed by a line to keep testing.ts at 200.
// Merged with AR0208: orchestration 1334 + 47 (AR0135, AR0154 to AR0156, AR0168) = 1381; core, core/testing and session as above.
// AR0172: machines 31 more (446) for the doctor line of `local`'s tools labels, the `command -v` loop of a listed machine's
// check run here through `host.jobs.run("local", ...)` (machine-check.ts), its line, costs and fix (machines.ts).
// AR0186: `arthur init` writes a criteria skeleton per name the registered roles read; core 4 more (5452 alone) for
// `host.jobs.criteria()` (roles.ts, plugin.ts), projects 5 more (480) for the title-only skeleton of a name it ships none for.
// Merged with main: core 5451 + 4 (AR0186) = 5455, projects 480, machines 446.
// The resources batch (AR0145, AR0146, AR0147, AR0150, AR0171): core 31 more (5479): AR0145 10 for `arthur continue` asking
// `jobs.limits` again and writing the caps into the record here and there (`capFields`, the check's answer, the caps argument
// of `remote-job continue`), AR0146 1 for the notice of a job with only its ticket's caps, AR0147 20 for the ticket slice's
// `memory.events.local` read beside the scope's `oom_kill`, the reason naming the ticket, and `OOMPolicy=continue` for a job
// with the ticket's memory cap alone; cut first: the wrapper's two reads of the record's caps folded into one line. resources
// 9 more (467), AR0150, for the busy cores sampled over a second from `cpus()`, here and in the `node -e` script there.
// Merged with main: core 5455 + 31 = 5486, resources 458 + 9 = 467.
// Merged with AR0212: telegram 401 as above; the rest as main has them.
// AR0191, AR0193, AR0198, AR0202 (findings batch): models 21 more (506): probe answers kept in probes.json under a lock per
// provider and machine across processes (probe.ts, 15), omp's models.yml read on each registered machine (model-doctor.ts, 6);
// cut first: the probes' in-process map of running probes, which the lock replaces, and the local models.yml line now read
// through `host.jobs.run` as the others are. Core 6 more (5492, after main's 5486): a record whose `pid` is gone ends the
// wrapper (wrapper.ts, 3), a prompt section's `{ text, warnings }` checked and its warnings joined to the spawn's (roles.ts, 3).
// AR0177: every default an option table writes as a value is checked against the one the code applies, by a test per package;
// where the code applied a literal inside its setup, the literal became an exported constant the test reads: machines 2 more
// (448, `EVERY_SECONDS`), models 2 more (487, `DEFAULTS`), session 4 more (877, `DEFAULTS` and its import in restart.ts),
// telegram 2 more (403, `API_URL`), youtrack 2 more (466, `TIMEOUT_SECONDS`), each a comment and the constant.
// AR0180: a plugin's own `doctor`, read from its options without its setup or env values, so `arthur doctor`, `arthur setup` and
// a refused `arthur run` check it while the load refuses; core 22 more (5477) for `Plugin.doctor` and its check (plugin.ts),
// `ownAnswers` (doctor.ts), each plugin's own answers before its provided ones (host.ts), and the config kept for the fallback
// (cli.ts, setup.ts); orchestration's tmux and session's service and linger moved into theirs, no line more.
// Merged with main: core 5492 + 22 (AR0180) = 5514, models 506 + 2 (AR0177) = 508, resources 467; machines, session, telegram
// and youtrack as AR0177 has them.
// AR0149: one ssh call per machine and round serves the machines check and the free CPU and memory: machines 10 more (456) for
// the `node -e` script in the check's command, its line in the report and the `machines.round` hook as each round begins;
// resources 16 more (483) for the hook kept as each listed machine's check, a check in flight waited for, and `local` alone on
// the 60 s timer; cut first: the round's numbers go through the same parse as this side's own `node -e`, no second parser.
// Merged with main: machines 448 + 10 (AR0149) = 458, resources 467 + 16 (AR0149) = 483; the rest as main has them.
// AR0213 and AR0190 (core and orchestration batch, hosted by AR0190): `Kind` moved from jobs.ts into job-kinds.ts to keep jobs.ts
// under 200 lines (core unchanged); a spawn's `free` in its record, so a continue's check knows it (core unchanged in lines);
// `arthur continue` runs the prepares again, told it is a continue: core 26 more (5481) for the job read back from its record
// (`recordedJob`, 12), the prepares' loop shared by spawn and continue (5), the variables to the wrapper here and on `remote-job
// continue`'s stdin there, and `continued` on `Prepare`; commit-rules and projects each return at once on a continue (0 more).
// AR0161: `host.code` holds the package folder around the module a plugin names as its own (`module: import.meta.url`), not
// the folder beside the core's named after the plugin; core 9 more (5490) for `Plugin.module`, its refusal and the walk up to
// the nearest package.json (host.ts); each of the 11 plugins 1 more for its `module` line.
// AR0169: a registered schedule entry may `run` its plugin's own code at its time (the third kind, chosen over each plugin's own
// timer so a run is claimed once per slot, caught up and listed like the others); schedule 17 more (570) for its check beside
// an action or a job (register.ts), the runs awaited in turn after the jobs with a failure's notice (sweep.ts), and its `list` line.
// Merged with main (AR0191 to AR0202, AR0177, AR0180): main's budgets plus this batch's raises: core 5514 + 35 = 5549, schedule
// 552 + 18 = 570, each other plugin 1 more for its `module` line.
// Merged with main (AR0149): main's budgets plus this batch's raises, machines 458 + 1 = 459, resources 483 + 1 = 484; the
// rest as the merge before: core 5549, schedule 570, each other plugin 1 more for its `module` line.
// AR0220 (roadmap 45, the owner on 2026-10-20): youtrack 51 more (518) for `issue list` grouped by State in the bundle's
// order (`byState`, 20 with its comment, and the issue and article lists split), `issue delete` and `article delete`
// (`remove`, an HTTP DELETE, and a method on `request`), `attachment add` as a form upload and `attachment delete`
// (`changeAttachment`, 15 with its comment), and the attachment's id in `issue attachments`; cut first: `readText` folded
// into `readBytes`, its one reader of a file.
// AR0221 (roadmap 49): media in and out, `arthur send`. Cut first: telegram.ts's own `topic` and its misplaced comment (now
// bot-api.ts's export, which media-out.ts shares), poll.ts's `receive` chat and age checks folded into the update loop. Core 119
// more (5668) for the parts contract and `turnText` with its claims (message-parts.ts, 69) and `arthur send` (send-command.ts,
// 47, and 3 in cli.ts and host.ts); orchestration 45 more (1427) for the owner's messages waiting in `inbox/received/` and
// resolved in order, a restart's left over at the start; telegram 185 more (589) for the files saved and the albums (media-in.ts,
// poll.ts), `channel.send` with its checks before any send and the photo header read (media-out.ts), and multipart calls and
// downloads (bot-api.ts).
// AR0222 (roadmap 45, the owner on 2026-10-20): youtrack 141 more (659) for the rest of full management: `--query` on
// `issue list` and `article list` with the project's own query around it and other projects' items dropped, and the flag
// parsing with `--parent` (command, 36 more with the id check shared by every id a verb takes and the job's reading verbs as
// an allow list), links (youtrack-links.ts, 32), tags and `issue move` and `article move` (write, 30 more with
// `databaseId`), work items listed, edited and deleted (youtrack-work.ts, 35, `addWork` moved there from write), and an
// article's comments and attachments (8 more); cut first: the article list's two reads to one call, and create's project
// lookup to `databaseId`.
// AR0223: a claim's reply the log holds already is not sent again when a restart cut the message's pass before the queue, none
// matched in a log cut by hand; orchestration 6 more (1433) in inbox.ts's pass over `inbox/received/`.
// AR0224 (roadmap 50): phone commands and the menu. Cut first: outbox.ts's `read` takes the slice apart once and checks its
// place with bot-api.ts's `topic` instead of its own copy of the pattern (1), telegram.ts's two setup-time variables on one line
// (1); core: `PhoneCommand` inlined into `phone()` and a refusal joined onto its line pay for `PhoneFrom` and `route`'s
// `from`, so core stays 5668. Telegram 52 more (641): the menu set only when the commands changed, per bot, with its
// record (menu.ts, 36), and `/name text` and `/name@<bot>` routed with the channel and place, the reply sent back there, and
// getMe's username kept (poll.ts, 16 with its comment).
// AR0228 (roadmap 51): the host API frozen in docs/plugin-api.md, each published module of the core holding only what plugins
// use. Cut first: `host.jobs.unblock` and its `unblockJob`, which no plugin called (13 lines), and `machineLimit` moved out of
// config.ts into job-scope.ts (2). Core 16 more (5684): the host's own code moved out of plugin.ts into plugin-host.ts, with
// the types a plugin meets through the host published by name (22); the env guard's refusal apart from its extension
// (env-refusal.ts, 4); `memoryBytes` moved out of core-options.ts into job-memory.ts (1); the imports split between plugin.ts
// and plugin-host.ts (3); an option table's own `keys` beside `each` (AR0178, 1).
// AR0227 (the owner on 2026-10-20, roadmap 98): uptime: 288, set for each project's sites checked at load (uptime-options.ts,
// 72), the HTTP check and the words of each failure (site-check.ts, 41), what is down kept across a restart (uptime-state.ts,
// 34), and down after 2 failed checks with this machine's offline told apart, the notices and the events (uptime.ts, 141); a
// new package, so nothing was cut elsewhere; core unchanged.
// AR0232 (roadmap 98): uptime 4 more (292): a url on a port of the Fetch standard's bad-port list, which fetch never reaches,
// refused at load (uptime-options.ts: the list with its comment, 2, and the refusal, 2); nothing was cut elsewhere.
// AR0235 (roadmap 52): delivery: 312, set for review jobs: the kind, its refusals and the prepare that checks out the branch's
// tip, the ticket's moves and the wake (delivery.ts, 94), `arthur review` and its task (review-command.ts, 93), the review
// records, the verdict and the FAILs since the last PASS (review-records.ts, 72), filing as review-N.md (review-file.ts, 37),
// and its empty options file (16); a new package, so nothing was cut elsewhere; core unchanged.
// AR0235 F1 and F2 (the owner on 2026-10-20: two host API additions, docs/plugin-api.md "Changes since entry 51"). Cut first:
// the record's header comment folded back to its lines (job-record.ts, 1), and in delivery the filing's own refusal of a
// review with no verdict, which the core now refuses (2, delivery stays 312). Core 16 more (5700): `Kind.verdicts`, checked
// at registration (job-kinds.ts, 6), kept in the record as `verdicts` with the kind's `Own` keys sent to `remote-job add`
// (job-record.ts, remote-job.ts, 3), and a finished run whose last line is none of them ends `failed: no verdict` (wrapper.ts, 1);
// `SpawnRequest.fetch`, checked as a commit here (jobs.ts, 4) and pushed to `refs/arthur/fetch` there when missing (job-machine.ts, 2).
// AR0237 (roadmap 53, which names `host.jobs.registerExtension`). Cut first: the worker's ticket, project and branch lookup that
// `arthur review` and `arthur review-needed` both need, kept once (review-command.ts `branchOf`, 8 lines fewer in
// review-needed.ts). Core 13 more (5713): `jobs.registerExtension` on the host and in `Jobs` (jobs.ts, plugin-host.ts, 4), the
// URL checked and kept as a path from the core's `src/` (job-record.ts `extensionPath` with its comment and import, 8), and the
// wrapper's `-e` list reading the record's `extensions` (wrapper.ts, 1). Delivery 196 more (508): `arthur review-needed` and its
// rules (review-needed.ts, 96), the extension that records each job's checks (checks-extension.ts, 61), `review.alwaysReview`
// with its default and check (delivery-options.ts, 22 more), the shared lookup (review-command.ts, 7 more), and the command,
// the extension and `delivery.alwaysReview` registered (delivery.ts, 10 more).
// AR0234 (the owner on 2026-10-20, plan Option 1): MCP servers for the coordinator and each role; orchestration 111 more
// (1542) for the `mcp` option with its checks, each role's servers with their secrets filled in, and the coordinator's
// `<home>/orchestration/mcp/` and `--plugin-dir` (mcp.ts, 99); core 14 more (5698 alone; 5700 + 14 = 5714 merged with AR0235)
// for `mcp` in the `roles.model` answer, checked and kept out of `arthur roles` (roles.ts), the record's `mcp/` and `mcp.yml`
// (job-record.ts), the warning of a job on another machine (jobs.ts) and `--plugin-dir`/`--config` (wrapper.ts).
// AR0236 (roadmap 57): github: 310, set for its options checked at load (github-options.ts, 70), the workflow runs asked of
// GitHub with each refusal's words and the rate limit's wait (github-api.ts, 79), the runs told kept across a restart
// (github-state.ts, 26), and the branches in play with each one's nearest run, ci-finished once per run and a refusal said
// once (github.ts, 135); a new package, so nothing was cut elsewhere; core unchanged.
// Merged AR0237 with AR0234 and AR0236: main's budgets plus AR0237's raises, core 5714 + 13 = 5727, delivery 508.
// AR0239 (roadmap 54): delivery 262 more (770) for `arthur merge`. Cut first: the review records' listing, which the FAILs
// since the last PASS and the merge's PASS on the tip both read, kept once (review-records.ts `reviewsOf`), and the ticket
// folder's pattern shared with `arthur review` (review-command.ts `FEATURE`). The rest: its refusals, the merge and its PASS
// on the tip (merge-command.ts, 108), the install of a changed lockfile, the checks on main and the reinstall after a reset
// (merge-checks.ts, 65), the filed reviews, `findings.onMerge`, outcome.md, merged and the tickets unblocked (merge-outcome.ts,
// 82), the command registered (delivery.ts, 2), the summary (delivery-options.ts, 0) and `reviewsOf` (review-records.ts, 5).
// AR0240 (roadmap 60): manage: 257, set for `arthur health` and `/health` over every plugin's `health` answer, the rounds of
// `health.everyMinutes` with what the last one saw kept across a restart (manage.ts, 105), its own checks of stalled tickets,
// main not pushed, the board uncommitted, the temporary folder and the inodes (health-checks.ts, 116), and its options file
// (manage-options.ts, 36); a new package, so nothing was cut elsewhere; core unchanged.
// Merged AR0239 with AR0240: main's budgets plus AR0239's raise, delivery 770, manage 257.
// AR0244 (roadmap 61): manage 112 more (369) for `arthur stats`: the merged tickets' rounds, verdicts, cost and days, the
// means and shares, the most expensive and the first line of each FAIL finding (stats.ts, 99), and the command registered with
// its header (manage.ts, 13); nothing in manage did this before, so nothing was cut; core unchanged.
// AR0241 (the ticket's Done means: projects provides `projects.install`): projects 5 more (486) for the provider and its
// unknown-project refusal (projects.ts); delivery stays 770, its lockfile table cut for the ask and a refusal as a failed step.
// AR0245: manage 1 less (368): the unknown-project throw in stats.ts was cut, since `host.board.list` refuses first.
// AR0247 (roadmap 55; its Done means allow a host member recorded in docs/plugin-api.md): delivery 163 more (933) for the
// hand-back after a FAIL: the FAIL filed, the worker continued, the next review at its end, a refusal kept for the next end of
// a run, `stop-all`'s cancel and the worker's wake line (hand-back.ts, 148), and the loop wired to `start`, `job-ended`,
// `stop-all` and the wakes, whose FAIL line now says what delivery does (delivery.ts, 11 more), and the wake of a stopped
// review (findings.md F2, delivery.ts, 4); nothing in delivery handed a branch back before, so nothing was cut. Core 2 more
// (5729): `jobs.continue` on the host (jobs.ts, 2, the runner's own comment folded into it, 1 less; plugin-host.ts, 1).
// core/testing 2 less (347): `FakeHost.continue`, now `host.jobs.continue`.
// Merged AR0241 with AR0245: main's budgets plus AR0241's raise, projects 486, delivery 770, manage 368.
// AR0242 (the ticket's Done means: nvm provides the PATH of a project's checkout, which the merge asks): nvm 11 more (96) for
// `nvm.path` (spawnSync of the same `nvm which` here, 5) and its refusals shared with the prepare (nodePath, 6); delivery 7
// more (777) for asking it before the steps and the reinstall and running them on it, the ask folded into `installed`'s try.
// AR0246 (roadmap 58, with AR0238): github 276 more (586): `arthur ci` and `--rerun`, why a run failed from its jobs and its
// log's end, the reruns kept (github-ci.ts, 97); the push to origin that never prompts, with the nearest run and the git helper
// moved out of github.ts (github-git.ts, 59); the pull request reviews polled (github-pulls.ts, 61); one request shared by
// every endpoint (github-api.ts, 14 more), `wakeOn` (github-options.ts, 11 more), the state keyed by run attempt plus the pull
// requests (github-state.ts, 14 more), and the wakes, the command and `github.push` registered (github.ts, 20 more); nothing in
// github did this before, so nothing was cut. delivery 9 more (779) to ask `github.push` after a PASS and after a merge; core
// unchanged.
// Merged AR0246 with AR0241 and AR0245: main's budgets plus AR0246's raises, github 586, delivery 770 + 9 = 779 (recounted).
// Merged AR0242 with AR0246: main's budgets plus AR0242's raises, nvm 96, delivery 770 + 7 + 9 = 786 (recounted).
// Merged main (AR0241, AR0242, AR0246) into AR0247: main's budgets plus AR0247's, core 5729, core/testing 347, delivery
// 786 + 163 + 1 = 950 (recounted: one comment line on the job-ended handler that now both hands back and pushes).
// AR0252 (roadmap 56): delivery 69 more (1019) for `arthur changelog` and its rebuild after each merge: CHANGELOG.md from the
// merged tickets by day and kind, written whole, and the command (changelog.ts, 64), its call after a merge that went in with
// CHANGELOG.md no dirt (merge-command.ts, 3 more), and the command registered (delivery.ts, 2 more); nothing in delivery wrote
// a changelog before, so nothing was cut; core unchanged.
// AR0254 (roadmap 64; its Done means allow a host member recorded in docs/plugin-api.md): manage 84 more (452) for the daily
// cleanup of `prune.keepJobsDays`: the ended jobs past it freed by the core's prune, and the `arthur-*` temporary folders older
// than a day removed, never one made since a running job's run began, another user's skipped (cleanup.ts, 61), the entry
// registered with the schedule and its refusal without one (manage.ts, 10), the option and its check (manage-options.ts, 13);
// core 1 more (5730) for `host.jobs.prune(ids)`, the CLI's prune given to plugins (plugin-host.ts; jobs.ts's comments joined).
// AR0250 (the ticket's Done means: a review of a pull request new to the state told only when submitted after the project's
// previous poll, its time kept in the state): github 9 more (595), the poll's start and the `submitted_at` test (github-pulls.ts,
// 4 more) and the state's `polled` with its check (github-state.ts, 5 more); the comments of both were cut to fit first.
// AR0256 (roadmap 66): develop: 198, set for `arthur plugin new`: its refusals before any write, a budget below the new src/
// included, the package written whole, the line budget and the lockfile's workspace added (plugin-new.ts, 107), the new
// package's four files (plugin-template.ts, 58), the plugin (develop.ts, 18) and its empty options file (15); a new package,
// so nothing was cut elsewhere; core unchanged.
// AR0253 (roadmap 59): delivery 212 more (1231) for `arthur merge --auto`: its refusals, autoMerge, a PASS on the tip itself,
// the held paths and CI asked of github, and the wait CI not yet passed leaves (auto-merge.ts, 69); the waits polled while
// `arthur run` runs, the wake once per run end across a restart, a hung run cancelled (ci-wait.ts, 120); the flags and the
// refusal wired into the merge, the wait ended by it (merge-command.ts, 10 more), and the waits started and stopped with the
// plugin, the PASS wake naming `--auto` (delivery.ts, 13 more); nothing in delivery merged on its own before, so nothing was
// cut. github 26 more (621 after main's AR0250): `github.ci` and `github.cancel` provided (github.ts, 7 more), the lookup
// `arthur ci` and `github.ci` share and the cancel (github-ci.ts, 17 more), a run's start time (github-api.ts, 2 more); core
// unchanged.
// AR0253's review: delivery 1 more (1232), the always-review list's comment naming what of entries 57 to 59 it covers
// (delivery-options.ts, 1 more); the list itself now holds github-ci.ts, auto-merge.ts and merge-command.ts.
// Merged main (AR0250, AR0253) into AR0254: main's budgets plus AR0254's raises, core 5730, manage 452, delivery 1232, github
// 621 (recounted with wc -l).
// AR0251 (the ticket's Done means: a test that the hand-back ends on delivery's own refusal and still retries another
// plugin's): core/testing 2 more (349) for `FakeHost.beforeSpawn`, the test as the plugin `test` refusing a spawn, since a
// check through `host.jobs.beforeSpawn` refuses as the plugin under test; delivery unchanged (1232).
// Merged main (AR0253, AR0254) into AR0256: main's budgets plus AR0256's develop 198 (recounted with wc -l).
// Merged main (AR0254, AR0256) into AR0251: main's budgets plus AR0251's core/testing 349 (recounted with wc -l).
const BUDGETS = { core: 5730, "core/testing": 349, projects: 486, orchestration: 1542, machines: 459, resources: 484, session: 878, schedule: 570, models: 509, youtrack: 659, "commit-rules": 169, nvm: 96, telegram: 641, uptime: 292, delivery: 1232, github: 621, manage: 452, develop: 198 };

const lines = (count: number) => "export const a = 1;\n".repeat(count);

// A tree that keeps every rule: the core publishes "." and "./testing", one plugin uses both.
const BASE: Readonly<Record<string, string>> = {
	"package.json": JSON.stringify({ name: "arthur", license: "Apache-2.0", devDependencies: { typescript: "^7.0.2" } }),
	"packages/core/package.json": JSON.stringify({
		name: "@arthur/core",
		license: "Apache-2.0",
		dependencies: {},
		exports: { ".": "./src/host.ts", "./testing": "./src/testing.ts" },
	}),
	"packages/core/src/host.ts": "export type Host = { name: string };\n",
	"packages/core/src/testing.ts": 'import type { Host } from "./host.ts";\nexport const fakeHost: Host = { name: "fake" };\n',
	"packages/core/test/host.test.ts": 'import { fakeHost } from "../src/testing.ts";\n',
	"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", license: "Apache-2.0" }),
	"packages/telegram/src/telegram.ts": 'import type { Host } from "@arthur/core";\nimport { readFileSync } from "node:fs";\n',
	"packages/telegram/test/telegram.test.ts": 'import { fakeHost } from "@arthur/core/testing";\nimport "../src/telegram.ts";\n',
};

function check(
	files: Readonly<Record<string, string | undefined>>,
	budgets: Readonly<Record<string, number>> = { core: 100, "core/testing": 100, telegram: 300 },
): string[] {
	const root = mkdtempSync(join(tmpdir(), "arthur-structure-test-"));
	try {
		for (const [path, text] of Object.entries({ ...BASE, ...files })) {
			if (text === undefined) continue;
			mkdirSync(dirname(join(root, path)), { recursive: true });
			writeFileSync(join(root, path), text);
		}
		return checkStructure(root, budgets);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("the repository keeps every rule", () => {
	assert.deepEqual(checkStructure(join(import.meta.dirname, ".."), BUDGETS), []);
});

// GitHub draws the README's ```mermaid block on the repository page; arthur.mmd is its source, so the two must not drift apart.
test("the README's mermaid block is arthur.mmd, unchanged", () => {
	const root = join(import.meta.dirname, "..");
	const block = readFileSync(join(root, "README.md"), "utf8").match(/^```mermaid\n([\s\S]*?)^```$/m)?.[1];
	assert.equal(block, readFileSync(join(root, "arthur.mmd"), "utf8"), "copy arthur.mmd into the README's ```mermaid block");
});

test("a tree that keeps every rule passes, @arthur/core/testing and a type import of the core included", () => {
	assert.deepEqual(check({}), []);
});

test("a runtime dependency in any package.json fails", () => {
	assert.deepEqual(
		check({
			"package.json": JSON.stringify({ name: "arthur", dependencies: { leftpad: "1.0.0" } }),
			"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", peerDependencies: { grammy: "1" } }),
			"packages/core/package.json": JSON.stringify({ name: "@arthur/core", optionalDependencies: { fsevents: "2" } }),
		}).filter((problem) => problem.includes("runtime dependency")),
		[
			"package.json: has dependencies; Arthur has no runtime dependency",
			"packages/core/package.json: has optionalDependencies; Arthur has no runtime dependency",
			"packages/telegram/package.json: has peerDependencies; Arthur has no runtime dependency",
		],
	);
});

test("a dev dependency beyond typescript and @types/node fails, in any package.json", () => {
	assert.deepEqual(
		check({
			"package.json": JSON.stringify({
				name: "arthur",
				license: "Apache-2.0",
				devDependencies: { typescript: "^7.0.2", "@types/node": "^24.19.2", vitest: "3" },
			}),
			"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", license: "Apache-2.0", devDependencies: { "@types/node": "24", sinon: "1" } }),
		}),
		[
			"package.json: has devDependency vitest; dev dependencies are the toolchain only (typescript, @types/node)",
			"packages/telegram/package.json: has devDependency sinon; dev dependencies are the toolchain only (typescript, @types/node)",
		],
	);
});

test("a licence other than Apache-2.0 fails, in the root and in any package.json", () => {
	assert.deepEqual(
		check({
			"package.json": JSON.stringify({ name: "arthur", license: "MIT", devDependencies: { typescript: "^7.0.2" } }),
			"packages/core/package.json": JSON.stringify({ name: "@arthur/core", exports: { ".": "./src/host.ts", "./testing": "./src/testing.ts" } }),
			"packages/telegram/package.json": JSON.stringify({ name: "@arthur/telegram", license: "SEE LICENSE IN ../../LICENSE" }),
		}),
		[
			'package.json: has license "MIT"; every Arthur package is Apache-2.0',
			"packages/core/package.json: has license null; every Arthur package is Apache-2.0",
			'packages/telegram/package.json: has license "SEE LICENSE IN ../../LICENSE"; every Arthur package is Apache-2.0',
		],
	);
});

test("an index.ts, types.ts or utils.ts fails, in src/ and test/ alike", () => {
	assert.deepEqual(
		check({
			"packages/core/src/index.ts": "",
			"packages/telegram/src/bot/types.ts": "",
			"packages/telegram/test/utils.ts": "",
		}),
		[
			"packages/core/src/index.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
			"packages/telegram/src/bot/types.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
			"packages/telegram/test/utils.ts: no index.ts, types.ts or utils.ts; name a file after its one job",
		],
	);
});

test("a class or an enum fails, in src/ and test/ alike", () => {
	assert.deepEqual(
		check({
			"packages/telegram/src/bot.ts": "export class Bot {}\n",
			"packages/telegram/src/anonymous.ts": "export const Bot = class {};\n",
			"packages/telegram/test/fake.ts": "const enum Kind { Text }\n",
		}),
		[
			"packages/telegram/src/anonymous.ts: declares a class; Arthur uses plain functions",
			"packages/telegram/src/bot.ts: declares a class; Arthur uses plain functions",
			"packages/telegram/test/fake.ts: declares an enum; use a union type",
		],
	);
});

test("the words class, enum and an import in a comment or a string pass", () => {
	const text = [
		"// a class Bot would be wrong here, and so would enum Kind",
		'const words = "class Bot { enum Kind }";',
		"const template = `class ${words} {}`;",
		"/* import { bot } from \"@arthur/youtrack\"; */",
		'const quoted = "import \\"@arthur/youtrack\\"";',
		"const className = { class: 1, enum: 2 };",
		"",
	].join("\n");
	assert.deepEqual(check({ "packages/telegram/src/words.ts": text }), []);
});

test("a source file of exactly 200 lines passes, 201 lines fails", () => {
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(200) }), []);
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(200).trimEnd() }), []);
	assert.deepEqual(check({ "packages/telegram/src/long.ts": lines(201) }), [
		"packages/telegram/src/long.ts: has 201 lines; a source file has at most 200",
	]);
});

test("a package over its line budget, or without one, fails; tests do not count", () => {
	const telegram = { "packages/telegram/src/bot.ts": lines(8), "packages/telegram/test/long.test.ts": lines(50) };
	assert.deepEqual(check(telegram, { core: 1, "core/testing": 2, telegram: 10 }), []);
	assert.deepEqual(check({ ...telegram, "packages/core/src/extra.ts": lines(2) }, { core: 2, "core/testing": 2, telegram: 9 }), [
		"packages/core: has 3 source lines, over its line budget of 2",
		"packages/telegram: has 10 source lines, over its line budget of 9",
	]);
	assert.deepEqual(check({}, { core: 3, "core/testing": 2 }), ["packages/telegram: has no line budget; add one to test/structure.test.ts"]);
});

test("the core's test kit, testing.ts and fake-agent.ts, counts against core/testing alone, and needs that budget", () => {
	const kit = { "packages/core/src/fake-agent.ts": lines(5) };
	assert.deepEqual(check(kit, { core: 1, "core/testing": 7, telegram: 300 }), []);
	assert.deepEqual(check(kit, { core: 1, "core/testing": 6, telegram: 300 }), [
		"packages/core: its test kit (src/testing.ts, src/fake-agent.ts) has 7 lines, over its line budget of 6",
	]);
	assert.deepEqual(check({ "packages/core/src/extra.ts": lines(6) }, { core: 7, "core/testing": 1, telegram: 300 }), [
		"packages/core: its test kit (src/testing.ts, src/fake-agent.ts) has 2 lines, over its line budget of 1",
	]);
	assert.deepEqual(check({}, { core: 1, telegram: 300 }), [
		"packages/core: has no line budget for its test kit; add core/testing to test/structure.test.ts",
	]);
	assert.deepEqual(check({ "packages/telegram/src/testing.ts": lines(5) }, { core: 1, "core/testing": 2, telegram: 6 }), [
		"packages/telegram: has 7 source lines, over its line budget of 6",
	]);
});

test("a plugin imports no other plugin, no core internal and no path outside its package", () => {
	const text = [
		'import { bot } from "@arthur/youtrack";',
		'import type { Issue } from "@arthur/youtrack";',
		'import type { Host } from "@arthur/core/src/host.ts";',
		'export * from "@arthur/core/testing/extra";',
		'import { host } from "../../core/src/host.ts";',
		'const lazy = await import("@arthur/schedule");',
		'import { self } from "@arthur/telegram";',
		'import { own } from "./telegram.ts";',
		"",
	].join("\n");
	assert.deepEqual(check({ "packages/telegram/src/bot.ts": text }), [
		"packages/telegram/src/bot.ts: imports @arthur/youtrack; a plugin imports no other plugin",
		"packages/telegram/src/bot.ts: imports @arthur/youtrack; a plugin imports no other plugin",
		"packages/telegram/src/bot.ts: imports @arthur/core/src/host.ts; a plugin imports only @arthur/core and its published subpaths",
		"packages/telegram/src/bot.ts: imports @arthur/core/testing/extra; a plugin imports only @arthur/core and its published subpaths",
		"packages/telegram/src/bot.ts: imports ../../core/src/host.ts, a path outside its package",
		"packages/telegram/src/bot.ts: imports @arthur/schedule; a plugin imports no other plugin",
	]);
});

test("the core imports no plugin", () => {
	const text = 'import type { Bot } from "@arthur/telegram";\nimport "../../telegram/src/telegram.ts";\n';
	assert.deepEqual(check({ "packages/core/src/run.ts": text }), [
		"packages/core/src/run.ts: imports @arthur/telegram; the core imports no plugin",
		"packages/core/src/run.ts: imports ../../telegram/src/telegram.ts, a path outside its package",
	]);
});

test("a package without a test fails", () => {
	assert.deepEqual(
		check({ "packages/telegram/test/telegram.test.ts": undefined, "packages/telegram/test/helper.ts": "" }),
		["packages/telegram: has no test; a package has at least one test/*.test.ts"],
	);
});
