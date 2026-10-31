import { BlockList, isIP } from "node:net";
import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The dokploy plugin's options file (AR0588), checked before any setup by walking `table`: docs/dokploy.md, "Options".
// A url the token could leave the owner's server by is refused here; the token's value, and each project's
// `dokploy.project(...)`, are checked at load.

export const summary = "the owner's Dokploy servers, named and unnamed: their projects, applications and deployments, read through arthur dokploy";

export const tools: readonly Tool[] = [];

export const MAX_TIMEOUT = 600;

// The private network plain http may cross: loopback, RFC 1918, unique local IPv6 and Tailscale's 100.64.0.0/10, less the
// cloud metadata addresses inside them; as packages/models/src/model-options.ts, copied since a plugin imports no other.
const [PRIVATE, METADATA] = [new BlockList(), new BlockList()];
for (const [address, prefix] of [["127.0.0.0", 8], ["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["100.64.0.0", 10]] as const) PRIVATE.addSubnet(address, prefix, "ipv4");
PRIVATE.addAddress("::1", "ipv6");
PRIVATE.addSubnet("fc00::", 7, "ipv6");
for (const [address, type] of [["100.100.100.200", "ipv4"], ["fd00:ec2::254", "ipv6"]] as const) METADATA.addAddress(address, type);
const isPrivate = (host: string) => {
	const type = isIP(host) === 6 ? "ipv6" : "ipv4";
	return isIP(host) === 0 ? host === "localhost" || host.endsWith(".ts.net") : !METADATA.check(host, type) && PRIVATE.check(host, type);
};

// The server's address: https anywhere, http only on the private network, never a user, a query or a fragment.
const url: Check = (value) => {
	const expected = "an https url, or an http one on loopback, a private or a Tailscale address (localhost, 10.0.0.1, 100.64.0.1, *.ts.net), without a user, query or fragment";
	const parsed = typeof value === "string" ? URL.parse(value) : null;
	if (parsed === null || /[?#]/.test(value as string) || parsed.username !== "" || parsed.password !== "") return expected;
	if (parsed.protocol === "https:") return undefined;
	return parsed.protocol === "http:" && isPrivate(parsed.hostname.replace(/^\[(.*)\]$/, "$1")) ? undefined : expected;
};

const variable: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "the name of an env variable");

const INSTANCE: Readonly<Record<string, ValueOption>> = {
	name: { about: "The instance's name, which a project's dokploy.project({ instance }) and --instance give", default: "none: the unnamed instance", check: (value) => (typeof value === "string" && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value) ? undefined : "lowercase letters, digits and single dashes, from a letter") },
	url: { about: "The Dokploy server's address, as https://dokploy.example.com; calls go to <url>/api/<procedure>", check: url },
	tokenEnv: { about: "The variable holding an API key of the Dokploy user Arthur reads as (Settings, Profile, API/CLI)", check: variable },
};

const instanceList: Check = (value) => (Array.isArray(value) && value.length > 0 ? undefined : "a list of at least one instance");
const seconds: Check = (value) => (typeof value === "number" && value > 0 && value <= MAX_TIMEOUT ? undefined : `a number of seconds above 0, at most ${MAX_TIMEOUT}`);

export const table: OptionTable = {
	instances: { about: "The Dokploy servers, each { name?, url, tokenEnv }; at most one without a name", check: instanceList, each: INSTANCE },
	timeoutSeconds: { about: "How long one call to Dokploy may take before it is given up", default: "60", check: seconds },
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	const { instances, timeoutSeconds } = options;
	if (timeoutSeconds !== undefined && seconds(timeoutSeconds) !== undefined) problems.push({ path: "timeoutSeconds", problem: `expected ${seconds(timeoutSeconds)}, got ${describe(timeoutSeconds)}` });
	if (!Array.isArray(instances) || instances.length === 0)
		return [...problems, { path: "instances", problem: `expected ${instanceList(instances)}, got ${Array.isArray(instances) ? "an empty list" : describe(instances)}` }];
	const names = new Map<unknown, number>();
	instances.forEach((instance: unknown, index) => {
		const at = `instances[${index}]`;
		if (typeof instance !== "object" || instance === null || Array.isArray(instance)) return problems.push({ path: at, problem: `expected an instance { name?, url, tokenEnv }, got ${describe(instance)}` });
		const record = instance as Readonly<Record<string, unknown>>;
		for (const key of Object.keys(record)) if (!Object.hasOwn(INSTANCE, key)) problems.push({ path: `${at}.${key}`, problem: `unknown key; keys: ${Object.keys(INSTANCE).join(", ")}` });
		for (const [key, entry] of Object.entries(INSTANCE)) {
			const expected = key === "name" && record.name === undefined ? undefined : entry.check(record[key]);
			// A url is not shown: one that holds a user may hold a password.
			if (expected !== undefined) problems.push({ path: `${at}.${key}`, problem: key === "url" && typeof record[key] === "string" ? `expected ${expected}; the url given is not shown` : `expected ${expected}, got ${describe(record[key])}` });
		}
		const first = names.get(record.name);
		if (first === undefined) names.set(record.name, index);
		else if (record.name === undefined) problems.push({ path: at, problem: `instances[${first}] has no name either; at most one instance is unnamed` });
		else problems.push({ path: `${at}.name`, problem: `${String(record.name)} is the name of instances[${first}] too` });
	});
	return problems;
}
