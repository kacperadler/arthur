// The one flag parser, of `arthur --project`, `spawn` and `continue`: each `--<name> <value>` that `checks` names, the other
// words in order. A check says what is wrong with a value, `before` the one given first; `keep` keeps an unknown flag a word.
export type Check = (value: string | undefined, before: string | undefined) => string | undefined;
export const text: Check = (value, before) => (value === undefined || value === "" || value.startsWith("--") ? "needs a value" : before === undefined ? undefined : "given twice");
// A plain decimal: no sign, exponent, hex or `Infinity`, which `Number` would take.
export const amount: Check = (value) => (/^\d+(\.\d+)?$/.test(value ?? "") ? undefined : `needs a number of 0 or more, got ${value || "nothing"}`);
export function parseFlags(args: readonly string[], checks: Readonly<Record<string, Check>>, keep = false): { words: string[]; values: Partial<Record<string, string>> } | string {
	const words: string[] = [];
	const values: Partial<Record<string, string>> = {};
	let problem: string | undefined;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		const name = arg.slice(2);
		const check = arg.startsWith("--") && Object.hasOwn(checks, name) ? checks[name] : undefined;
		if (check === undefined && (keep || !arg.startsWith("--"))) words.push(arg);
		else if (check === undefined) return `unknown flag ${arg}`;
		else if ((problem = check(args[++index], values[name])) !== undefined) return `${arg} ${problem}`;
		else values[name] = args[index];
	}
	return { words, values };
}
