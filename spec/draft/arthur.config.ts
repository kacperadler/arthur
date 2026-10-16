// Example arthur.config.ts. A proposal for the new project (spec/next/vision.md); nothing here runs yet, and the
// `@arthur/*` packages do not exist. Illustrative: the option names are proposed, not final.
//
// Rules:
// - One file, one list, like the plugin list in the human's screenshot: a plugin is a function call with its options.
// - `enabled: false` is accepted by every plugin: the host does not load it and does not read its env variables.
// - A secret is never a value here. An option ending in `Env` names the environment variable that holds it; the value
//   comes from the shell or `.env` (a shell variable wins), as today. Everything else is plain, non-secret, and literal.
// - Env variable names: `ARTHUR_<PLUGIN>_<WHAT>` (ARTHUR_YOUTRACK_TOKEN). A plugin with several accounts (YouTrack servers, Telegram
//   bots, GitHub accounts) lists named instances, each with its own variables: `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`
//   (ARTHUR_YOUTRACK_ACME_TOKEN). One instance may omit its name and use the short form. A project names its instance.
// - Arthur exposes nothing to the internet: no plugin here listens on a public address. Every plugin calls out (Telegram and GitHub
//   are polled) or talks to a local process.
// - The coordinator is always on: `orchestration` is required; the host refuses to start without it and refuses `enabled: false`
//   on it. The human talks to it through a channel plugin or the terminal (`arthur attach`).
// - Projects are declared here, in `projects`, and nowhere else: no separate JSON file. The board starts empty.
// - Everything in this file, and everything Arthur says to the user, is English.
// - Marked `first` ships in the first version, `later` after it (see versions.mmd). `named` = the human named it on
//   2026-10-16; `derived` = the coordinator added it because the harness that exists today already does it.

import { defineConfig } from "@arthur/core";
import { commitRules } from "@arthur/commit-rules"; // first, named
import { delivery } from "@arthur/delivery"; // first, derived
import { develop } from "@arthur/develop"; // first, named
import { github } from "@arthur/github"; // first, derived
import { manage } from "@arthur/manage"; // first, named
import { orchestration } from "@arthur/orchestration"; // first, named, required
import { projects } from "@arthur/projects"; // first, named
import { schedule } from "@arthur/schedule"; // first, named
import { server } from "@arthur/server"; // later, named
import { session } from "@arthur/session"; // first, named
import { signal } from "@arthur/signal"; // later, named
import { telegram } from "@arthur/telegram"; // first, named
import { whatsapp } from "@arthur/whatsapp"; // later, named
import { youtrack } from "@arthur/youtrack"; // first, named

export default defineConfig({
	// The core's own options: where its files live, what every job may use, and the clock every plugin shares.
	// Today these are H_JOB_TIMEOUT, H_JOB_BUDGET, H_JOBS_CPU, H_JOBS_MEMORY, H_PATH_PREPEND and the Warsaw time baked into
	// the timers, the schedule and the Telegram quiet hours; none is a secret, so all are literal here.
	core: {
		home: ".arthur", // jobs, logs, the board's lock
		envFile: ".env", // read for the `...Env` names below; the file is never committed
		agent: { command: "omp" }, // the agent CLI; OMP only (the human, 2026-10-16)
		timeZone: "Europe/Warsaw", // read by schedule, session, telegram and orchestration through the host
		quietHours: { from: "22:00", to: "07:30" }, // channels send without a notification; the coordinator answers in one line
		jobs: {
			timeoutMinutes: 120,
			budgetUsd: 2,
			cpu: undefined, // cores all jobs together may use; undefined = host cores minus 1
			memory: "70%", // systemd MemoryMax syntax
		},
	},

	plugins: [
		// The coordinator, always on and required. `maxAgents` counts running jobs across all projects together. Also holds the
		// planning of large tickets (planner role, plan review) and autopilot.
		orchestration({
			maxAgents: 3,
			coordinator: { model: "anthropic/claude-opus-5-5", thinking: "high" },
			roles: {
				worker: { model: undefined, thinking: undefined }, // undefined = the agent's own default
				reviewer: { model: "anthropic/claude-sonnet-5", thinking: "medium" },
				planner: { model: undefined, thinking: undefined },
			},
			plan: { budgetUsd: 5 },
			autopilot: { budgetUsd: 1, budgetMaxUsd: 3 },
			morningReport: { at: "08:00" }, // registers a schedule entry (an action: a message to the coordinator)
		}),

		// The coordinator's one long conversation: compacted during the day, new every night, restarted when merged code
		// must load. Needs `orchestration`. Today these are timers and unit files; the times are the same.
		session({
			compactAt: ["08:00", "13:00", "18:00"], // the clock is core.timeZone
			compactWaitSeconds: 1800, // wait this long for an idle session, then skip that compaction
			freshAt: "23:00", // a fresh conversation (no --continue); skipped while any job runs
			exitWaitSeconds: 60, // wait for the previous omp to exit, so two never refresh the OAuth token at once
			restartDelaySeconds: 5,
			restartGuard: true, // refuse a spawn after a merge changed code the session loaded; the phone commands below clear it
			probeLlm: true, // one word asked of the model at start; the channels say when there is no access
			tmux: { session: "arthur", socket: "arthur" },
			// Registers the phone commands `/restart` and `/restart fresh`: answered without the model, refused while any job runs.
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

		// The project list, in place of spec/clients.json, .agents/harness/project.json and .h/repos. Each project: where it lives
		// (a path, or a repo Arthur clones into `reposDir`), its ticket prefix (ids are PREFIX-1, PREFIX-2, ... from an empty board),
		// its tracker instance (`tracker.instance` names an instance of the youtrack plugin; without it, the unnamed one), its CI
		// workflow, its commit rules, and the files the roles read. Adding a project is an edit of this list.
		projects({
			reposDir: ".arthur/repos",
			list: [
				{
					name: "arthur",
					path: ".",
					prefix: "A",
					autoMerge: true, // merge after a PASS and green CI without asking
					tracker: { plugin: "youtrack", project: "ART" },
					ci: { workflow: "ci.yml" },
					commitRules: { regex: "^(feat|fix|refactor|perf|test|docs|build|ci|chore|revert)(\\([\\w-]+\\))?!?: .{1,72}$" },
					prompts: { vision: "spec/vision.md", criteriaDir: ".agents/arthur/criteria" },
				},
				{
					name: "acme-shop",
					repo: "git@github.com:acme/shop.git",
					prefix: "SHOP",
					autoMerge: false, // every merge waits for the human
					tracker: { plugin: "youtrack", instance: "acme", project: "SHOP" },
					ci: { workflow: "build.yml" },
					commitRules: { words: "Start with the ticket id, then a verb in the imperative." }, // judged by the review
					pathPrepend: ["/home/arthur/.bun/bin"], // folders put in front of PATH for this project's jobs and checks
					prompts: { vision: "spec/vision.md", criteriaDir: ".agents/arthur/criteria" },
				},
				{
					name: "acme-site",
					repo: "git@github.com:acme/site.git",
					prefix: "SITE",
					autoMerge: false,
					tracker: { plugin: "youtrack", instance: "acme", project: "SITE" },
					ci: { workflow: "ci.yml" },
					commitRules: { file: "docs/commit-rules.md" }, // read as plain words, from the project's own repository
					prompts: { vision: "spec/vision.md", criteriaDir: ".agents/arthur/criteria" },
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

		// Review, merge and CI gate of a worker branch. A plugin, not core (the human, 2026-10-16).
		delivery({
			review: { alwaysReview: ["policy", "hooks", "merge", "stop", "deploy", "bin", "secrets", "roles", "criteria"] },
			merge: { afterPassAndGreenCi: true },
		}),

		// Polls GitHub (CI runs, pull requests) and wakes the coordinator, as K0252 does. Arthur has no endpoint for GitHub to call.
		// The workflow to watch is each project's `ci.workflow`.
		// Several accounts follow the same rule as YouTrack: `{ name: "acme", tokenEnv: "ARTHUR_GITHUB_ACME_TOKEN" }`.
		github({
			instances: [{ tokenEnv: "ARTHUR_GITHUB_TOKEN" }], // fine-grained, Actions: read (write to rerun a run)
			poll: { everySeconds: 120 },
			wakeOn: ["ci-finished", "pull-request-review"],
		}),

		// Channels: the same interface (receive text, send text, send media), one plugin each. A channel only routes `/name text`
		// to the host and sends the reply; each plugin registers the commands it owns (`/jobs`, `/board`, `/health`, `/restart`, ...).
		// Several bots: `{ name: "second", botTokenEnv: "ARTHUR_TELEGRAM_SECOND_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_SECOND_CHAT_ID" }`.
		telegram({
			bots: [{ botTokenEnv: "ARTHUR_TELEGRAM_BOT_TOKEN", chatIdEnv: "ARTHUR_TELEGRAM_CHAT_ID" }], // chat id: the only chat the bot answers
			media: true,
		}),

		// Plugins for managing Arthur: the nightly audit, the weekly retro, health, pruning, stats.
		// The audit and the retro days are options here, not prose in a schedule entry: the plugin registers the entries.
		manage({
			audit: { days: ["tue", "fri"], at: "02:00", budgetUsd: 10, model: "anthropic/claude-opus-5-5" },
			retro: { day: "fri", at: "22:30", budgetUsd: 5 },
			health: { everyMinutes: 30 },
			prune: { keepJobsDays: 14 },
		}),

		// Plugins for developing Arthur: the test kit (fake agent, fake host), `arthur plugin new`, evals.
		develop({ testKit: true, evals: { dir: "eval" } }),

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

		// The core's events and commands over HTTP and a stream, for clients (a phone app, a web page, a T3 Code-like UI).
		// Reachable only over a private network such as Tailscale, never from the internet: it binds that interface, not 0.0.0.0.
		server({
			enabled: false,
			listen: { host: "127.0.0.1", port: 8788 }, // or the private network's address
			tokenEnv: "ARTHUR_SERVER_TOKEN", // every request carries it
		}),
	],
});
