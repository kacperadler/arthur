import type { Plugin } from "@arthur/core/plugin";
import type { Instance } from "./youtrack-api.ts";
import { type Tracked, youtrackCommand } from "./youtrack-command.ts";
import { checkOptions } from "./youtrack-options.ts";

// The youtrack plugin (spec/roadmap.md, entries 44 and 45): YouTrack servers as instances, named and unnamed, each project's
// `tracker` picking one; `arthur youtrack issue|article ...` reads and writes them: docs/commands/youtrack.md. It needs the
// project list, so `projects` sets up first.

export type InstanceOptions = { readonly name?: string; readonly urlEnv: string; readonly tokenEnv: string };

export type YoutrackOptions = { readonly enabled?: boolean; readonly instances: readonly InstanceOptions[]; readonly timeoutSeconds?: number };

// A YouTrack project's id, its issues' prefix: a letter, then letters, digits and underscores.
const SHORT_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

export function youtrack(options: YoutrackOptions): Plugin {
	return {
		name: "youtrack",
		options,
		requires: ["projects"],
		check: checkOptions,
		setup(host) {
			const { instances, timeoutSeconds = 30 } = host.options as YoutrackOptions;
			const servers = instances.map((each, index) => server(host.env, each, index, timeoutSeconds));
			const [list] = host.collect<readonly { readonly name: string; readonly tracker?: { readonly plugin: string; readonly instance?: string; readonly project: string } }[]>("projects");
			const projects: Tracked[] = (list ?? []).map(({ name, tracker }) => {
				if (tracker?.plugin !== "youtrack") return { name, tracker: undefined };
				if (!SHORT_NAME.test(tracker.project)) throw new Error(`project ${name}: tracker.project ${JSON.stringify(tracker.project)} is not a YouTrack project id: a letter, then letters, digits and underscores`);
				const instance = servers.find((each) => each.name === tracker.instance);
				const known = `youtrack's instances: ${servers.map((each) => each.label).join(", ")}`;
				if (instance === undefined && tracker.instance === undefined) throw new Error(`project ${name}: its tracker names no instance and youtrack has no unnamed one; ${known}`);
				if (instance === undefined) throw new Error(`project ${name}: tracker.instance ${tracker.instance} is not an instance of youtrack; ${known}`);
				return { name, tracker: { instance, project: tracker.project } };
			});
			host.commands.register({ name: "youtrack", doc: new URL("../docs/commands/youtrack.md", import.meta.url), run: ({ args, project }) => youtrackCommand(projects, args, project) });
		},
	};
}

// The instance at `instances[index]`, its URL and token from the variables it names; a value a call could not use refuses
// the load, naming the option and the variable, never the value.
function server(env: Readonly<Record<string, string>>, { name, urlEnv, tokenEnv }: InstanceOptions, index: number, timeoutSeconds: number): Instance {
	const url = URL.parse(env[urlEnv] ?? "");
	if (url === null || !["http:", "https:"].includes(url.protocol) || url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "")
		throw new Error(`instances[${index}].urlEnv: ${urlEnv} does not hold an http or https URL without a user, query or fragment`);
	const token = env[tokenEnv] ?? "";
	if (!/^[\x21-\x7e]+$/.test(token)) throw new Error(`instances[${index}].tokenEnv: ${tokenEnv} is empty or holds a space or a character outside ASCII, which a header cannot carry`);
	return { name, label: name ?? "(unnamed)", urlEnv, tokenEnv, base: `${url.origin}${url.pathname.replace(/\/+$/, "")}`, token, timeoutSeconds };
}
