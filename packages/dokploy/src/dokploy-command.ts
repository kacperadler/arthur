import { call, field, ID, type Instance, NOTHING, text } from "./dokploy-api.ts";
import { envCommand } from "./dokploy-env.ts";
import { createApp, setupApp } from "./dokploy-setup.ts";
import { zipOf } from "./dokploy-zip.ts";

// `arthur dokploy apps|app|status|upload|deploy|create|setup|env` (AR0588, AR0603, AR0654): the projects, applications and
// deployments of the owner's Dokploy servers, on the instance a call names or a project's `dokploy.project(...)` picks, and an
// upload, a deploy, a new app and its setup on the owner's word: docs/commands/dokploy.md. Every refusal of the call's words
// comes before the first request, so a refused call asks Dokploy nothing.

// A project of the list, and what its `dokploy.project(...)` names: the instance and the application's id.
export type Deployed = { readonly name: string; readonly app: { readonly instance: Instance; readonly id: string } | undefined };

const USAGE = "usage: arthur dokploy apps|app [<app>]|status [<app>]|upload [<app>] <file or folder> [--replace-source]|deploy [<app>]|create <name> --dokploy-project <name> [--environment <name>]|setup <app> [--dockerfile <path>] [--context <path>] [--domain <host> --port <n>] [--volume <name>:<path>]|env <app> names|env <app> set <NAME> <value>, each [--instance <name>]; --project <name> for another project than the main one";
// The words a verb takes after it, at least and at most, and its flags besides `--instance`: `upload` its path and the app.
const TAKES: Readonly<Record<string, readonly [number, number, readonly string[]]>> = {
	...{ apps: [0, 0, []], app: [0, 1, []], status: [0, 1, []], upload: [1, 2, ["--replace-source"]], deploy: [0, 1, []], env: [2, 4, []] },
	...{ create: [1, 1, ["--dokploy-project", "--environment"]], setup: [1, 1, ["--dockerfile", "--context", "--domain", "--port", "--volume"]] },
};
const FLAGS = ["--instance", "--replace-source", "--dokploy-project", "--environment", "--dockerfile", "--context", "--domain", "--port", "--volume"];
// How many deployments `status` shows, the newest first.
const SHOWN = 5;

// Writes its output; a refusal throws, wrong usage is exit code 2.
export async function dokployCommand(servers: readonly Instance[], projects: readonly Deployed[], args: readonly string[], name: string | undefined): Promise<number> {
	const [words, flags] = [[] as string[], new Map<string, string[]>()];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		if (!FLAGS.includes(arg)) words.push(arg);
		else flags.set(arg, [...(flags.get(arg) ?? []), arg === "--replace-source" ? "on" : (args[++index] ?? "")]);
	}
	const [verb = "", ...rest] = words;
	// An unknown verb takes at least one word and at most none, so any call of it is wrong.
	const [least, most, allowed] = (Object.hasOwn(TAKES, verb) ? TAKES[verb] : undefined) ?? [1, 0, []];
	const one = (flag: string) => flags.get(flag)?.[0];
	// `env` takes `names`, or `set` with a name and a value, which alone may be empty or start with `-`; `setup` at least one of
	// its flags, `--domain` and `--port` together.
	const setup = [...flags.keys()].some((flag) => flag !== "--instance") && (one("--domain") === undefined) === (one("--port") === undefined);
	const shape = verb === "env" ? (rest[1] === "names" && rest.length === 2) || (rest[1] === "set" && rest.length === 4) : verb !== "setup" || setup;
	const wrong = rest.length < least || rest.length > most || !shape || (verb === "create" && one("--dokploy-project") === undefined);
	const checked = [...(verb === "env" ? rest.slice(0, 3) : rest), ...[...flags.values()].flat()];
	if (wrong || [...flags].some(([flag, values]) => values.length > 1 || (flag !== "--instance" && !allowed.includes(flag))) || checked.some((word) => word === "" || word.startsWith("-"))) {
		console.error(USAGE);
		return 2;
	}
	const named = flags.get("--instance") ?? [];
	const names = servers.map((each) => each.label).join(", ");
	const asked = named[0] === undefined ? undefined : servers.find((each) => each.name === named[0]);
	if (named[0] !== undefined && asked === undefined) throw new Error(`--instance ${text(named[0])} is not an instance of dokploy; its instances: ${names}; ${NOTHING}`);
	if (verb === "apps") return apps(asked === undefined ? servers : [asked]);
	// The call that shows how a write goes on, picking the app the way this one did.
	const next = (then: string, app: string | undefined) => ["arthur dokploy", then, app, named[0] && `--instance ${named[0]}`, name && `--project ${name}`].filter(Boolean).join(" ");
	if (verb === "create") return createApp(pick(servers, projects, name, asked), rest[0] ?? "", one("--dokploy-project") ?? "", one("--environment"), (id) => next("setup", id));
	const app = verb === "upload" ? rest.slice(0, -1)[0] : rest[0];
	const [instance, id] = target(servers, projects, name, asked, app);
	const follow = (then: string) => next(then, app);
	if (verb === "setup") return setupApp(instance, id, { dockerfile: one("--dockerfile"), context: one("--context"), domain: one("--domain"), port: one("--port"), volume: one("--volume") }, follow);
	if (verb === "env") return envCommand(instance, id, rest.slice(1), follow);
	if (verb === "deploy") {
		await call(instance, "application.deploy", {}, `app ${id}`, { applicationId: id });
		console.log(`app ${id} on instance ${instance.label}: Dokploy queued a deployment; to follow it: ${follow("status")}`);
		return 0;
	}
	const upload = verb === "upload" ? zipOf(rest.at(-1) ?? "") : undefined;
	const item = await call(instance, "application.one", { applicationId: id }, `app ${id}`);
	const heading = `${text(field(item, "name"))} (${id}) on instance ${instance.label}`;
	if (upload !== undefined) {
		// Dokploy's dropDeployment makes the app's source `drop`, and its build path the one sent, else "".
		const [source, ran, kept] = [text(field(item, "sourceType")), field(item, "deployments"), field(item, "dropBuildPath")];
		if (source !== "drop" && !(Array.isArray(ran) && ran.length === 0) && one("--replace-source") === undefined) throw new Error(`${heading} deploys from ${source} and has deployments; an upload makes it deploy from drop: add --replace-source for that; nothing was sent`);
		const form = new FormData();
		form.set("applicationId", id);
		form.set("zip", new Blob([upload.zip], { type: "application/zip" }), "upload.zip");
		if (typeof kept === "string") form.set("dropBuildPath", kept);
		await call(instance, "application.dropDeployment", {}, `app ${id}`, form);
		console.log(`${heading}: sent ${upload.said}; Dokploy queued a deployment; to follow it: ${follow("status")}`);
		return 0;
	}
	if (verb === "app") {
		const environment = field(item, "environment");
		const domains = field(item, "domains");
		const urls = (Array.isArray(domains) ? domains : []).map((domain) => {
			const path = field(domain, "path");
			return `${field(domain, "https") === true ? "https" : "http"}://${text(field(domain, "host"))}${typeof path === "string" && path.startsWith("/") ? text(path) : "/"}`;
		});
		const [last] = newest(field(item, "deployments"));
		console.log(
			[
				heading,
				`project: ${text(field(field(environment, "project"), "name"))}, environment: ${text(field(environment, "name"))}`,
				`source: ${text(field(item, "sourceType"))}, status: ${text(field(item, "applicationStatus"))}`,
				`domains: ${urls.join(", ") || "none"}`,
				`last deployment: ${last === undefined ? "none" : deployment(last)}`,
			].join("\n"),
		);
		return 0;
	}
	const list = await call(instance, "deployment.all", { applicationId: id }, `the deployments of app ${id}`);
	if (!Array.isArray(list)) throw new Error(`instance ${instance.label}: the answer for the deployments of app ${id} is not a list`);
	const shown = newest(list).slice(0, SHOWN).map(deployment);
	console.log([`${heading}: ${text(field(item, "applicationStatus"))}`, ...(shown.length === 0 ? ["no deployments"] : shown)].join("\n"));
	return 0;
}

// The instance and the app a call reads: without `<app>` the project's own (`--project`, else the main one), `--instance`
// only if it is that one; with one, on `--instance`, else on the `--project` project's instance, else on the only instance.
function target(servers: readonly Instance[], projects: readonly Deployed[], name: string | undefined, asked: Instance | undefined, app: string | undefined): readonly [Instance, string] {
	const project = name === undefined ? projects[0] : projects.find((each) => each.name === name);
	if (name !== undefined && project === undefined) throw new Error(`unknown project ${name}; ${NOTHING}`);
	if (app === undefined) {
		const others = projects.filter((each) => each.app !== undefined).map((each) => each.name);
		const which = others.length > 0 ? `projects with one: ${others.join(", ")}` : "no project has one";
		if (project?.app === undefined) throw new Error(`${project === undefined ? "there is no project" : `project ${project.name} has no dokploy.project(...)`}: give the app's id, or --project <name>; ${which}; ${NOTHING}`);
		if (asked !== undefined && asked !== project.app.instance) throw new Error(`--instance ${asked.label} is not instance ${project.app.instance.label}, which project ${project.name}'s dokploy.project(...) names; ${NOTHING}`);
		return [project.app.instance, project.app.id];
	}
	if (!ID.test(app)) throw new Error(`the app is not a Dokploy application id: 1 to 64 letters, digits, _ and -; ${NOTHING}`);
	return [pick(servers, projects, name, asked), app];
}

// The instance a call names: `--instance`, else the `--project` project's, else the only one.
function pick(servers: readonly Instance[], projects: readonly Deployed[], name: string | undefined, asked: Instance | undefined): Instance {
	const project = name === undefined ? undefined : projects.find((each) => each.name === name);
	if (name !== undefined && project === undefined) throw new Error(`unknown project ${name}; ${NOTHING}`);
	const instance = asked ?? project?.app?.instance ?? (servers.length === 1 ? servers[0] : undefined);
	if (instance === undefined) throw new Error(`dokploy has ${servers.length} instances (${servers.map((each) => each.label).join(", ")}) and the call names none: add --instance <name>, or --project <name> of a project with dokploy.project(...); ${NOTHING}`);
	return instance;
}

// `arthur dokploy apps`: each instance's projects under its heading; one that fails says so on stderr, and the rest still print.
async function apps(servers: readonly Instance[]): Promise<number> {
	let code = 0;
	for (const [index, instance] of servers.entries()) {
		console.log(`${index > 0 ? "\n" : ""}instance ${instance.label}`);
		try {
			const list = await call(instance, "project.all", {}, "the projects");
			if (!Array.isArray(list)) throw new Error(`instance ${instance.label}: the answer for the projects is not a list`);
			console.log(list.length === 0 ? "no projects" : list.flatMap(projectLines).join("\n"));
		} catch (error) {
			console.error((error as Error).message);
			code = 1;
		}
	}
	return code;
}

// A project and its applications, `<id> <name> (<status>)`, under each environment (Dokploy's answer since environments
// came), or right under the project (the documentation's example); a project or environment without any says so.
function projectLines(project: unknown): string[] {
	const listed = (holder: unknown, indent: string) => {
		const list = field(holder, "applications");
		return (Array.isArray(list) ? list : []).map((app) => `${indent}${text(field(app, "applicationId"))} ${text(field(app, "name"))} (${text(field(app, "applicationStatus"))})`);
	};
	const [heading, environments] = [`project ${text(field(project, "name"))}`, field(project, "environments")];
	if (!Array.isArray(environments)) {
		const lines = listed(project, "  ");
		return lines.length === 0 ? [`${heading}: no applications`] : [heading, ...lines];
	}
	if (environments.length === 0) return [`${heading}: no applications`];
	return [heading, ...environments.flatMap((environment) => {
		const lines = listed(environment, "    ");
		return [`  environment ${text(field(environment, "name"))}${lines.length === 0 ? ": no applications" : ""}`, ...lines];
	})];
}

// Deployments, the newest first by `createdAt`, which Dokploy writes as an ISO time.
function newest(list: unknown): unknown[] {
	return (Array.isArray(list) ? list : []).toSorted((a, b) => text(field(b, "createdAt")).localeCompare(text(field(a, "createdAt"))));
}

// `done: Manual deployment, started <time>, finished <time>`, then Dokploy's error message, as data, each line after `> `.
function deployment(item: unknown): string {
	const [started, finished, error] = [field(item, "startedAt"), field(item, "finishedAt"), field(item, "errorMessage")];
	const when = (time: unknown) => (typeof time === "string" ? text(time) : "not yet");
	const lines = typeof error === "string" && error.trim() !== "" ? error.trim().split("\n").map((line) => `  > ${text(line)}`) : [];
	return [`${text(field(item, "status"))}: ${text(field(item, "title"))}, started ${when(started)}, finished ${when(finished)}`, ...lines].join("\n");
}
