// Example arthur.config.ts with every plugin, planned ones included. Built, under `packages/`: the core and commit-rules,
// delivery, develop, discord, findings, github, listen, machines, manage, models, nvm, orchestration, projects, resources,
// schedule, session, telegram, uptime, video, youtrack. Planned, no package yet (spec/roadmap.md builds them): docker (first);
// server, signal, slack, whatsapp (later). So a copy of the whole file does not load; it fails on the first planned import
// (`Cannot find package '@arthur/docker'`). Take a plugin from it once its package exists. Illustrative for the planned
// ones: their option names are proposed, not final.
//
// Rules:
// - One file, one list: a plugin is a function call with its options.
// - `enabled: false` is accepted by every plugin: the host does not load it and does not read its env variables.
// - A secret is never a value here. An option ending in `Env` names the environment variable that holds it; the value
//   comes from the shell or the env file, `core.envFile` (a shell variable wins, even when empty). Everything else is plain, non-secret, and literal.
// - Env variable names: `ARTHUR_<PLUGIN>_<WHAT>` (ARTHUR_YOUTRACK_TOKEN). A plugin with several accounts (YouTrack servers, Telegram
//   bots, GitHub accounts) lists named instances, each with its own variables: `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`
//   (ARTHUR_YOUTRACK_ACME_TOKEN). One instance may omit its name and use the short form. A project names its instance.
//   `arthur config check` lists every variable the enabled plugins name, each `set` or `missing`, never its value.
// - Arthur exposes nothing to the internet: no plugin here listens on a public address. Every plugin calls out (Telegram and GitHub
//   are polled) or talks to a local process. Other machines are reached over SSH on a private network (Tailscale).
// - The coordinator is always on: `orchestration` is required; the host refuses to start without it and refuses `enabled: false`
//   on it. The human talks to it through a channel plugin or the terminal (`arthur attach`).
// - Projects are named here, in `projects({ folders })`, each with its folder and `project.config.ts`. The board starts empty. Your
//   `arthur.config.ts` and `projects/` are ignored by Git (`.gitignore`), so your projects stay on your machine.
// - Everything in this file, and everything Arthur says to the user, is English.
// - Marked `first` ships in the first version, `later` after it (docs/architecture/versions.mmd). `named` = the owner named it;
//   `derived` = added because the harness Arthur replaces already does it.

import { defineConfig } from "@arthur/core";
import { commitRules } from "@arthur/commit-rules"; // first, named
import { delivery } from "@arthur/delivery"; // first, derived
import { develop } from "@arthur/develop"; // first, named
import { discord } from "@arthur/discord"; // first, named
import { docker } from "@arthur/docker"; // first, named
import { findings } from "@arthur/findings"; // first, named
import { github } from "@arthur/github"; // first, derived
import { listen } from "@arthur/listen"; // first, named
import { machines } from "@arthur/machines"; // first, named
import { manage } from "@arthur/manage"; // first, named
import { models } from "@arthur/models"; // first, named
import { nvm } from "@arthur/nvm"; // first, named
import { orchestration } from "@arthur/orchestration"; // first, named, required
import { projects } from "@arthur/projects"; // first, named
import { resources } from "@arthur/resources"; // first, named
import { schedule } from "@arthur/schedule"; // first, named
import { server } from "@arthur/server"; // later, named
import { session } from "@arthur/session"; // first, named
import { signal } from "@arthur/signal"; // later, named
import { slack } from "@arthur/slack"; // later, named
import { telegram } from "@arthur/telegram"; // first, named
import { uptime } from "@arthur/uptime"; // first, named
import { video } from "@arthur/video"; // first, named
import { whatsapp } from "@arthur/whatsapp"; // later, named
import { youtrack } from "@arthur/youtrack"; // first, named

export default defineConfig({
	// The core's own options: where its files live, what every job may use, and the clock every plugin shares.
	// None is a secret, so all are literal here. Each may be left out; its default is the value shown unless the comment says
	// otherwise. Relative paths are taken from this file's folder. An unknown option, a wrong type or value refuses the start.
	core: {
		home: ".arthur", // jobs, logs, the board's lock
		envFile: "/home/arthur/.config/arthur/.env", // read for the `...Env` names below, never committed; default: ~/.config/arthur/.env
		// ($XDG_CONFIG_HOME/arthur/.env when set), outside this folder and every project's checkout, where an agent's recursive
		// search would print its values; `arthur doctor` warns of one inside either
		agent: { command: "omp" }, // the agent CLI; OMP only
		timeZone: "Europe/Warsaw", // read by schedule, session, telegram and orchestration through the host; default: the host's
		quietHours: { from: "22:00", to: "07:30" }, // channels send without a notification; the coordinator answers in one line;
		// "HH:MM", both required; quiet from `from` up to `to`, across midnight when `from` is later; equal = never quiet;
		// left out = no quiet hours
		jobs: {
			timeoutMinutes: 120, // one job's time; the resources plugin adds its CPU and memory
			budgetUsd: 2, // one job's money; 0 = no limit
			cpu: undefined, // cores all jobs together may use, the CPUQuota of their slice; undefined = host cores minus 1 (at least 1);
			// this host's: a job on another machine gets that machine's own cores minus 1 and 70% of its memory
			memory: "70%", // MemoryMax of the jobs' slice: bytes with K, M, G or T, a percentage above 0 up to 100%, each with at most
			// 2 decimals, or "infinity"; a value systemd would refuse is refused at load
			idleMinutes: 10, // a running job with no output or tool call this long is `idle`; 0 = never
			offlineGraceMinutes: 30, // a job whose machine stops answering is `blocked` this long, then failed; 0 = failed at once
			unsandboxed: false, // true: where a job's sandbox cannot be set up (macOS, no python3, a kernel without Landlock), its
			// install and agent run with your user's writes; false = such a job ends `failed: no sandbox: ...`; `arthur doctor` says which
		},
	},

	plugins: [
		// The coordinator, always on and required: it runs one interactive omp in its own tmux session (`arthur attach`), and
		// starts it again when it ends. `maxAgents` counts running jobs across all projects together. Also holds the planning of
		// large tickets (planner role, plan review) and autopilot. A project with a `chat` (projects, below) gets its own agent
		// beside the coordinator, supervised the same way (`arthur attach <project>`); it answers in that chat and works only on
		// that project, and its jobs count in the same `maxAgents`.
		orchestration({
			maxAgents: 3, // jobs in a run at once, across all projects and machines, the human's spawns included; default 3. With
			// `resources` on, fewer when resources are short. A spawn above it is refused, naming the running jobs
			coordinator: {
				model: "anthropic/claude-opus-5-5",
				thinking: "high",
				tmux: { session: "arthur", socket: "arthur" }, // `arthur attach` joins it; a socket with a `/` is a path (tmux -S), in a folder only Arthur's user may enter
				exitWaitSeconds: 60, // wait for the previous omp to exit, so two never refresh the OAuth token at once
				restartDelaySeconds: 5, // start it again this long after it ended, for any reason
			},
			roles: {
				// `--model` and `--thinking` on a spawn win over the role's; a role left out, or without a model, uses the agent's default
				// `model` is one name or an ordered list: the first available at the job's start is used (the models plugin below)
				worker: { model: ["mac/qwen3-coder", "anthropic/claude-haiku-5-5"], thinking: undefined },
				reviewer: { model: "anthropic/claude-sonnet-5", thinking: "medium" },
				planner: { model: undefined, thinking: undefined }, // undefined = the agent's own default
				"plan-reviewer": { model: "anthropic/claude-sonnet-5", thinking: "medium" }, // `arthur spawn --kind plan-review`
				project: { model: "anthropic/claude-opus-5-5", thinking: "high" }, // each project's own agent
				quick: { model: "anthropic/claude-haiku-5-5" }, // not a role: omp's quick model (--smol) on every job and the coordinator
			},
			// MCP servers, defined once by name; omp runs them, Arthur never does. `all`: every role's, the coordinator's included;
			// `roles.<role>`: that role's own list, which replaces `all` for it; [] gives it none. Global only is `all` without `roles`.
			// A secret in `env` or `headers` is `{ valueEnv }`, a variable of the shell or the env file. A job on another machine gets none
			mcp: {
				servers: {
					docs: { command: "npx", args: ["-y", "@upstash/context7-mcp"] }, // local: { command, args?, env? }, over stdio
					// remote: { url, headers? }, http or https; the variable holds the whole value, `Bearer <token>`
					github: { url: "https://api.githubcopilot.com/mcp/", headers: { Authorization: { valueEnv: "ARTHUR_ORCHESTRATION_GITHUB_TOKEN" } } },
				},
				all: ["docs"],
				roles: { reviewer: ["docs", "github"], planner: [] },
			},
			plan: { budgetUsd: 5 }, // a plan job's budget (`arthur spawn --kind plan`), one resume at it, doubled; default 5
			// `arthur ticket status <id> planned --autopilot`: a bug or cleanup from a finding or an audit, at most 3 Scope files, none on
			// delivery's always-review list, set planned by policy. `budgetUsd`: its worker's budget unless `--budget` gives one, above 0;
			// default 1. `budgetMaxUsd`: the most `--budget` may give; default 3. budgetUsd above budgetMaxUsd refuses the start
			autopilot: { budgetUsd: 1, budgetMaxUsd: 3 },
			// The morning report, in core.timeZone: the schedule entry orchestration.report, an action that sends the coordinator its
			// procedure (built overnight, merged without the owner, waiting for approval or a decision, health). Needs schedule()
			morningReport: { at: "08:00" },
		}),

		// Models served on the owner's own machines (Ollama, or any OpenAI-compatible server), reached over Tailscale. A role's or
		// a kind's `model` may be an ordered list: the first available at the job's start is used, and the job's record says which
		// and why. A provider model is available when its server lists it within `probeSeconds`; a built-in one (`anthropic/...`)
		// always is. A job on a provider model costs 0: its budget never stops it, its time limit does. A model lost mid-job fails
		// the job; it is never switched mid-run. omp gets the provider through the job's own environment, never its global
		// models.yml. With every model of a list unavailable the spawn is refused, naming each reason.
		// An OpenAI-compatible server: `lab: { kind: "openai-compatible", url: "http://10.0.0.5:8000/v1", keyEnv: "ARTHUR_MODELS_LAB_KEY" }`.
		models({
			providers: {
				// url: loopback, private, or Tailscale (100.64.0.0/10, a *.ts.net name); any other is refused at load
				mac: { kind: "ollama", url: "http://mac-mini.tail1234.ts.net:11434" },
			},
			probeSeconds: 3, // a server that has not listed its models by then is unavailable; default 3
			// `arthur usage` (`/usage`): each account's windows from `omp usage --json`. A built-in model whose provider's window is at
			// `stopAt` % is skipped in a list; a window at `warnAt` % is named on the spawn line and in the coordinator's context
			limits: { warnAt: 80, stopAt: 95 },
		}),

		// The machines jobs run on. `local` is the one Arthur and the coordinator run on; its os and arch are detected. The others
		// are reached with ssh over a private network (Tailscale), with the user's own keys and ~/.ssh/config: no secret here, no
		// password prompt, no host key accepted on its own, and a host that resolves to a public address is refused. Each machine
		// needs Node, git, OMP logged in, and Arthur's core of the same version. A project's `machines.project(...)` or a ticket's `requires` names the
		// labels its jobs need. `arthur machines` (`/machines`) shows each one, online or why not, and its jobs.
		machines({
			local: { labels: { tools: ["docker"] }, maxJobs: 3 }, // both optional; `os` and `arch` are detected, never set here
			list: [
				{
					name: "mac", // lowercase letters, digits and dashes; not `local`, and one machine per name
					ssh: "mac-mini", // a Host in ~/.ssh/config, or a Tailscale name such as mac-mini.tail1234.ts.net
					home: "/Users/arthur/.arthur", // the machine's own home folder for jobs and repositories
					// Each optional; `os` is "linux" or "macos", `arch` Node's word ("x64", "arm64"). A label that disagrees with
					// what the machine says keeps it offline, both named. Each of `tools` is a command name; `arthur doctor` names
					// one `command -v` does not find there.
					labels: { os: "macos", arch: "arm64", tools: ["xcodebuild"] },
					maxJobs: 2, // left out: no limit of its own; orchestration's maxAgents still counts every job
				},
				{
					name: "build",
					ssh: "build-box",
					home: "/home/arthur/.arthur",
					labels: { os: "linux", arch: "x64", tools: ["docker"] },
					maxJobs: 4,
				},
			],
			// Every machine checked over ssh at start and this often (default 60, at least 10): its address private, `arthur
			// version`, its os and arch and its free CPU and memory (for resources), each check cut after 10 s; a change is
			// `machine-online` or `machine-offline`
			check: { everySeconds: 60 },
		}),

		// What jobs may use. A job's time and money are core.jobs; this adds its CPU and memory, the caps of a feature (all jobs
		// of one ticket together), and how many jobs start: only while the machine keeps `keepFree` after the job's `perJob`
		// reservation, and never above orchestration's `maxAgents`. A ticket may set its own caps in its JSON block:
		// `"caps": { "budgetUsd": 40, "hours": 12 }`.
		resources({
			// A job's own cap on its scope, and what it reserves on its machine (34). `cpu`: cores, a number above 0, at most the
			// machine's cores; over it a job is slowed. `memory`: MemoryMax syntax as core.jobs.memory; over it a job ends
			// `limit: memory`. Each left out = no cap and no reservation; above core.jobs.cpu or core.jobs.memory = refused at
			// load. Without a user manager (macOS) memory is sampled every 10 s and CPU is not capped. 3: Arthur's own `npm test`
			// took 12 min on 3 cores, 6 min on 7 (AR0578).
			perJob: { cpu: 3, memory: "4G" },
			// All jobs of one ticket together (worker, reviews, plans), each replaced by the ticket's own `caps`; 0 = no cap.
			// `budgetUsd`: their costs summed; `hours`: their run time summed. A spawn at either is refused; a running job that
			// reaches one is stopped and held `blocked` on the user, `cap-reached` emitted, `arthur continue` resumes it once the
			// cap is raised. `cpu`, `memory`: a slice per ticket inside the jobs' slice (needs a user manager). `arthur resources <ticket>`.
			perFeature: { budgetUsd: 15, hours: 8, cpu: 4, memory: "8G" },
			// Left free on every machine, for the coordinator and the system: a job starts on a machine only while its free CPU
			// and memory (local's checked every 60 s by `arthur run`, another machine's at each machines check) keep these after
			// the job's perJob reservation; the refusal names each machine and what is short. `cpu`: cores, default 0; `memory`:
			// bytes with K, M, G or T, or a percentage of the machine's memory, default none; `disk`: bytes with K, M, G or T
			// left free on each filesystem the machine's jobs write (its home, Docker's data root), 0 (the default) for no
			// floor; under it no job starts there and `disk-low` is emitted once per fall. Each machine's room is in the
			// coordinator's context, `arthur resources` and `/resources`.
			keepFree: { cpu: 1, memory: "2G", disk: "20G" },
		}),

		// The coordinator's one long conversation: compacted during the day, new every night, and new jobs held once merged code
		// must load. Before a compaction or a fresh start the coordinator writes `.arthur/session/handoff.md` (work in
		// progress, next steps, every unanswered question to the human with when it was asked), which the next conversation
		// reads first; a failed write withdraws that compaction or try. Needs `orchestration`. The clock is core.timeZone.
		// Built: compaction (35), the fresh start and `/restart` (36), the restart guard (37), the start notice and LLM probe (38):
		// at every start the channels get `coordinator up on <host>` or `no LLM access on <host>: <reason>; run omp login`, and
		// `turn failed on <host>: <reason>` for each coordinator turn that fails before any text.
		session({
			compactAt: ["08:00", "13:00", "18:00"], // "HH:MM" each; [] = never; running jobs do not hold a compaction back
			compactWaitSeconds: 1800, // wait this long for an idle session with nothing queued, then skip that compaction; at least 1
			freshAt: "23:00", // "HH:MM"; a fresh conversation (no --continue), only once no job of any kind (worker, review, ...) runs
			freshRetryMinutes: 15, // while a job runs, try again this often; a positive whole number; default 15
			freshUntil: "03:00", // "HH:MM", the last try (the next day when earlier than freshAt); then that night is skipped
			restartGuard: true, // once a commit changed the code `arthur run` loaded, refuse every spawn and continue (unless
			// --ignore-restart) until `arthur run` starts again; `/restart` under the service ends `arthur run` then, which clears it
			probeLlm: true, // one word asked of the coordinator's model at every start, cut after 60 s; false = no probe
			// Registers `arthur restart [fresh]` and the phone commands `/restart` and `/restart fresh`: answered without the model,
			// refused while any job runs; after the handoff, one `Restarted.` notice with `.arthur/session/after-restart.md`.
		}),

		// Actions and jobs at set times (packages/schedule/docs/commands/schedule.md). An entry is a daily "HH:MM" (optionally on
		// some `days`) or a one-off "YYYY-MM-DDTHH:MM", in core.timeZone, and does one of: an action (a message for the coordinator,
		// `[scheduled <id>] ...`, with the text of a `procedure` file under it) or a job (spawn one of a given kind). `arthur run`
		// sweeps every 10 s and runs each due slot once; a slot missed while it was down runs once, saying it is late.
		// Plugins register their own entries from their options (orchestration: the morning report; manage: the audit and the
		// retro), named `<plugin>.<id>`; `file` holds the ones added by hand or with `arthur schedule add`, and `arthur schedule`
		// lists every entry with where it comes from and its next run.
		schedule({
			file: "spec/schedule.json", // a JSON list of entries like those below, read at every sweep; a broken one is skipped, named
			entries: [
				{ id: "weekly-summary", at: "09:00", days: ["mon"], action: { message: "Summarise last week's merges for the human." } },
				{ id: "doc-check", at: "03:00", days: ["wed"], job: { kind: "worker", project: "arthur", task: "Check that every command has its doc page." } },
				{ id: "release-day", at: "2026-11-02T08:30", action: { message: "Release day.", procedure: "docs/release.md" } }, // procedure: a .md path from here
			],
		}),

		// Each project's Node: a job whose worktree has `.nvmrc` runs on the Node it names, which nvm finds on the job's machine
		// (`nvm which`; never a download) and puts first on the job's PATH, which the projects install runs with. It must come
		// before projects: listed after it, the load is refused. No options. packages/nvm/docs/nvm.md.
		nvm(),

		// The project folders, one per project, the first the main one: each folder is named as its project (lowercase letters,
		// digits, dots and dashes) and holds its `project.config.ts`, everything about that project for every plugin, each
		// piece made by its plugin's helper (the example files are at the end of this file). Accounts and tokens stay in each
		// plugin's own section here. Adding a project is one folder and one line in `folders`; `arthur projects` shows it. A
		// piece no enabled plugin reads is a line of `arthur doctor`. `projects/` is ignored by Git, as this file is, so the real
		// projects stay on the machine. `reposDir` is where `repo` projects are cloned, outside the home folder.
		projects({
			reposDir: "../repos",
			folders: ["projects/arthur", "projects/acme-shop", "projects/acme-site", "projects/acme-ios"],
		}),

		// Applies each project's `commitRules.project(...)`: a regex becomes a commit-msg hook in the project's job worktrees that
		// refuses a non-matching subject; words and a file of the project's folder are given to the worker and the reviewer, and
		// the review judges them. It takes no option of its own (packages/commit-rules/docs/commit-rules.md).
		commitRules(),

		// What `arthur merge` makes of a merged ticket's open findings, by each project's `findings.project(mode)`: "ticket" (the
		// default for a project without one: one planning ticket each), "grouped" (one planning ticket for them all) or "summary"
		// (no ticket; each `deferred (client summary)`, listed in the outcome for the client). Also `/findings`. Without it,
		// findings stay open. No options. packages/findings/docs/findings.md.
		findings(),

		// Each project's sites, its `uptime.project([...])`, checked over plain HTTP while `arthur run` runs (no model, so no
		// usage). A site is down after 2 failed checks in a row (no answer in time, refused, a TLS error, a wrong status, the text
		// missing): one notice with its URL, the reason and since when, and `uptime-down`; one more with how long when it
		// answers, and `uptime-up`. When no site answers, one notice that this machine looks offline, none per site. No options.
		// packages/uptime/docs/uptime.md.
		uptime(),

		// One entry per YouTrack server. The names are the variables, not their values. The unnamed one uses
		// ARTHUR_YOUTRACK_URL and ARTHUR_YOUTRACK_TOKEN; `acme` uses ARTHUR_YOUTRACK_ACME_URL and ARTHUR_YOUTRACK_ACME_TOKEN.
		youtrack({
			instances: [
				{ urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN" },
				{ name: "acme", urlEnv: "ARTHUR_YOUTRACK_ACME_URL", tokenEnv: "ARTHUR_YOUTRACK_ACME_TOKEN" },
			],
		}),

		// Review, merge and CI gate of a worker branch. A plugin, not core. Built so far (entries 52 and 53): `arthur review <worker
		// job>` starts a read-only review of the branch's tip on the reviewer role, whose model is `roles.reviewer` above; its verdict,
		// PASS or FAIL alone on the last line, moves the ticket to done or back to in-progress; after 4 FAILs since the branch's last
		// PASS a review needs `--round N`, on the owner's word only (packages/delivery/docs/commands/review.md). `arthur review-needed
		// <worker job>` says whether a branch needs a review at all; a branch that changes a file on `review.alwaysReview` (glob
		// patterns from a project's root, replacing the default list) always does (packages/delivery/docs/commands/review-needed.md).
		// `merge.stepSeconds`: how long each check `arthur merge` runs on main may take before it is killed and fails the merge.
		delivery({
			review: { alwaysReview: ["**/env.ts", "**/env-*.ts", "**/ci.ts", "**/ci-*.ts", "**/github-ci.ts", "**/auto-merge.ts", ".github/workflows/**", "**/review-needed.ts", "**/checks-extension.ts", "**/roles/**", "**/criteria/**", ".agents/**", "spec/vision.md", "**/package.json", "**/package-lock.json", "**/npm-shrinkwrap.json", "**/bun.lock", "**/bun.lockb", "**/yarn.lock", "**/pnpm-lock.yaml", "**/.npmrc", "**/.nvmrc", "**/composer.json", "**/composer.lock", "**/uv.lock", "**/pyproject.toml", "**/.yarnrc.yml", "**/.pnpmfile.cjs", "**/bunfig.toml", ".githooks/**", ".husky/**", "**/merge*.ts", "deploy/**", "bin/**"] },
			merge: { stepSeconds: 3600 },
		}),

		// Polls GitHub for the CI runs of the branches in play (each checkout's own branch and every job's) and emits `ci-finished`
		// once per run attempt; Arthur has no endpoint for GitHub to call. The workflow to watch is each project's `ci.workflow`,
		// its repository the checkout's `origin`. An instance named after a repository's owner reads it, the unnamed one every
		// other: `{ name: "acme", tokenEnv: "ARTHUR_GITHUB_ACME_TOKEN" }`. GitHub Enterprise Server: `apiUrl:
		// "https://<host>/api/v3"`. `arthur ci <branch>` tells why a run failed, `--rerun` reruns it once; `arthur github pr list|get`
		// reads a project's pull requests, any project with a GitHub origin; a branch a review passed and main after a merge are
		// pushed to origin with git's own credentials, never a prompt, and a pruned job's branch is deleted there; `arthur github
		// branch sweep [--dry-run]` deletes the arthur/* branches left there by jobs gone. packages/github/docs/github.md.
		github({
			instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }], // fine-grained, Actions: read (and write to rerun a run); Pull requests: read for reviews and arthur github pr
			poll: { everySeconds: 120 }, // one request per project with a ci.workflow per poll
			wakeOn: ["ci-finished", "pull-request-review"], // what wakes the coordinator; pull-request-review also polls the reviews
		}),

		// Channels: the same interface (receive, send text, send media), one plugin each. A channel only receives: it saves what came
		// under `.arthur/<channel>/` and emits one message with its parts typed (text, photo, video, voice, audio, file; an album is
		// several parts), and transcribes nothing; a media plugin (listen, video) turns the parts it handles into text for the coordinator.
		// A channel only routes `/name text` to the host and sends the reply; each plugin registers the commands it owns (`/jobs`,
		// `/board`, `/health`, `/restart`, ...).
		// A message may carry its place (a Telegram topic, a Discord or Slack channel): a place some project's `chat` names goes to
		// that project's agent, any other to the coordinator, and the reply goes back to it.
		// Several bots: `{ name: "second", botTokenEnv: "ARTHUR_TELEGRAM_SECOND_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_SECOND_CHAT_ID" }`.
		telegram({
			bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }], // chat id: the only chat the bot answers, the owner's private chat with it
			// media: true, // entry 49: photos, files and voice notes in and out; until then refused as unknown
		}),

		// Voice notes and audio files from any channel, transcribed on this server's CPU with whisper.cpp (`whisper-cli`); nothing
		// leaves the server. ffmpeg converts the channel's audio; one file at a time, in the order they came. The coordinator gets
		// `[voice <seconds> s] <transcript> (<path>)` (`[audio ...]` for an audio file); the original file stays where the channel
		// saved it. `arthur transcribe <file> [--times]` and `listen.transcribe` do the same for any file. `arthur doctor` checks
		// `whisper-cli`, the model file and `ffmpeg`; while one is missing a note reaches the coordinator as its path.
		listen({
			model: "medium", // a whisper.cpp model name (the file .arthur/listen/models/ggml-<model>.bin) or the absolute path of a .bin file
			threads: 4, // CPU threads whisper uses
			language: "pl", // a language code, or "auto" for whisper's own detection
			timeoutSeconds: 300, // ffmpeg or whisper running longer on one file is killed; the coordinator gets the path and why
			maxSeconds: 600, // a longer file is not transcribed; the human is told in one line, the coordinator gets the path
		}),

		// Videos from any channel, cut on this server by ffmpeg; nothing leaves the server. The coordinator gets a few frames as PNG
		// files in .arthur/video/, each with the second it shows, and the words of the sound track through the listen plugin's
		// `listen.transcribe`: `[video <seconds> s] <transcript> frames: <path> at <s> s, ... (<path>)`. `arthur doctor` checks
		// `ffmpeg` and `ffprobe`; while one is missing a video reaches the coordinator as its path.
		video({
			everySeconds: 5, // a frame from each step of this many seconds; a scene change adds one between them
			maxFrames: 12, // the most frames taken from one video, the first ones in time
			maxSeconds: 600, // a longer video is not cut; the human is told in one line, the coordinator gets the path
			timeoutSeconds: 300, // ffprobe or ffmpeg running longer on one step is killed; the coordinator gets the path and why
		}),

		// Plugins for managing Arthur: the nightly audit, the weekly retro, health, pruning, stats.
		// The audit and the retro days are options here, not prose in a schedule entry: the plugin registers the entries.
		manage({
			audit: { days: ["tue", "fri"], at: "02:00", budgetUsd: 10, model: "anthropic/claude-opus-5-5" },
			retro: { day: "fri", at: "22:30", budgetUsd: 5 },
			health: { everyMinutes: 30 }, // entry 60: arthur health and /health; this often under arthur run, new lines as a notice
			prune: { keepJobsDays: 14 },
		}),

		// Plugins for developing Arthur: `arthur plugin new` and `arthur eval`. The test kit (fake host, fake agent) is core's
		// `@arthur/core/testing`, so a plugin tests against it without importing another plugin.
		develop({
			evals: {
				runs: 3, // arthur eval runs each scenario (a package's evals/<name>/) this often, all at once; --runs overrides it
				baseline: "evals/baseline.json", // each scenario's pass rate, in the main project's checkout; --save-baseline writes it
			},
		}),

		// Docker on every machine labelled `tools: docker`. What a job creates (containers, networks, volumes, images it builds) is
		// labelled `arthur.job=<id>`, and compose stacks get the job's project name; all of it is removed on the job's machine
		// when its worktree is removed (prune, merge, a dropped ticket). Pulled and shared images stay. A failed cleanup never
		// keeps the worktree: it is a notice, and the sweep retries. Anything labelled `arthur.keep` is never touched.
		docker({
			buildCache: "10G", // after each cleanup and sweep, Docker's shared build cache is cut to this size; 0 = no cap
			leftoverHours: 48, // the sweep removes unlabelled stopped containers, unused networks, dangling images, unused
			// anonymous volumes and build cache older than this; what a job that no longer exists labelled goes at any age
			sweep: { at: "04:00" }, // registers a daily schedule entry; also runs at once on a machine under `keepFree.disk`
		}),

		// ---- later ----

		// WhatsApp through a bridge: a local process that holds the WhatsApp Web session and that Arthur calls on loopback.
		// Unofficial; the account may be banned. Meta's Business API is not an option: it delivers incoming messages by
		// webhook, and Arthur exposes nothing.
		whatsapp({
			enabled: false,
			bridge: { url: "http://127.0.0.1:3000" },
			allowedNumberEnv: "ARTHUR_WHATSAPP_ALLOWED_NUMBER", // the only number the plugin answers
		}),

		// Signal through signal-cli running next to Arthur; messages are received by polling it.
		signal({
			enabled: false,
			cli: "signal-cli",
			accountEnv: "ARTHUR_SIGNAL_ACCOUNT", // Arthur's own number
			allowedNumberEnv: "ARTHUR_SIGNAL_ALLOWED_NUMBER", // the only number the plugin answers
		}),

		// Discord through its gateway: an outbound WebSocket, no Interactions Endpoint URL, so nothing listens. One private server,
		// and in it only your user. Turn on Message Content Intent in Discord's developer portal; without it Discord refuses the
		// connection (4014). Text in and out today; files, voice messages and phone commands typed as `/name text` come with entry 90.
		discord({
			enabled: false,
			bots: [
				{
					tokenEnv: "ARTHUR_DISCORD_BOT_TOKEN",
					guildIdEnv: "ARTHUR_DISCORD_GUILD_ID", // the only server the bot answers
					userIdEnv: "ARTHUR_DISCORD_USER_ID", // the only user it answers
					channelIdEnv: "ARTHUR_DISCORD_CHANNEL_ID", // the coordinator's channel; a project's `chat.place` names another
				},
			],
		}),

		// Slack through Socket Mode: an outbound WebSocket, no Request URL, so nothing listens. One workspace, and in it only your
		// user. Slack refuses an unknown `/` command typed as text, so phone commands go through one: `/arthur <name> <text>`.
		slack({
			enabled: false,
			apps: [
				{
					appTokenEnv: "ARTHUR_SLACK_APP_TOKEN", // xapp-..., opens the Socket Mode connection
					botTokenEnv: "ARTHUR_SLACK_BOT_TOKEN", // xoxb-..., sends and fetches files
					teamIdEnv: "ARTHUR_SLACK_TEAM_ID", // the only workspace the app answers
					userIdEnv: "ARTHUR_SLACK_USER_ID", // the only user it answers
					channelIdEnv: "ARTHUR_SLACK_CHANNEL_ID", // the coordinator's channel; a project's `chat.place` names another
				},
			],
		}),

		// The core's events and commands over HTTP and a stream, for clients (a phone app, a web page, a T3 Code-like UI).
		// Reachable only over a private network such as Tailscale, never from the internet: it binds that interface, not 0.0.0.0.
		server({
			enabled: false,
			listen: { host: "127.0.0.1", port: 8788 }, // or the private network's address
			tokenEnv: "ARTHUR_SERVER_TOKEN", // every request carries it
		}),
	],
});

// The project files `projects({ folders })` names, each `projects/<name>/project.config.ts`, every path in it counted from its
// folder. `projects.project(...)` holds what the projects plugin and the core read: where the project lives (a `path`, or a
// `repo` Arthur clones into `reposDir`), its ticket prefix (ids are PREFIX0001, PREFIX0002, ... from an empty board), its
// `title` and `about` (the line the coordinator reads every turn, so a word in a message finds the project), its `install`
// (else the lockfile picks a frozen install; "" for none) and `prompts`, files of the project's folder the roles read in
// place of its repository's (default spec/vision.md, .agents/arthur/criteria and .agents/arthur/roles in the repository).
// Every other piece is its plugin's, checked by it at load: its tracker (`instance` names an instance of the youtrack plugin;
// without it, the unnamed one), its CI workflow, its commit rules, auto-merge, the machine labels its jobs need (a ticket's
// own `"requires"` in its JSON block replaces them), its sites, what a merge makes of its findings; planned, `docker.project(false)`
// to leave its jobs' Docker resources unlabelled and uncleaned (default: on while the docker plugin is), and
// `orchestration.project({ chat })`, the place of a channel (a Telegram topic, a Discord or Slack channel) where the project's
// own agent talks with you; without it the coordinator handles the project. One repository may be several projects, each
// checkout its own folder. Each file imports the helpers it uses: `import { projects } from "@arthur/projects";`.
//
// projects/arthur/project.config.ts
//	export default [
//		projects.project({ title: "Arthur", about: "Runs coding agents in Git worktrees for one human, with a ticket board and plugins from one config.", path: "../..", prefix: "AR" }),
//		delivery.project({ autoMerge: true }), // arthur run merges after a PASS or a no review, and green CI, without asking
//		youtrack.project({ project: "ART" }),
//		github.project({ workflow: "ci.yml" }),
//		commitRules.project({ regex: "^(?=.{1,72}$)(feat|fix|refactor|perf|test|docs|build|ci|chore|revert)(\\([\\w-]+\\))?!?: .+$" }),
//	];
//
// projects/acme-shop/project.config.ts
//	export default [
//		projects.project({
//			title: "Acme Shop",
//			about: "The online shop of the client Acme: customers order garden tools; it succeeds when an order is paid.",
//			repo: "git@github.com:acme/shop.git",
//			prefix: "SHOP",
//			install: "bun install --frozen-lockfile && bun run build:deps", // runs in each new worktree
//			prompts: { vision: "vision.md" }, // projects/acme-shop/vision.md, kept off the client's repository
//		}),
//		delivery.project({ autoMerge: false }), // every merge waits for the human
//		youtrack.project({ instance: "acme", project: "SHOP" }),
//		github.project({ workflow: "build.yml" }),
//		commitRules.project({ words: "Start with the ticket id, then a verb in the imperative." }), // judged by the review
//		uptime.project([
//			{ url: "https://shop.acme.example/" }, // any 2xx status, checked every 60 s
//			{ url: "https://shop.acme.example/health", expect: "ok", everySeconds: 30 }, // a 2xx page that holds "ok"
//			{ url: "https://admin.shop.acme.example/", expect: 401 }, // exactly this status
//		]),
//		orchestration.project({ chat: { plugin: "telegram", place: "12" } }), // planned: its own agent answers in topic 12 of the bot's chat
//	];
//
// projects/acme-site/project.config.ts
//	export default [
//		projects.project({ title: "Acme Site", about: "Acme's company website: who they are and how to reach them.", repo: "git@github.com:acme/site.git", prefix: "SITE" }),
//		youtrack.project({ instance: "acme", project: "SITE" }),
//		github.project({ workflow: "ci.yml" }),
//		commitRules.project({ file: "commit-rules.md" }), // projects/acme-site/commit-rules.md, read as plain words
//		findings.project("summary"),
//		docker.project(false), // planned: its jobs' containers are not labelled, nor removed with their worktree; the sweep still runs
//	];
//
// projects/acme-ios/project.config.ts
//	export default [
//		projects.project({ title: "Acme iOS", repo: "git@github.com:acme/ios.git", prefix: "IOS", install: "" }), // nothing to install
//		youtrack.project({ instance: "acme", project: "IOS" }),
//		github.project({ workflow: "ios.yml" }),
//		machines.project({ os: "macos", tools: ["xcodebuild"] }), // every job of this project runs on a machine with these labels
//		findings.project("grouped"),
//	];
