import { call, field, type Instance, NOTHING, text } from "./dokploy-api.ts";

// `arthur dokploy create` and `setup` (AR0654): a new application in a Dokploy project, then its build type, domain and volume,
// on the owner's word: docs/commands/dokploy.md. Each part already in place is left as it is, so a call may be run again.

export type Setup = { readonly dockerfile?: string; readonly context?: string; readonly domain?: string; readonly port?: string; readonly volume?: string };

const listed = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// `create <name> --dokploy-project <project> [--environment <name>]`: the app in that environment, else the project's default
// one, refused when an app of that name is there; `next` gives the `setup` call for the new app's id.
export async function createApp(instance: Instance, name: string, project: string, environment: string | undefined, next: (id: string) => string): Promise<number> {
	const projects = listed(await call(instance, "project.all", {}, "the projects"));
	const found = projects.find((each) => field(each, "name") === project);
	const nothing = "nothing was created";
	if (found === undefined) throw new Error(`instance ${instance.label} has no project ${project}; its projects: ${projects.map((each) => text(field(each, "name"))).join(", ") || "none"}; ${nothing}`);
	const environments = listed(field(found, "environments"));
	const place = environments.find((each) => (environment === undefined ? field(each, "isDefault") === true : field(each, "name") === environment));
	const known = `its environments: ${environments.map((each) => text(field(each, "name"))).join(", ") || "none"}`;
	if (place === undefined) throw new Error(`project ${project} has ${environment === undefined ? "no default environment: add --environment <name>" : `no environment ${environment}`}; ${known}; ${nothing}`);
	const where = `project ${project}, environment ${text(field(place, "name"))}`;
	const taken = listed(field(place, "applications")).find((each) => field(each, "name") === name);
	if (taken !== undefined) throw new Error(`${where} already has an app named ${name} (${text(field(taken, "applicationId"))}); ${nothing}`);
	const made = await call(instance, "application.create", {}, `a new app in ${where}`, { name, environmentId: field(place, "environmentId") });
	const id = text(field(made, "applicationId"));
	console.log(`created ${name} (${id}) in ${where} on instance ${instance.label}; to set it up: ${next(id)}`);
	return 0;
}

// `setup <app>`: the build type `dockerfile` (`application.saveBuildType`), a domain on https with Let's Encrypt
// (`domain.create`), a named volume (`mounts.create`); a domain Dokploy finds not pointing at the server is named in a warning.
export async function setupApp(instance: Instance, id: string, { dockerfile, context, domain, port, volume }: Setup, next: (then: string) => string): Promise<number> {
	if (port !== undefined && !(/^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) throw new Error(`--port ${port} is not a port: 1 to 65535; ${NOTHING}`);
	const mount = volume === undefined ? undefined : /^([A-Za-z0-9][A-Za-z0-9_.-]*):(\/.*)$/.exec(volume);
	if (mount === null) throw new Error(`--volume ${volume} is not <name>:<path>: a name of letters, digits, _, . and -, then a path from /; ${NOTHING}`);
	const item = await call(instance, "application.one", { applicationId: id }, `app ${id}`);
	const heading = `${text(field(item, "name"))} (${id}) on instance ${instance.label}`;
	const at = mount === undefined ? undefined : listed(field(item, "mounts")).find((each) => field(each, "mountPath") === mount[2]);
	const mounted = at !== undefined && field(at, "type") === "volume" && field(at, "volumeName") === mount?.[1];
	if (at !== undefined && !mounted) throw new Error(`${heading} already mounts ${text(field(at, "type"))} ${text(field(at, "volumeName") ?? field(at, "hostPath") ?? field(at, "filePath"))} at ${mount?.[2]}; nothing was changed`);
	const lines = [heading];
	let deploy = false;
	const write = (procedure: string, what: string, body: Readonly<Record<string, unknown>>) => call(instance, procedure, {}, what, body);
	if (domain !== undefined) {
		// Dokploy resolves the host and compares it with the addresses of the server the app runs on (getServerIpCandidates).
		const server = field(item, "serverId");
		const checked = await write("domain.validateDomain", `the domain ${domain}`, { domain, ...(typeof server === "string" ? { serverId: server } : {}) });
		if (field(checked, "isValid") !== true) console.error(`warning: ${domain} does not resolve to the server of ${heading}: ${text(field(checked, "error"))}`);
	}
	if (dockerfile !== undefined || context !== undefined) {
		// saveBuildType takes a dockerfile as text: an app without one gets Dokploy's default, `Dockerfile`.
		const [current, path] = [field(item, "dockerfile"), context ?? field(item, "dockerContextPath")];
		const file = dockerfile ?? (typeof current === "string" ? current : "Dockerfile");
		const said = `build type: dockerfile ${text(file)}, context ${typeof path === "string" ? text(path) : "none"}`;
		const same = field(item, "buildType") === "dockerfile" && current === file && field(item, "dockerContextPath") === path;
		// saveBuildType takes every field it saves; the ones not asked for go back as the app has them.
		const kept = Object.fromEntries(["dockerBuildStage", "herokuVersion", "railpackVersion"].map((key) => [key, field(item, key)]));
		if (!same) await write("application.saveBuildType", `the build type of app ${id}`, { applicationId: id, buildType: "dockerfile", dockerfile: file, dockerContextPath: path, ...kept });
		deploy ||= !same;
		lines.push(`${said}: ${same ? "already set" : "set"}`);
	}
	if (domain !== undefined) {
		const had = listed(field(item, "domains")).find((each) => text(field(each, "host")).toLowerCase() === domain.toLowerCase());
		const body = { host: domain, port: Number(port), https: true, certificateType: "letsencrypt", applicationId: id, domainType: "application" };
		if (had === undefined) await write("domain.create", `a domain of app ${id}`, body);
		lines.push(had === undefined ? `domain https://${domain}/ to port ${port}: added, its certificate from Let's Encrypt` : `domain ${domain}: already set, to port ${text(field(had, "port"))}`);
	}
	if (mount !== undefined) {
		const body = { type: "volume", volumeName: mount[1], mountPath: mount[2], serviceType: "application", serviceId: id };
		if (!mounted) await write("mounts.create", `a volume of app ${id}`, body);
		deploy ||= !mounted;
		lines.push(`volume ${mount[1]} at ${mount[2]}: ${mounted ? "already set" : "added"}`);
	}
	// The build type and a volume reach the container at its next deploy; Dokploy routes a domain at once.
	console.log([...lines, ...(deploy ? [`a deploy applies the build type and the volume: ${next("deploy")}`] : [])].join("\n"));
	return 0;
}
