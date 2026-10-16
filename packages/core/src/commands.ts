import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The command registry (spec/roadmap.md, entry 6): every command a plugin or the core registers, each with its doc page, run
// from a shell as `arthur <name>`; a phone command also answers `/name text` on a channel, without the model.

export type CommandInput = {
	readonly args: readonly string[];
	// `--project <name>`: the project the command acts on; undefined means the main one.
	readonly project: string | undefined;
};

export type Command = {
	// Lowercase letters, digits and dashes; `/Jobs` is not `jobs`.
	readonly name: string;
	// What `arthur <name> --help` prints, e.g. `new URL("../docs/commands/jobs.md", import.meta.url)`; it must exist at registration.
	readonly doc: URL;
	// Writes its own output; returns the exit code, nothing meaning 0.
	readonly run: (input: CommandInput) => number | void | Promise<number | void>;
	// `about` is the line of a channel's menu; `reply` answers the text after `/name`, empty when there is none.
	readonly phone?: { readonly about: string; readonly reply: (text: string) => string | Promise<string> };
};

export type PhoneCommand = { readonly name: string; readonly about: string };

// What a plugin sees as `host.commands`.
export type Commands = {
	register(command: Command): void;
	// A channel's `/name text`: the phone command's reply, or one line naming the unknown command or the error.
	route(text: string): Promise<string>;
	// The phone commands, by name, for a channel's menu.
	phone(): PhoneCommand[];
};

export type CommandRegistry = Omit<Commands, "register"> & {
	register(owner: string, command: Command): void;
	find(name: string): Command | undefined;
	// Every name, sorted.
	names(): string[];
};

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// `owner` is the plugin that registers, or `core`; a refusal names it.
export function commandRegistry(): CommandRegistry {
	const commands = new Map<string, { readonly owner: string; readonly command: Command }>();
	const sorted = () => [...commands.values()].map((entry) => entry.command).sort((a, b) => (a.name < b.name ? -1 : 1));
	const phone = () => sorted().flatMap(({ name, phone }) => (phone ? [{ name, about: phone.about }] : []));
	return {
		register(owner: string, command: Command) {
			const { name, doc } = command;
			if (typeof name !== "string" || !NAME.test(name)) throw new Error(`command ${JSON.stringify(name)}: expected a name of lowercase letters, digits and dashes`);
			const first = commands.get(name);
			if (first) throw new Error(`command ${name}: registered by ${first.owner} and by ${owner}; a command belongs to one plugin`);
			if (!(doc instanceof URL) || doc.protocol !== "file:")
				throw new Error(`command ${name}: no doc file; register it with doc: new URL("../docs/commands/${name}.md", import.meta.url)`);
			if (!existsSync(doc)) throw new Error(`command ${name}: its doc file ${fileURLToPath(doc)} does not exist`);
			commands.set(name, { owner, command });
		},
		find: (name) => commands.get(name)?.command,
		names: () => sorted().map((command) => command.name),
		phone,
		async route(text) {
			const [, word = "", rest = ""] = /^(\S*)\s*([\s\S]*)$/.exec(text.trim()) ?? [];
			const command = word.startsWith("/") ? commands.get(word.slice(1))?.command : undefined;
			if (!command?.phone) {
				const known = phone().map((entry) => `/${entry.name}`);
				return `unknown command ${word}; ${known.length > 0 ? `phone commands: ${known.join(", ")}` : "no phone commands"}`;
			}
			try {
				return await command.phone.reply(rest);
			} catch (error) {
				return `${word} failed: ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`;
			}
		},
	};
}
