import { lookup } from "node:dns/promises";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";
import { queueLock, withLock } from "@arthur/core/lock";
import type { Host } from "@arthur/core/plugin";
import { hostOf, isPrivate, type Kind, type Provider } from "./model-options.ts";

// A provider's model list (spec/roadmap.md, entry 82), asked with curl on the job's machine through `host.jobs.run`, the key
// on curl's stdin, never in an argument; one probe per provider and machine at a time, its answer reused for 30 s by every
// process: docs/models.md, "Probes".

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
		"silent", "show-error",
		'noproxy = "*"',
		`url = ${quoted(`${provider.url.replace(/\/+$/, "")}${provider.kind === "ollama" ? "/api/tags" : "/models"}`)}`,
		...(isIP(name) === 0 ? [`resolve = ${quoted(`${name}:${port}:${isIP(found[0]) === 6 ? `[${found[0]}]` : found[0]}`)}`] : []),
		...(key === undefined ? [] : [`header = ${quoted(`Authorization: Bearer ${key}`)}`]),
		'write-out = "\\n%{http_code}"',
	];
	const ran = await host.jobs.run(machine, ["curl", "-q", "--config", "-"], seconds, `${config.join("\n")}\n`);
	if (ran.code !== 0) return { reason: `unreachable: ${ran.stderr.trim().split("\n").at(-1) || `curl exited ${ran.code}`}` };
	const cut = ran.stdout.lastIndexOf("\n");
	const status = ran.stdout.slice(cut + 1);
	if (status !== "200") return { reason: `its model list answered HTTP ${status}` };
	const models = modelList(provider.kind, ran.stdout.slice(0, cut));
	return models === undefined ? { reason: "its model list answered something that is not a model list" } : { models };
}

// The prober of one load: the answer of provider `name` from `machine`, kept for 30 s on the host's clock in
// `<folder>/probes.json`, which every process reads. One probe per provider and machine at a time, in this process and across
// processes: a caller takes the pair's lock, and one that waited for it reads the answer the holder wrote.
export function probes(host: Host, providers: Readonly<Record<string, Provider>>, seconds: number): (machine: string, name: string) => Promise<Probe> {
	const file = join(host.folder, "probes.json");
	// A missing or broken file keeps nothing.
	const kept = (): Readonly<Record<string, unknown>> => {
		try {
			return { ...JSON.parse(readFileSync(file, "utf8")) };
		} catch {
			return {};
		}
	};
	return async (machine, name) => {
		const key = `${machine} ${name}`;
		const release = await queueLock(join(host.folder, `probe.${machine}.${name}.lock`));
		try {
			// The pair's answer while it is under 30 s old; an entry edited into another shape is none.
			const { at, answer } = (kept()[key] ?? {}) as { readonly at?: unknown; readonly answer?: { readonly models?: unknown; readonly reason?: unknown } | null };
			if (typeof at === "number" && (Array.isArray(answer?.models) || typeof answer?.reason === "string") && host.clock.now().getTime() - at < REUSE_MS) return answer as Probe;
			const provider = providers[name] as Provider;
			const fresh = await probe(host, provider, provider.keyEnv === undefined ? undefined : host.env[provider.keyEnv], machine, seconds);
			withLock(`${file}.lock`, () => {
				writeFileSync(`${file}.${process.pid}`, JSON.stringify({ ...kept(), [key]: { at: host.clock.now().getTime(), answer: fresh } }));
				renameSync(`${file}.${process.pid}`, file);
			});
			return fresh;
		} finally {
			release();
		}
	};
}
