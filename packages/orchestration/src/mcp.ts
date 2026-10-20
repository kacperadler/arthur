import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe } from "@arthur/core";
import type { Check, OptionEntry, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// MCP servers for the coordinator and each role (AR0234): defined once by name in `mcp.servers`, `mcp.all` for every role, a
// role's own list in `mcp.roles` instead: docs/commands/coordinator.md, "MCP servers". omp loads them from `<dir>/.mcp.json`
// of `--plugin-dir <dir>`, whose `.claude-plugin/plugin.json` names the plugin `arthur`.

type Value = string | { readonly valueEnv: string };
type Server = { readonly command?: string; readonly args?: readonly string[]; readonly env?: Readonly<Record<string, Value>>; readonly url?: string; readonly headers?: Readonly<Record<string, Value>> };
export type McpOptions = { readonly servers?: Readonly<Record<string, Server>>; readonly all?: readonly string[]; readonly roles?: Readonly<Record<string, readonly string[]>> };
// Servers by name as omp's `mcpServers` holds them, each secret filled in.
export type Servers = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

// The package's one object guard: a config value is any value until checked.
const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);
const text: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "a non-empty string");
const names: Check = (value) => (Array.isArray(value) && value.every((name) => text(name) === undefined) ? undefined : "a list of server names");
const byName: Check = (value) => (isObject(value) ? undefined : "an object of text, or { valueEnv } for a secret, by name");
const SERVER: Readonly<Record<string, ValueOption>> = {
	command: { about: "A local server's command, which omp starts and talks to over stdio", check: text },
	args: { about: "Its arguments", check: (value) => (Array.isArray(value) && value.every((each) => typeof each === "string") ? undefined : "a list of strings") },
	env: { about: "Its environment by variable name: text, or { valueEnv } naming the variable that holds a secret", check: byName },
	url: { about: "A remote server's URL, http or https", check: (value) => (typeof value === "string" && ["http:", "https:"].includes(URL.parse(value)?.protocol ?? "") ? undefined : "an http or https URL") },
	headers: { about: "Its HTTP headers by name: text, or { valueEnv } naming the variable that holds a secret", check: byName },
};
const [LOCAL, REMOTE] = [["command", "args", "env"], ["url", "headers"]];

export const mcpOption: OptionEntry = {
	about: "MCP servers for the coordinator, each project agent and each job, defined once by name",
	fields: {
		servers: { about: "Each server by name: { command, args, env } or { url, headers }", check: (value) => (isObject(value) ? undefined : 'servers by name, e.g. { docs: { command: "docs-mcp" } }'), each: SERVER },
		all: { about: "The servers every role gets, the coordinator included, unless its own list in roles replaces them", default: "none", check: names },
		roles: { about: "A role's own list by its name (coordinator, project, worker, ...), which replaces all for it; [] gives it none", default: "all", check: (value) => (isObject(value) && Object.values(value).every((list) => names(list) === undefined) ? undefined : 'a list of server names by role, e.g. { reviewer: ["docs"] }') },
	},
};

// What the table's checks leave: each server's keys and values, each role's name, and every name a list gives; `mcp` as written.
export function checkMcp(mcp: unknown): OptionProblem[] {
	if (!isObject(mcp)) return [];
	const problems: OptionProblem[] = [];
	const add = (path: string, problem: string) => void problems.push({ path, problem });
	const servers = isObject(mcp.servers) ? mcp.servers : {};
	for (const [name, server] of Object.entries(servers)) {
		const at = `mcp.servers.${name}`;
		if (!/^[A-Za-z0-9_-]+$/.test(name)) add(at, "expected a server name of letters, digits, _ and -");
		else if (!isObject(server) || (server.command === undefined) === (server.url === undefined))
			add(at, `expected { command, args, env } (a local server) or { url, headers } (a remote one), got ${isObject(server) ? `${server.command === undefined ? "neither" : "both"} command and url` : describe(server)}`);
		else
			for (const [key, value] of Object.entries(server)) {
				const keys = server.command === undefined ? REMOTE : LOCAL;
				const expected = keys.includes(key) && value !== undefined ? SERVER[key]?.check(value) : undefined;
				if (!keys.includes(key)) add(`${at}.${key}`, `unknown key; keys: ${keys.join(", ")}`);
				else if (expected !== undefined) add(`${at}.${key}`, `expected ${expected}, got ${describe(value)}`);
				else if (isObject(value) && (key === "env" || key === "headers"))
					for (const [each, given] of Object.entries(value))
						if (typeof given !== "string" && !(isObject(given) && Object.keys(given).join() === "valueEnv" && typeof given.valueEnv === "string"))
							add(`${at}.${key}.${each}`, `expected text, or { valueEnv: "ARTHUR_ORCHESTRATION_<WHAT>" } for a secret, got ${describe(given)}`);
			}
	}
	const lists: [string, unknown][] = [["mcp.all", mcp.all]];
	for (const [role, list] of isObject(mcp.roles) ? Object.entries(mcp.roles) : []) {
		if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(role)) add(`mcp.roles.${role}`, "expected a role name of lowercase letters, digits and dashes");
		else if (role === "quick") add("mcp.roles.quick", "quick is not a role: it names omp's quick model");
		else lists.push([`mcp.roles.${role}`, list]);
	}
	for (const [path, list] of lists)
		for (const name of Array.isArray(list) ? list : []) if (typeof name === "string" && !Object.hasOwn(servers, name)) add(path, `unknown server ${JSON.stringify(name)}; servers: ${Object.keys(servers).join(", ") || "none"}`);
	return problems;
}

// The servers `role` gets, its own list or else `all`, in omp's shape with each secret filled in from `env`, the plugin's
// `...Env` variables, every one set (the core refuses the start without one); undefined for none.
export function mcpServers(options: Options, env: Readonly<Record<string, string>>, role: string): Servers | undefined {
	const { servers = {}, all = [], roles = {} } = (options.mcp ?? {}) as McpOptions;
	const listed = Object.hasOwn(roles, role) ? (roles[role] ?? []) : all;
	const fill = (values: Readonly<Record<string, Value>> | undefined) => values && Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === "string" ? value : env[value.valueEnv]]));
	const omp = (name: string) => {
		const { command, args, env: variables, url, headers } = servers[name] ?? {};
		return url === undefined ? { command, args, env: fill(variables) } : { type: "http", url, headers: fill(headers) };
	};
	return listed.length === 0 ? undefined : Object.fromEntries(listed.map((name) => [name, omp(name)]));
}

// `<folder>/mcp/` for `--plugin-dir`, written whole under a temporary name and renamed, its `.mcp.json` readable by its owner
// only; removed when there are no servers.
export function writeMcp(folder: string, servers: Servers | undefined): void {
	const [mcp, temporary] = [join(folder, "mcp"), join(folder, ".mcp")];
	rmSync(temporary, { recursive: true, force: true });
	if (servers !== undefined) {
		mkdirSync(join(temporary, ".claude-plugin"), { recursive: true });
		writeFileSync(join(temporary, ".claude-plugin", "plugin.json"), '{ "name": "arthur" }\n');
		writeFileSync(join(temporary, ".mcp.json"), `${JSON.stringify({ mcpServers: servers }, null, "\t")}\n`, { mode: 0o600 });
	}
	rmSync(mcp, { recursive: true, force: true });
	if (servers !== undefined) renameSync(temporary, mcp);
}
