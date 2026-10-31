import { describe } from "@arthur/core";
import type { Check, OptionTable, Tool, ValueOption } from "@arthur/core/option-table";
import type { OptionProblem, Options } from "@arthur/core/plugin";

// The discord plugin's options file (spec/roadmap.md, entries 89 and 93), checked before any setup by walking `table`:
// packages/discord/docs/discord.md, "Options". The variables' values are checked at setup.

export const summary = "Discord bots, each on one private server: the owner's text to the coordinator, its replies and the notices back";

export const tools: readonly Tool[] = [];

const variable: Check = (value) => (typeof value === "string" && value !== "" ? undefined : "the name of an env variable");

const BOT: Readonly<Record<string, ValueOption>> = {
	name: { about: "The bot's name, which a project's chat.instance gives", default: "none: the unnamed bot", check: (value) => (typeof value === "string" && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value) ? undefined : "lowercase letters, digits and single dashes, from a letter") },
	tokenEnv: { about: "The variable holding the bot's token, from the Bot page of its application in Discord's developer portal", check: variable },
	guildIdEnv: { about: "The variable holding the id of the one server the bot answers", check: variable },
	userIdEnv: { about: "The variable holding the owner's user id, the one user the bot answers", check: variable },
	channelIdEnv: { about: "The variable holding the id of the main channel, the coordinator's; every other text channel of the server is a project's", check: variable },
};

const botList: Check = (value) => (Array.isArray(value) && value.length > 0 ? undefined : "a list of at least one bot");
const address: Check = (value) => { const url = typeof value === "string" ? URL.parse(value) : null; return url?.protocol === "https:" || (url?.protocol === "http:" && /^(localhost|127(\.\d+){3}|\[::1\])$/.test(url.hostname)) ? undefined : "an https URL, or an http one on loopback (localhost, 127.0.0.0/8, ::1)"; };

export const table: OptionTable = {
	bots: { about: "The bots, each { name?, tokenEnv, guildIdEnv, userIdEnv, channelIdEnv }; at most one without a name; a reply goes by the bot its messages came through, the rest by the unnamed one, else the first", check: botList, each: BOT },
	apiUrl: { about: "The REST API's address; a test points it at its fake", default: "https://discord.com/api/v10", check: address },
};

export function checkOptions(options: Options): OptionProblem[] {
	const problems: OptionProblem[] = Object.keys(options)
		.filter((key) => !Object.hasOwn(table, key))
		.map((key) => ({ path: key, problem: `unknown option; options: ${Object.keys(table).join(", ")}` }));
	const { bots, apiUrl } = options;
	if (apiUrl !== undefined && address(apiUrl) !== undefined) problems.push({ path: "apiUrl", problem: `expected ${address(apiUrl)}, got ${describe(apiUrl)}` });
	if (!Array.isArray(bots) || bots.length === 0) return [...problems, { path: "bots", problem: `expected ${botList(bots)}, got ${Array.isArray(bots) ? "an empty list" : describe(bots)}` }];
	const names = new Map<unknown, number>();
	bots.forEach((bot: unknown, index) => {
		const at = `bots[${index}]`;
		if (typeof bot !== "object" || bot === null || Array.isArray(bot)) return problems.push({ path: at, problem: `expected a bot { name?, tokenEnv, guildIdEnv, userIdEnv, channelIdEnv }, got ${describe(bot)}` });
		const record = bot as Readonly<Record<string, unknown>>;
		for (const key of Object.keys(record)) if (!Object.hasOwn(BOT, key)) problems.push({ path: `${at}.${key}`, problem: `unknown key; keys: ${Object.keys(BOT).join(", ")}` });
		for (const [key, entry] of Object.entries(BOT)) {
			const expected = key === "name" && record.name === undefined ? undefined : entry.check(record[key]);
			if (expected !== undefined) problems.push({ path: `${at}.${key}`, problem: `expected ${expected}, got ${describe(record[key])}` });
		}
		const first = names.get(record.name);
		if (first === undefined) names.set(record.name, index);
		else if (record.name === undefined) problems.push({ path: at, problem: `bots[${first}] has no name either; at most one bot is unnamed` });
		else problems.push({ path: `${at}.name`, problem: `${String(record.name)} is the name of bots[${first}] too` });
	});
	return problems;
}
