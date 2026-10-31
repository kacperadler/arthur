import type { Plugin } from "@arthur/core/plugin";
import { ID, type Instance } from "./dokploy-api.ts";
import { type Deployed, dokployCommand } from "./dokploy-command.ts";
import { checkOptions } from "./dokploy-options.ts";

// The dokploy plugin (AR0588): the owner's Dokploy servers as instances, named and unnamed, each project's
// `dokploy.project({ instance?, app })` picking one and its application; `arthur dokploy apps|app|status` reads them:
// docs/commands/dokploy.md. The coordinator only: the command runs in no job. It needs the project list, so `projects`
// sets up first.

export type InstanceOptions = { readonly name?: string; readonly url: string; readonly tokenEnv: string };
// A project's piece: its Dokploy application, on the instance it names, else the unnamed one.
export type DokployPiece = { readonly instance?: string; readonly app: string };

export type DokployOptions = { readonly enabled?: boolean; readonly instances: readonly InstanceOptions[]; readonly timeoutSeconds?: number };

// How long a call may wait for its answer when `timeoutSeconds` is left out: a drop deploy unzips before it answers.
export const TIMEOUT_SECONDS = 60;

export function dokploy(options: DokployOptions): Plugin {
	return {
		name: "dokploy",
		module: import.meta.url,
		options,
		requires: ["projects"],
		check: checkOptions,
		// A refusal names the project and the key, never the value given.
		piece(value, options) {
			const { instance, app, ...rest } = (typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}) as Readonly<Record<string, unknown>>;
			if (Object.keys(rest).length > 0 || typeof app !== "string" || (instance !== undefined && typeof instance !== "string")) return "expected { instance?, app }, each a string";
			if (!ID.test(app)) return "app is not a Dokploy application id: 1 to 64 letters, digits, _ and -";
			const names = (options as DokployOptions).instances.map((each) => each.name);
			const known = `dokploy's instances: ${names.map((name) => name ?? "(unnamed)").join(", ")}`;
			if (!names.includes(instance)) return instance === undefined ? `it names no instance and dokploy has no unnamed one; ${known}` : `its instance is not an instance of dokploy; ${known}`;
			return undefined;
		},
		setup(host) {
			const { instances, timeoutSeconds = TIMEOUT_SECONDS } = host.options as DokployOptions;
			const servers = instances.map((each, index) => server(host.env, each, index, timeoutSeconds));
			const [list] = host.collect<readonly { readonly name: string; readonly pieces?: { readonly dokploy?: DokployPiece } }[]>("projects");
			const projects: Deployed[] = (list ?? []).map(({ name, pieces }) => {
				const piece = pieces?.dokploy;
				const instance = servers.find((each) => each.name === piece?.instance);
				return { name, app: piece === undefined || instance === undefined ? undefined : { instance, id: piece.app } };
			});
			host.commands.register({ name: "dokploy", doc: new URL("../docs/commands/dokploy.md", import.meta.url), run: ({ args, project }) => dokployCommand(servers, projects, args, project) });
		},
	};
}

// The instance at `instances[index]`, its token from the variable it names; a token a header cannot carry refuses the load,
// naming the option and the variable, never the value.
function server(env: Readonly<Record<string, string>>, { name, url, tokenEnv }: InstanceOptions, index: number, timeoutSeconds: number): Instance {
	const token = env[tokenEnv] ?? "";
	if (!/^[\x21-\x7e]+$/.test(token)) throw new Error(`instances[${index}].tokenEnv: ${tokenEnv} is empty or holds a space or a character outside ASCII, which a header cannot carry`);
	const parsed = new URL(url);
	return { name, label: name ?? "(unnamed)", tokenEnv, base: `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`, token, timeoutSeconds };
}

// A project file's piece: `dokploy.project({ instance: "client", app: "kXx3..." })`.
dokploy.project = (piece: DokployPiece) => ({ dokploy: piece });
