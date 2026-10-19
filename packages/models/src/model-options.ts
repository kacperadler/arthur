import { BlockList, isIP } from "node:net";
import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The models plugin's options file (spec/roadmap.md, entries 82 and 93), checked before any setup by walking `table`:
// docs/models.md, "Providers". A url whose host is not on the private network is refused here; a name is resolved at load.

export type Kind = "ollama" | "openai-compatible";
export type Provider = { readonly kind: Kind; readonly url: string; readonly keyEnv?: string };
export type ModelsOptions = {
	readonly enabled?: boolean;
	readonly providers?: Readonly<Record<string, Provider>>;
	readonly probeSeconds?: number;
	readonly limits?: { readonly warnAt?: number; readonly stopAt?: number };
};

export const summary = "models on other machines (Ollama or OpenAI-compatible) and a fallback chain, and each account's limit windows";

export const tools: readonly Tool[] = [{ name: "curl", version: ["curl", "--version"] }];

export const KINDS: readonly Kind[] = ["ollama", "openai-compatible"];
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// The private network a provider is reached on: loopback, RFC 1918, unique local IPv6 (which holds Tailscale's
// fd7a:115c:a1e0::/48) and Tailscale's 100.64.0.0/10.
const PRIVATE = new BlockList();
for (const [address, prefix] of [["127.0.0.0", 8], ["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["100.64.0.0", 10]] as const) PRIVATE.addSubnet(address, prefix, "ipv4");
PRIVATE.addAddress("::1", "ipv6");
PRIVATE.addSubnet("fc00::", 7, "ipv6");

export const isPrivate = (address: string) => PRIVATE.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");

// A url's host without the brackets of an IPv6 address.
export const hostOf = (url: URL) => url.hostname.replace(/^\[(.*)\]$/, "$1");

const url: Check = (value) => {
	const expected = "an http or https url whose host is loopback, private or Tailscale (an address, localhost or a *.ts.net name)";
	if (typeof value !== "string" || !URL.canParse(value)) return expected;
	const parsed = new URL(value);
	const host = hostOf(parsed);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return expected;
	if (isIP(host) === 0) return host === "localhost" || host.endsWith(".ts.net") ? undefined : expected;
	return isPrivate(host) ? undefined : expected;
};
const percent: Check = (value) => (typeof value === "number" && value > 0 && value <= 100 ? undefined : "a percentage above 0 and at most 100");

const PROVIDER: OptionTable = {
	kind: { about: "The server's API: ollama, or openai-compatible (LM Studio, llama.cpp, vLLM)", check: (value) => (KINDS.includes(value as Kind) ? undefined : KINDS.join(" or ")) },
	url: { about: "Where it answers: ollama's root (http://mac.tail1234.ts.net:11434), an OpenAI-compatible one's /v1", check: url },
	keyEnv: { about: "The variable holding its API key, sent as a Bearer token", default: "none", check: (value) => (typeof value === "string" ? undefined : "a variable name") },
};
const LIMITS: OptionTable = {
	warnAt: { about: "A window used this much (%) is named on a job's spawn line and in the coordinator's context", default: "80", check: percent },
	stopAt: { about: "A built-in model whose provider's window is used this much (%) is skipped in a list", default: "95", check: percent },
};

export const table: OptionTable = {
	providers: {
		about: "The model servers by name: a model <name>/<model> runs on that server, any other model is built in",
		check: (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? undefined : "one entry per provider, e.g. { mac: { kind, url } }"),
		each: PROVIDER,
	},
	probeSeconds: { about: "How long a provider's model list may take before the next model in a list is tried", default: "3", check: (value) => (Number.isInteger(value) && (value as number) > 0 ? undefined : "a whole number of seconds above 0") },
	limits: { about: "The share of a usage window that warns, and that skips a model", fields: LIMITS },
};

// `value` as an object of `table`'s keys, each value checked, at `<at>.<key>`; undefined when it is not an object.
function walk(value: unknown, of: OptionTable, at: string, problems: OptionProblem[]): Readonly<Record<string, unknown>> | undefined {
	const path = (key: string) => (at === "" ? key : `${at}.${key}`);
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		problems.push({ path: at, problem: `expected an object of ${Object.keys(of).join(", ")}, got ${describe(value)}` });
		return undefined;
	}
	const record = value as Readonly<Record<string, unknown>>;
	for (const [key, item] of Object.entries(record)) {
		const entry = Object.hasOwn(of, key) ? of[key] : undefined;
		if (entry === undefined) problems.push({ path: path(key), problem: `unknown key; keys: ${Object.keys(of).join(", ")}` });
		const expected = item === undefined || entry === undefined || "fields" in entry ? undefined : entry.check(item);
		if (expected !== undefined) problems.push({ path: path(key), problem: `expected ${expected}, got ${describe(item)}` });
	}
	return record;
}

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = [];
	walk(options, table, "", problems);
	if (options.limits !== undefined) walk(options.limits, LIMITS, "limits", problems);
	const providers = options.providers;
	if (typeof providers !== "object" || providers === null || Array.isArray(providers)) return problems;
	for (const [name, provider] of Object.entries(providers)) {
		if (!NAME.test(name)) problems.push({ path: `providers.${name}`, problem: "expected a provider name of lowercase letters, digits and dashes" });
		const given = walk(provider, PROVIDER, `providers.${name}`, problems);
		for (const key of ["kind", "url"]) if (given !== undefined && given[key] === undefined) problems.push({ path: `providers.${name}.${key}`, problem: `provider ${name}: ${key} is required` });
	}
	return problems;
}

// `<provider>/<model>` of a provider in `providers`, split; undefined for a built-in model (`anthropic/claude-haiku-5-5`).
export function providerModel(providers: Readonly<Record<string, Provider>>, model: string): { readonly provider: string; readonly name: string } | undefined {
	const cut = model.indexOf("/");
	const [provider, name] = [model.slice(0, cut), model.slice(cut + 1)];
	return cut > 0 && name !== "" && Object.hasOwn(providers, provider) ? { provider, name } : undefined;
}
