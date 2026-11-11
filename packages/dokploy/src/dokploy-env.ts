import { isDeepStrictEqual, parseEnv } from "node:util";
import { call, field, type Instance, NOTHING, text } from "./dokploy-api.ts";

// `arthur dokploy env <app> names|set <NAME> <value>` (AR0654): the names of an app's environment, never a value, and one
// variable set on the owner's word, every other line of the env kept: docs/commands/dokploy.md. `postgres create` sets its URL
// the same way (AR0681).

// What Dokploy holds as text, or none: an env, build args, build secrets.
const textOf = (value: unknown): string => (typeof value === "string" ? value : "");
// Every variable but `name`, as a dotenv parser reads them (Dokploy reads the env with dotenv).
const others = (env: string, name: string) => Object.fromEntries(Object.entries(parseEnv(env)).filter(([key]) => key !== name));

export async function envCommand(instance: Instance, id: string, [action, name = "", value = ""]: readonly string[], next: (then: string) => string): Promise<number> {
	if (action === "set" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`${text(name)} is not a variable name: a letter or _, then letters, digits and _; ${NOTHING}`);
	const item = await call(instance, "application.one", { applicationId: id }, `app ${id}`);
	if (action === "set") return setVariable(instance, item, id, name, value, [], next);
	const heading = `${text(field(item, "name"))} (${id}) on instance ${instance.label}`;
	const names = Object.keys(parseEnv(textOf(field(item, "env")))).toSorted().map(text);
	console.log(names.length === 0 ? `${heading}: no variables` : [heading, ...names].join("\n"));
	return 0;
}

// `name` set to `value` in the env of `item`, the app `id` as `application.one` answered it; `hide`: more values Dokploy's error
// text must not show besides the value and the env's.
export async function setVariable(instance: Instance, item: unknown, id: string, name: string, value: string, hide: readonly string[], next: (then: string) => string): Promise<number> {
	const heading = `${text(field(item, "name"))} (${id}) on instance ${instance.label}`;
	const env = textOf(field(item, "env"));
	if (parseEnv(env)[name] === value) {
		console.log(`${heading}: ${name} already holds that value; nothing was sent`);
		return 0;
	}
	// The line as the owner would type it, else quoted: the first form a dotenv parser reads back as the value given.
	const line = [value, `'${value}'`, `"${value}"`].map((each) => `${name}=${each}`).find((each) => parseEnv(each)[name] === value);
	if (line === undefined) throw new Error(`${heading}: the value of ${name} cannot be written as a line that reads back as given, as it is or in either quotes; set it in Dokploy's panel; nothing was sent`);
	const setting = new RegExp(`^\\s*(export\\s+)?${name}\\s*=`);
	const lines = env === "" ? [] : env.split("\n");
	const replaced = lines.filter((each) => setting.test(each)).length;
	const after = replaced > 0 ? lines.map((each) => (setting.test(each) ? line : each)).join("\n") : env === "" ? line : `${env.replace(/\n?$/, "\n")}${line}`;
	if (parseEnv(after)[name] !== value || !isDeepStrictEqual(others(after, name), others(env, name))) throw new Error(`${heading}: the env holds ${name} over several lines or inside another value, so a line set here would change another; set it in Dokploy's panel; nothing was sent`);
	// saveEnvironment takes the build args, build secrets and createEnvFile too: they go back as the app has them.
	const [args, secrets] = [textOf(field(item, "buildArgs")), textOf(field(item, "buildSecrets"))];
	const createEnvFile = field(item, "createEnvFile") !== false;
	const hidden = [value, after, args, secrets, ...hide, ...[after, args, secrets].flatMap((each) => Object.values(parseEnv(each)))].filter((each): each is string => (each ?? "") !== "").toSorted((a, b) => b.length - a.length);
	await call(instance, "application.saveEnvironment", {}, `the env of app ${id}`, { applicationId: id, env: after, buildArgs: args, buildSecrets: secrets, createEnvFile }, hidden);
	console.log(`${heading}: ${name} ${replaced > 0 ? `replaced, on ${replaced} line${replaced > 1 ? "s" : ""}` : "added"}; every other line kept; a deploy applies it: ${next("deploy")}`);
	return 0;
}
