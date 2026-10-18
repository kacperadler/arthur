// Example arthur.config.ts. Nothing here runs yet, and the `@arthur/*` packages do not exist; the roadmap
// (spec/roadmap.md) builds them. Illustrative: the option names are proposed, not final.
//
// Rules:
// - One file, one list: a plugin is a function call with its options.
// - `enabled: false` is accepted by every plugin: the host does not load it and does not read its env variables.
// - A secret is never a value here. An option ending in `Env` names the environment variable that holds it; the value
//   comes from the shell or `.env` (a shell variable wins, even when empty). Everything else is plain, non-secret, and literal.
// - Env variable names: `ARTHUR_<PLUGIN>_<WHAT>` (ARTHUR_YOUTRACK_TOKEN). A plugin with several accounts (YouTrack servers, Telegram
//   bots, GitHub accounts) lists named instances, each with its own variables: `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`
//   (ARTHUR_YOUTRACK_ACME_TOKEN). One instance may omit its name and use the short form. A project names its instance.
//   `arthur config check` lists every variable the enabled plugins name, each `set` or `missing`, never its value.
// - Arthur exposes nothing to the internet: no plugin here listens on a public address. Every plugin calls out (Telegram and GitHub
//   are polled) or talks to a local process. Other machines are reached over SSH on a private network (Tailscale).
// - The coordinator is always on: `orchestration` is required; the host refuses to start without it and refuses `enabled: false`
//   on it. The human talks to it through a channel plugin or the terminal (`arthur attach`).
// - Projects are declared here, in `projects`, and nowhere else: no separate JSON file. The board starts empty. Your
//   `arthur.config.ts` is ignored by Git (`.gitignore`), so your project list stays on your machine.
// - Everything in this file, and everything Arthur says to the user, is English.
// - Marked `first` ships in the first version, `later` after it (docs/architecture/versions.mmd). `named` = the owner named it;
//   `derived` = added because the harness Arthur replaces already does it.

import { defineConfig } from "@arthur/core";
import { commitRules } from "@arthur/commit-rules"; // first, named
import { delivery } from "@arthur/delivery"; // first, derived
import { develop } from "@arthur/develop"; // first, named
import { discord } from "@arthur/discord"; // later, named
import { docker } from "@arthur/docker"; // first, named
import { github } from "@arthur/github"; // first, derived
import { machines } from "@arthur/machines"; // first, named
import { manage } from "@arthur/manage"; // first, named
import { models } from "@arthur/models"; // first, named
import { orchestration } from "@arthur/orchestration"; // first, named, required
import { projects } from "@arthur/projects"; // first, named
import { resources } from "@arthur/resources"; // first, named
import { schedule } from "@arthur/schedule"; // first, named
import { server } from "@arthur/server"; // later, named
import { session } from "@arthur/session"; // first, named
import { signal } from "@arthur/signal"; // later, named
import { slack } from "@arthur/slack"; // later, named
import { telegram } from "@arthur/telegram"; // first, named
import { voice } from "@arthur/voice"; // first, named
import { whatsapp } from "@arthur/whatsapp"; // later, named
import { youtrack } from "@arthur/youtrack"; // first, named

export default defineConfig({
	// The core's own options: where its files live, what every job may use, and the clock every plugin shares.
	// None is a secret, so all are literal here. Each may be left out; its default is the value shown unless the comment says
	// otherwise. Relative paths are taken from this file's folder. An unknown option, a wrong type or value refuses the start.
	core: {
		home: ".arthur", // jobs, logs, the board's lock
		envFile: ".env", // read for the `...Env` names below; the file is never committed
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
				tmux: { session: "arthur", socket: "arthur" }, // `arthur attach` joins it; a socket with a `/` is a path (tmux -S)
				exitWaitSeconds: 60, // wait for the previous omp to exit, so two never refresh the OAuth token at once
				restartDelaySeconds: 5, // start it again this long after it ended, for any reason
			},
			roles: {
				// `--model` and `--thinking` on a spawn win over the role's; a role left out, or without a model, uses the agent's default
				// `model` is one name or an ordered list: the first available at the job's start is used (the models plugin below)
				worker: { model: ["mac/qwen3-coder", "anthropic/claude-haiku-5-5"], thinking: undefined },
				reviewer: { model: "anthropic/claude-sonnet-5", thinking: "medium" },
				planner: { model: undefined, thinking: undefined }, // undefined = the agent's own default
				project: { model: "anthropic/claude-opus-5-5", thinking: "high" }, // each project's own agent
				quick: { model: "anthropic/claude-haiku-5-5" }, // not a role: omp's quick model (--smol) on every job and the coordinator
			},
			plan: { budgetUsd: 5 },
			autopilot: { budgetUsd: 1, budgetMaxUsd: 3 },
			morningReport: { at: "08:00" }, // registers a schedule entry (an action: a message to the coordinator)
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
		}),

		// The machines jobs run on. `local` is the one Arthur and the coordinator run on; its os and arch are detected. The others
		// are reached with ssh over a private network (Tailscale), with the user's own keys and ~/.ssh/config: no secret here, no
		// password prompt, no host key accepted on its own, and a host that resolves to a public address is refused. Each machine
		// needs Node, git, OMP logged in, and Arthur's core of the same version. A project's or a ticket's `requires` names the
		// labels its jobs need. `arthur machines` (`/machines`) shows each one, online or why not, and its jobs.
		machines({
			local: { labels: { tools: ["docker"] }, maxJobs: 3 }, // both optional; `os` and `arch` are detected, never set here
			list: [
				{
					name: "mac", // lowercase letters, digits and dashes; not `local`, and one machine per name
					ssh: "mac-mini", // a Host in ~/.ssh/config, or a Tailscale name such as mac-mini.tail1234.ts.net
					home: "/Users/arthur/.arthur", // the machine's own home folder for jobs and repositories
					// Each optional; `os` is "linux" or "macos", `arch` Node's word ("x64", "arm64"). A label that disagrees with
					// what the machine says keeps it offline, both named.
					labels: { os: "macos", arch: "arm64", tools: ["xcode"] },
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
			// version` and its os and arch, each check cut after 10 s; a change is `machine-online` or `machine-offline`
			check: { everySeconds: 60 },
		}),

		// What jobs may use. A job's time and money are core.jobs; this adds its CPU and memory, the caps of a feature (all jobs
		// of one ticket together), and how many jobs start: only while the machine keeps `keepFree` after the job's `perJob`
		// reservation, and never above orchestration's `maxAgents`. A ticket may set its own caps in its JSON block:
		// `"caps": { "budgetUsd": 40, "hours": 12 }`.
		resources({
			// A job's own cap on its scope, and what it reserves on its machine (34). `cpu`: cores, a number above 0, at most the
			// machine's cores; over it a job is slowed. `memory`: MemoryMax syntax as core.jobs.memory; over it a job ends
			// `limit: memory`. Each left out = no cap; above core.jobs.cpu or core.jobs.memory = refused at load. Without a user
			// manager (macOS) memory is sampled every 10 s and CPU is not capped. `perFeature` and `keepFree` come with roadmap
			// entries 33, 34 and 69; until then the plugin refuses them as unknown options.
			perJob: { cpu: 2, memory: "4G" },
			perFeature: { budgetUsd: 15, hours: 8, cpu: 4, memory: "8G" }, // 0 = no cap
			// Left free on every machine, for the coordinator and the system. `disk` is the floor of free disk where the machine's
			// jobs write (its home, and Docker's data root where Docker runs): under it no job starts there, the refusal names the
			// machine and the space, and running jobs go on; bytes with K, M, G or T; 0 = no floor.
			keepFree: { cpu: 1, memory: "2G", disk: "20G" },
		}),

		// The coordinator's one long conversation: compacted during the day, new every night, restarted when merged code
		// must load. Before a compaction or a fresh start the coordinator writes `.arthur/session/handoff.md` (work in
		// progress, next steps, every unanswered question to the human with when it was asked), which the next conversation
		// reads first; a failed write withdraws that compaction or try. Needs `orchestration`. The clock is core.timeZone.
		// Built so far: compaction (35), the fresh start and `/restart` (36). `restartGuard` and `probeLlm` come with entries 37
		// and 38; until then the plugin refuses them as unknown options.
		session({
			compactAt: ["08:00", "13:00", "18:00"], // "HH:MM" each; [] = never; running jobs do not hold a compaction back
			compactWaitSeconds: 1800, // wait this long for an idle session with nothing queued, then skip that compaction; at least 1
			freshAt: "23:00", // "HH:MM"; a fresh conversation (no --continue), only once no job of any kind (worker, review, ...) runs
			freshRetryMinutes: 15, // while a job runs, try again this often; a positive whole number; default 15
			freshUntil: "03:00", // "HH:MM", the last try (the next day when earlier than freshAt); then that night is skipped
			restartGuard: true, // refuse a spawn after a merge changed code the session loaded; the phone commands below clear it
			probeLlm: true, // one word asked of the model at start; the channels say when there is no access
			// Registers `arthur restart [fresh]` and the phone commands `/restart` and `/restart fresh`: answered without the model,
			// refused while any job runs; after the handoff, one `Restarted.` notice with `.arthur/session/after-restart.md`.
		}),

		// Actions and jobs at set times. An entry is a daily `HH:MM` or a one-off date and time in core.timeZone, and does one of:
		// an action (a message for the coordinator, optionally a named procedure) or a job (spawn one of a given kind).
		// Plugins register their own entries from their options (orchestration: the morning report; manage: the audit and the
		// retro); `file` holds the ones added by hand with the `schedule` command.
		schedule({
			file: "spec/schedule.json",
			entries: [
				{ id: "weekly-summary", at: "09:00", days: ["mon"], action: { message: "Summarise last week's merges for the human." } },
				{ id: "doc-check", at: "03:00", days: ["wed"], job: { kind: "worker", project: "arthur", task: "Check that every command has its doc page." } },
			],
		}),

		// The project list, the only place projects are declared; the first is the main one. Each project: its name (lowercase
		// letters, digits, dots and dashes), where it lives (a path, or a repo Arthur clones into `reposDir`, which lies outside
		// the home folder), its ticket prefix (ids are PREFIX0001, PREFIX0002, ... from an empty board), its `title` and `about`
		// (the line the coordinator reads every turn, so a word in a message finds the project), its `install` (else the lockfile
		// picks a frozen install; "" for none), its tracker instance (`tracker.instance` names an instance of the youtrack plugin;
		// without it, the unnamed one), its CI workflow, its commit rules, the machine labels its jobs need (`requires`; a ticket's
		// own `"requires"` in its JSON block replaces it), `docker: false` to leave its jobs' Docker resources unlabelled and
		// uncleaned (default: on while the docker plugin is), and `chat`: the place of a channel (a Telegram topic, a Discord or
		// Slack channel) where the project's own agent talks with you; without it the coordinator handles the project. `prompts`
		// moves the files the roles read inside its repository: its vision (default spec/vision.md), its criteria folder (default
		// .agents/arthur/criteria) and its role overrides (default .agents/arthur/roles). Adding a project is an edit of this
		// list; `arthur projects` shows it.
		// One repository may be several projects, each checkout its own entry. `arthur.config.ts` is ignored by Git, so the real
		// list stays on the machine.
		projects({
			reposDir: "../repos",
			list: [
				{
					name: "arthur",
					title: "Arthur",
					about: "Runs coding agents in Git worktrees for one human, with a ticket board and plugins from one config.",
					path: ".",
					prefix: "AR",
					autoMerge: true, // merge after a PASS and green CI without asking
					tracker: { plugin: "youtrack", project: "ART" },
					ci: { workflow: "ci.yml" },
					commitRules: { regex: "^(feat|fix|refactor|perf|test|docs|build|ci|chore|revert)(\\([\\w-]+\\))?!?: .{1,72}$" },
					prompts: { criteriaDir: ".agents/harness/criteria", rolesDir: ".agents/harness/roles" }, // the vision stays spec/vision.md
				},
				{
					name: "acme-shop",
					title: "Acme Shop",
					about: "The online shop of the client Acme: customers order garden tools; it succeeds when an order is paid.",
					repo: "git@github.com:acme/shop.git",
					prefix: "SHOP",
					install: "bun install --frozen-lockfile && bun run build:deps", // runs in each new worktree
					autoMerge: false, // every merge waits for the human
					tracker: { plugin: "youtrack", instance: "acme", project: "SHOP" },
					ci: { workflow: "build.yml" },
					commitRules: { words: "Start with the ticket id, then a verb in the imperative." }, // judged by the review
					chat: { plugin: "telegram", place: "12" }, // its own agent answers in topic 12 of the bot's chat (`instance` names a bot)
				},
				{
					name: "acme-site",
					title: "Acme Site",
					about: "Acme's company website: who they are and how to reach them.",
					repo: "git@github.com:acme/site.git",
					prefix: "SITE",
					autoMerge: false,
					tracker: { plugin: "youtrack", instance: "acme", project: "SITE" },
					ci: { workflow: "ci.yml" },
					commitRules: { file: "docs/commit-rules.md" }, // read as plain words, from the project's own repository
					docker: false, // its jobs' containers are not labelled, nor removed with their worktree; the sweep still runs
				},
				{
					name: "acme-ios",
					title: "Acme iOS",
					repo: "git@github.com:acme/ios.git",
					prefix: "IOS",
					install: "", // nothing to install
					autoMerge: false,
					tracker: { plugin: "youtrack", instance: "acme", project: "IOS" },
					ci: { workflow: "ios.yml" },
					requires: { os: "macos", tools: ["xcode"] }, // every job of this project runs on a machine with these labels
				},
			],
		}),

		// Applies each project's `commitRules`: a regex becomes a commit-msg hook in the project's worktrees that refuses a
		// non-matching subject; words and a file are given to the worker and the reviewer, and the review judges them.
		commitRules({ installHook: true }),

		// One entry per YouTrack server. The names are the variables, not their values. The unnamed one uses
		// ARTHUR_YOUTRACK_URL and ARTHUR_YOUTRACK_TOKEN; `acme` uses ARTHUR_YOUTRACK_ACME_URL and ARTHUR_YOUTRACK_ACME_TOKEN.
		youtrack({
			instances: [
				{ urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN" },
				{ name: "acme", urlEnv: "ARTHUR_YOUTRACK_ACME_URL", tokenEnv: "ARTHUR_YOUTRACK_ACME_TOKEN" },
			],
		}),

		// Review, merge and CI gate of a worker branch. A plugin, not core.
		delivery({
			review: { alwaysReview: ["policy", "hooks", "merge", "stop", "deploy", "bin", "secrets", "roles", "criteria"] },
			merge: { afterPassAndGreenCi: true },
		}),

		// Polls GitHub (CI runs, pull requests) and wakes the coordinator. Arthur has no endpoint for GitHub to call.
		// The workflow to watch is each project's `ci.workflow`.
		// Several accounts follow the same rule as YouTrack: `{ name: "acme", tokenEnv: "ARTHUR_GITHUB_ACME_TOKEN" }`.
		github({
			instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }], // fine-grained, Actions: read (write to rerun a run)
			poll: { everySeconds: 120 },
			wakeOn: ["ci-finished", "pull-request-review"],
		}),

		// Channels: the same interface (receive, send text, send media), one plugin each. A channel only receives: it saves what came
		// under `.arthur/<channel>/` and emits one message with its parts typed (text, photo, video, voice, audio, file; an album is
		// several parts), and transcribes nothing; a media plugin (voice) turns the parts it handles into text for the coordinator.
		// A channel only routes `/name text` to the host and sends the reply; each plugin registers the commands it owns (`/jobs`,
		// `/board`, `/health`, `/restart`, ...).
		// A message may carry its place (a Telegram topic, a Discord or Slack channel): a place some project's `chat` names goes to
		// that project's agent, any other to the coordinator, and the reply goes back to it.
		// Several bots: `{ name: "second", botTokenEnv: "ARTHUR_TELEGRAM_SECOND_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_SECOND_CHAT_ID" }`.
		telegram({
			bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }], // chat id: the only chat the bot answers
			media: true,
		}),

		// Voice notes from any channel, transcribed on this server's CPU with whisper.cpp (`whisper-cli`); nothing leaves the
		// server. ffmpeg converts the channel's audio; one note at a time, in the order they came. The coordinator gets
		// `[voice <seconds> s] <transcript> (<path>)`; the original file stays where the channel saved it. `arthur doctor` checks
		// `whisper-cli`, the model file and `ffmpeg`; while one is missing a note reaches the coordinator as its path.
		voice({
			model: "small", // a whisper.cpp model name (the file .arthur/voice/models/ggml-<model>.bin) or a path to a .bin file
			threads: 4, // CPU threads whisper uses
			language: "pl", // a language code, or "auto" for whisper's own detection
			timeoutSeconds: 300, // a transcription running longer is cut; the coordinator gets the path and why
			maxSeconds: 600, // a longer note is not transcribed; the human is told in one line, the coordinator gets the path
		}),

		// Plugins for managing Arthur: the nightly audit, the weekly retro, health, pruning, stats.
		// The audit and the retro days are options here, not prose in a schedule entry: the plugin registers the entries.
		manage({
			audit: { days: ["tue", "fri"], at: "02:00", budgetUsd: 10, model: "anthropic/claude-opus-5-5" },
			retro: { day: "fri", at: "22:30", budgetUsd: 5 },
			health: { everyMinutes: 30 },
			prune: { keepJobsDays: 14 },
		}),

		// Plugins for developing Arthur: `arthur plugin new` and evals. The test kit (fake host, fake agent) is core's
		// `@arthur/core/testing`, so a plugin tests against it without importing another plugin.
		develop({ evals: { dir: "eval" } }),

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

		// Discord through its gateway: an outbound WebSocket, no Interactions Endpoint URL, so nothing listens. One server, and in
		// it only your user. Turn on the MESSAGE_CONTENT intent in Discord's developer portal; without it messages arrive empty.
		// Phone commands are typed as `/name text`.
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
