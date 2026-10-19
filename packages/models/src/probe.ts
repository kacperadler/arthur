import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Host } from "@arthur/core/plugin";
import { hostOf, isPrivate, type Kind, type Provider } from "./model-options.ts";

// A provider's model list (spec/roadmap.md, entry 82), asked with curl on the job's machine through `host.jobs.run`, the key
// on curl's stdin, never in an argument; one probe per provider and machine at a time, its answer reused for 30 s:
// docs/models.md, "Probes".

export type Probe = { readonly models: readonly string[] } | { readonly reason: string };

const REUSE_MS = 30_000;

// curl's config syntax: a text in double quotes, `\` and `"` escaped, a line break as `\n`.
const quoted = (text: string) => `"${text.replace(/[\\"]/g, "\\$&").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;

// The addresses a url's host stands for: itself when it is an address, else what the name resolves to here.
export async function addresses(host: string): Promise<string[]> {
	return isIP(host) === 0 ? (await lookup(host, { all: true })).map((found) => found.address) : [host];
}

// The models a provider's answer lists, undefined when it is not its kind's model list: Ollama's `{ models: [{ name, model,
// ... }] }`, OpenAI's `{ object: "list", data: [{ id, ... }] }`.
function modelList(kind: Kind, body: string): string[] | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return undefined;
	}
	const { models, object, data } = (parsed ?? {}) as Readonly<Record<string, unknown>>;
	type Entry = { readonly name?: unknown; readonly model?: unknown; readonly id?: unknown } | null;
	if (kind === "ollama")
		return Array.isArray(models) && models.every((entry: Entry) => typeof entry?.name === "string")
			? [...new Set(models.flatMap((entry: Entry) => [entry?.name, entry?.model].filter((name) => typeof name === "string")))]
			: undefined;
	return object === "list" && Array.isArray(data) && data.every((entry: Entry) => typeof entry?.id === "string") ? data.map((entry: Entry) => String(entry?.id)) : undefined;
}

// Whether `names` holds `model`; on Ollama a name without a tag is its `:latest`.
export function listed(kind: Kind, names: readonly string[], model: string): boolean {
	return names.includes(model) || (kind === "ollama" && !model.includes(":") && names.includes(`${model}:latest`));
}

// One request for the model list of `provider` from `machine`, cut at `seconds`. A name is resolved here and curl is pinned to
// that address, so a name that resolves outside the private network is never reached.
async function probe(host: Host, provider: Provider, key: string | undefined, machine: string, seconds: number): Promise<Probe> {
	const url = new URL(provider.url);
	const name = hostOf(url);
	let found: string[];
	try {
		found = await addresses(name);
	} catch (error) {
		return { reason: `unreachable: ${name} does not resolve (${(error as NodeJS.ErrnoException).code ?? String(error)})` };
	}
	const outside = found.find((address) => !isPrivate(address));
	if (outside !== undefined || found[0] === undefined) return { reason: `refused: ${name} resolves to ${outside ?? "nothing"}, not a private address` };
	const port = url.port || (url.protocol === "https:" ? "443" : "80");
	const config = [
		"silent",
		"show-error",
		`url = ${quoted(`${provider.url.replace(/\/+$/, "")}${provider.kind === "ollama" ? "/api/tags" : "/models"}`)}`,
		...(isIP(name) === 0 ? [`resolve = ${quoted(`${name}:${port}:${isIP(found[0]) === 6 ? `[${found[0]}]` : found[0]}`)}`] : []),
		...(key === undefined ? [] : [`header = ${quoted(`Authorization: Bearer ${key}`)}`]),
		'write-out = "\\n%{http_code}"',
	];
	const ran = await host.jobs.run(machine, ["curl", "--config", "-"], seconds, `${config.join("\n")}\n`);
	if (ran.code !== 0) return { reason: `unreachable: ${ran.stderr.trim().split("\n").at(-1) || `curl exited ${ran.code}`}` };
	const cut = ran.stdout.lastIndexOf("\n");
	const status = ran.stdout.slice(cut + 1);
	if (status !== "200") return { reason: `its model list answered HTTP ${status}` };
	const models = modelList(provider.kind, ran.stdout.slice(0, cut));
	return models === undefined ? { reason: "its model list answered something that is not a model list" } : { models };
}

// The prober of one load: the answer of provider `name` from `machine`, a probe running shared by every caller, an answer
// kept for 30 s on the host's clock.
export function probes(host: Host, providers: Readonly<Record<string, Provider>>, seconds: number): (machine: string, name: string) => Promise<Probe> {
	const kept = new Map<string, { at?: number; readonly answer: Promise<Probe> }>();
	return (machine, name) => {
		const [key, now] = [`${machine} ${name}`, host.clock.now().getTime()];
		const last = kept.get(key);
		if (last !== undefined && (last.at === undefined || now - last.at < REUSE_MS)) return last.answer;
		const provider = providers[name] as Provider;
		const secret = provider.keyEnv === undefined ? undefined : host.env[provider.keyEnv];
		const entry: { at?: number; readonly answer: Promise<Probe> } = {
			answer: probe(host, provider, secret, machine, seconds).then((answer) => {
				entry.at = host.clock.now().getTime();
				return answer;
			}),
		};
		kept.set(key, entry);
		return entry.answer;
	};
}
