import { accessSync, appendFileSync, constants, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { temporaryFolder } from "@arthur/core/testing";

// A fake `herdr` 0.9.3 (AR0670): `fakeHerdr` writes an executable `herdr` into a new folder for `PATH`; run, this file plays it,
// `node fake-herdr.ts <folder> <herdr's arguments>`. It keeps its workspaces, tabs and panes in `state.json` of the folder, logs
// each call's arguments in `calls.jsonl`, and answers the commands the plugin uses as herdr's CLI does: `{ id, result }` on
// stdout with every key of `herdr api schema --json` (herdr-shapes.json), a server's refusal `{ id, error: { code, message } }` on
// stderr with exit code 1, a usage error with exit code 2. Its `mode` file: `down` (no server: the `Os` error the real CLI prints,
// exit 1), `hang` (never answers) or `error` (every call refused by the server).

export type Pane = { pane_id: string; tab_id: string; workspace_id: string; cwd: string; ran: string[]; agent: string | null; agent_status: string; message: string | null };
export type State = { next: number; workspaces: { workspace_id: string; label: string }[]; tabs: { tab_id: string; workspace_id: string; label: string; cwd: string }[]; panes: Pane[] };
export type Mode = "up" | "down" | "hang" | "error";

// PATH without any folder that holds a `herdr`, so a test never reaches the herdr installed on this machine.
export function pathWithoutHerdr(path = process.env.PATH ?? ""): string {
	return path.split(delimiter).filter((dir) => {
		try {
			accessSync(join(dir, "herdr"), constants.X_OK);
			return false;
		} catch {
			return true;
		}
	}).join(delimiter);
}

export function fakeHerdr(mode: Mode = "up") {
	const folder = temporaryFolder();
	writeFileSync(join(folder, "herdr"), `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(import.meta.filename)} ${JSON.stringify(folder)} "$@"\n`, { mode: 0o755 });
	save(folder, { next: 1, workspaces: [], tabs: [], panes: [] });
	writeFileSync(join(folder, "mode"), mode);
	const lines = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").slice(0, -1) : []);
	return {
		folder,
		path: [folder, pathWithoutHerdr()].join(delimiter),
		setMode: (next: Mode) => writeFileSync(join(folder, "mode"), next),
		calls: (): string[][] => lines(join(folder, "calls.jsonl")).map((line) => JSON.parse(line)),
		// The `arthur` workspace as an earlier `arthur run` left it: its `coordinator` tab, then a tab per label, each with one pane.
		seed(labels: readonly string[]) {
			const tabs = ["coordinator", ...labels].map((label, index) => ({ tab_id: `t${index + 2}`, workspace_id: "w1", label, cwd: "/srv" }));
			const panes = tabs.map((tab, index) => ({ pane_id: `p${index + 2}`, tab_id: tab.tab_id, workspace_id: "w1", cwd: "/srv", ran: [], agent: null, agent_status: "unknown", message: null }));
			save(folder, { next: 100, workspaces: [{ workspace_id: "w1", label: "arthur" }], tabs, panes });
		},
		state: (): State => JSON.parse(readFileSync(join(folder, "state.json"), "utf8")),
	};
}

if (import.meta.main) play(process.argv[2] ?? "", process.argv.slice(3));

function play(folder: string, args: readonly string[]): void {
	appendFileSync(join(folder, "calls.jsonl"), `${JSON.stringify(args)}\n`);
	const mode = readFileSync(join(folder, "mode"), "utf8");
	if (mode === "hang") return void setInterval(() => {}, 60_000);
	if (mode === "down") return fail('Error: Os { code: 2, kind: NotFound, message: "No such file or directory" }', 1);
	const state: State = JSON.parse(readFileSync(join(folder, "state.json"), "utf8"));
	const id = `cli:${state.next}`;
	const refuse = (code: string, message: string) => fail(JSON.stringify({ id, error: { code, message } }), 1);
	if (mode === "error") return refuse("internal", "the server failed");
	const flag = (name: string) => args[args.indexOf(name) + 1] ?? "";
	const fresh = (prefix: string) => `${prefix}${state.next++}`;
	const workspace = (each: State["workspaces"][number]) => {
		const tabs = state.tabs.filter((tab) => tab.workspace_id === each.workspace_id);
		const [first] = tabs;
		return { ...each, number: state.workspaces.indexOf(each) + 1, focused: false, pane_count: state.panes.filter((pane) => pane.workspace_id === each.workspace_id).length, tab_count: tabs.length, active_tab_id: first?.tab_id ?? "", agent_status: "unknown", tokens: {}, worktree: null };
	};
	const tab = ({ cwd: _, ...each }: State["tabs"][number]) => {
		const siblings = state.tabs.filter((one) => one.workspace_id === each.workspace_id);
		return { ...each, number: siblings.findIndex((one) => one.tab_id === each.tab_id) + 1, focused: false, pane_count: state.panes.filter((one) => one.tab_id === each.tab_id).length, agent_status: "unknown" };
	};
	const pane = ({ ran: _, message: __, ...each }: Pane) => ({ ...each, terminal_id: `term-${each.pane_id}`, focused: false, revision: 0, agent_session: null, display_agent: each.agent, foreground_cwd: each.cwd, label: null, restore_error: null, scroll: null, state_labels: {}, terminal_title: null, terminal_title_stripped: null, title: null, tokens: {} });
	const open = (workspace_id: string, label: string, cwd: string) => {
		const made = { tab_id: fresh("t"), workspace_id, label, cwd };
		const root: Pane = { pane_id: fresh("p"), tab_id: made.tab_id, workspace_id, cwd, ran: [], agent: null, agent_status: "unknown", message: null };
		state.tabs.push(made);
		state.panes.push(root);
		return { tab: made, root };
	};
	const answer = (result: object) => {
		save(folder, state);
		process.stdout.write(`${JSON.stringify({ id, result })}\n`);
	};
	const [group, verb, target = ""] = args;
	const known = state.tabs.find((each) => each.tab_id === target);
	const at = state.panes.find((each) => each.pane_id === target);
	switch (`${group} ${verb}`) {
		case "workspace list":
			return answer({ type: "workspace_list", workspaces: state.workspaces.map(workspace) });
		case "workspace create": {
			const made = { workspace_id: fresh("w"), label: flag("--label") };
			state.workspaces.push(made);
			const { tab: first, root } = open(made.workspace_id, "1", flag("--cwd"));
			return answer({ type: "workspace_created", workspace: workspace(made), tab: tab(first), root_pane: pane(root) });
		}
		case "tab list":
			return answer({ type: "tab_list", tabs: state.tabs.filter((each) => each.workspace_id === flag("--workspace")).map(tab) });
		case "tab create": {
			if (!state.workspaces.some((each) => each.workspace_id === flag("--workspace"))) return refuse("workspace_not_found", `workspace ${flag("--workspace")} not found`);
			const { tab: made, root } = open(flag("--workspace"), flag("--label"), flag("--cwd"));
			return answer({ type: "tab_created", tab: tab(made), root_pane: pane(root) });
		}
		case "tab rename":
			if (known === undefined) return refuse("tab_not_found", `tab ${target} not found`);
			known.label = args.slice(3).join(" ");
			return answer({ type: "tab_info", tab: tab(known) });
		case "tab close":
			if (known === undefined) return refuse("tab_not_found", `tab ${target} not found`);
			state.tabs = state.tabs.filter((each) => each !== known);
			state.panes = state.panes.filter((each) => each.tab_id !== known.tab_id);
			return answer({ type: "ok" });
		case "pane list":
			return answer({ type: "pane_list", panes: state.panes.filter((each) => each.workspace_id === flag("--workspace")).map(pane) });
		case "pane run":
			if (at === undefined) return refuse("pane_not_found", `pane ${target} not found`);
			at.ran.push(args.slice(3).join(" "));
			return answer({ type: "ok" });
		case "pane report-agent":
			if (at === undefined) return refuse("pane_not_found", `pane ${target} not found`);
			if (!["idle", "working", "blocked", "unknown"].includes(flag("--state"))) return fail(`error: invalid value '${flag("--state")}' for '--state <STATUS>'`, 2);
			Object.assign(at, { agent: flag("--agent"), agent_status: flag("--state"), message: args.includes("--message") ? flag("--message") : null });
			return answer({ type: "ok" });
		default:
			return fail(`error: unrecognized subcommand '${verb}'`, 2);
	}
}

function fail(line: string, code: number): void {
	process.stderr.write(`${line}\n`);
	process.exitCode = code;
}

// Whole or not at all, so a test reading it while a call writes never sees half of it.
function save(folder: string, state: State): void {
	writeFileSync(join(folder, ".state.json"), JSON.stringify(state));
	renameSync(join(folder, ".state.json"), join(folder, "state.json"));
}
