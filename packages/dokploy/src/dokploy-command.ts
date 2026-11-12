import { call, field, ID, type Instance, NOTHING, text } from "./dokploy-api.ts";
import { parseArgs, USAGE } from "./dokploy-args.ts";
import { envCommand } from "./dokploy-env.ts";
import { backupPostgres, createPostgres, postgresStatus } from "./dokploy-postgres.ts";
import { createApp, setupApp } from "./dokploy-setup.ts";
import { sourceApp } from "./dokploy-source.ts";
import { zipOf } from "./dokploy-zip.ts";

// `arthur dokploy apps|app|status|upload|deploy|create|setup|env|source|postgres` (AR0588, AR0603, AR0654, AR0680, AR0681,
// AR0682): the projects, applications and deployments of the owner's Dokploy servers, on the instance a call names or a project's
// `dokploy.project(...)` picks, and an upload, a deploy, a new app, its setup, its source and a Postgres beside it, with its
// backups, on the owner's word: docs/commands/dokploy.md. Every refusal of the call's words comes before the first request, so a
// refused call asks Dokploy nothing.

// A project of the list, and what its `dokploy.project(...)` names: the instance and the application's id.
export type Deployed = { readonly name: string; readonly app: { readonly instance: Instance; readonly id: string } | undefined };

// How many deployments `status` shows, the newest first.
const SHOWN = 5;

// Writes its output; a refusal throws, wrong usage is exit code 2.
export async function dokployCommand(servers: readonly Instance[], projects: readonly Deployed[], args: readonly string[], name: string | undefined): Promise<number> {
	const parsed = parseArgs(args);
	if (parsed === undefined) {
		console.error(USAGE);
		return 2;
	}
	const { verb, rest, one } = parsed;
	const named = one("--instance");
	const names = servers.map((each) => each.label).join(", ");
	const asked = named === undefined ? undefined : servers.find((each) => each.name === named);
	if (named !== undefined && asked === undefined) throw new Error(`--instance ${text(named)} is not an instance of dokploy; its instances: ${names}; ${NOTHING}`);
	if (verb === "apps") return apps(asked === undefined ? servers : [asked]);
	// The call that shows how a write goes on, picking the app the way this one did.
	const next = (then: string, app: string | undefined) => ["arthur dokploy", then, app, named && `--instance ${named}`, name && `--project ${name}`].filter(Boolean).join(" ");
	if (verb === "create") return createApp(pick(servers, projects, name, asked), rest[0] ?? "", one("--dokploy-project") ?? "", one("--environment"), (id) => next("setup", id));
	if (verb === "postgres") {
		if (rest[0] === "status") return postgresStatus(pick(servers, projects, name, asked), rest[1] ?? "");
		const backup = { destination: one("--destination") ?? "", schedule: one("--schedule") ?? "", keep: one("--keep") };
		if (rest[0] === "backup") return backupPostgres(pick(servers, projects, name, asked), rest[1] ?? "", backup, next);
		return createPostgres(...target(servers, projects, name, asked, rest[1]), rest[2] ?? "", { version: one("--version"), env: one("--env") }, next);
	}
	const app = verb === "upload" ? rest.slice(0, -1)[0] : rest[0];
	const [instance, id] = target(servers, projects, name, asked, app);
	const follow = (then: string) => next(then, app);
	if (verb === "setup") return setupApp(instance, id, { dockerfile: one("--dockerfile"), context: one("--context"), domain: one("--domain"), port: one("--port"), volume: one("--volume") }, follow);
	if (verb === "env") return envCommand(instance, id, rest.slice(1), follow);
	if (verb === "source") return sourceApp(instance, id, { repo: one("--repo") ?? "", branch: one("--branch") ?? "", buildPath: one("--build-path"), github: one("--github"), replace: one("--replace-source") !== undefined }, follow);
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
