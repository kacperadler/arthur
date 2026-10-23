// What a `git` command line writes, for the worktree guard (spec/roadmap.md, entry 20). `args` are the words after `git`.

// Subcommands that write a tree, the index or a ref of the checkout they run in, and those that change their file operands.
const WRITES_CHECKOUT = ["commit", "checkout", "checkout-index", "read-tree", "update-index", "reset", "add", "restore", "clean", "rebase", "merge", "cherry-pick", "revert", "apply", "am", "rm", "mv", "switch", "pull", "fetch", "push", "bisect", "sparse-checkout", "submodule", "symbolic-ref", "replace", "filter-branch"];
const WRITES_OPERANDS = ["add", "rm", "mv", "restore", "clean", "apply"];
const VALUE_OPTIONS = ["-C", "-c", "--git-dir", "--work-tree", "--namespace"];
// `git config`: its options that take a value; those that neither read nor change by themselves (any other, an abbreviation
// or a `--no-` included, may change); the actions that only read, and the subcommands that change.
const CONFIG_VALUES = ["-f", "--file", "--blob", "-t", "--type", "--default", "--comment", "--value", "--url"];
const CONFIG_PLAIN = /^(?:--(?:global|system|local|worktree|file|blob|type|bool|int|bool-or-int|bool-or-str|path|expiry-date|null|name-only|includes|show-origin|show-scope|default|fixed-value|comment|value|all|regexp|url)(?:=.*)?|-[ft].*|-z)$/;
const CONFIG_READS = /^(?:--get(?:-all|-regexp|-urlmatch|-color|-colorbool)?|--list|-l)$/;
const CONFIG_SUBCOMMANDS = ["set", "unset", "rename-section", "remove-section", "edit"];

// `sub` and the words after it (`rest`); `chdirs`, the folders of its `-C` options in order; `trees`, the folders its
// `--git-dir` and `--work-tree` name; whether it writes the checkout it runs in, and whether it changes its operands;
// `config`, a `git config` that sets or unsets: its key, its `--global`, `--system` or `--worktree` (else ""), and the
// `--file` it writes, if any.
export type GitCall = {
	readonly sub: string;
	readonly rest: readonly string[];
	readonly chdirs: readonly string[];
	readonly trees: readonly string[];
	readonly writesCheckout: boolean;
	readonly writesOperands: boolean;
	readonly config: { readonly key: string; readonly scope: "" | "--global" | "--system" | "--worktree"; readonly file: string | undefined } | undefined;
};

export function gitCall(args: readonly string[]): GitCall {
	const options: string[] = [];
	let index = 0;
	for (; index < args.length && args[index]!.startsWith("-"); index++) {
		options.push(args[index]!);
		if (VALUE_OPTIONS.includes(args[index]!)) options.push(args[++index] ?? "");
	}
	const [sub = "", ...rest] = args.slice(index);
	const chdirs = options.filter((_, at) => options[at - 1] === "-C");
	const trees = options.flatMap((option, at) => (/^--(?:git-dir|work-tree)=/.test(option) ? [option.slice(option.indexOf("=") + 1)] : /^--(?:git-dir|work-tree)$/.test(options[at - 1] ?? "") ? [option] : []));
	const worktree = sub === "worktree" && ["add", "remove", "move", "lock", "unlock", "repair"].includes(rest[0] ?? "");
	return { sub, rest, chdirs, trees, writesCheckout: WRITES_CHECKOUT.includes(sub) || writesRef(sub, rest), writesOperands: WRITES_OPERANDS.includes(sub) || worktree, config: sub === "config" ? configWrite(rest) : undefined };
}

// What `git config <rest>` writes, or undefined when it only reads: an action that reads (`--get*`, `--list`, `-l`, the `get`
// and `list` subcommands; with another action Git refuses the call), or a lone key with plain options. A `--no-` option is
// never taken as a read nor a narrower scope, since it may undo either. Two config files at once Git refuses.
function configWrite(rest: readonly string[]): GitCall["config"] {
	const operands = rest.filter((word, at) => !word.startsWith("-") && !CONFIG_VALUES.includes(rest[at - 1] ?? ""));
	const [negated, subcommand] = [rest.some((word) => word.startsWith("--no-")), CONFIG_SUBCOMMANDS.includes(operands[0] ?? "")];
	if (!negated && (rest.some((word) => CONFIG_READS.test(word)) || ["get", "list"].includes(operands[0] ?? ""))) return undefined;
	if (!subcommand && operands.length < 2 && rest.every((word) => !word.startsWith("-") || CONFIG_PLAIN.test(word))) return undefined;
	const files = rest.flatMap((word, at) => (word.startsWith("--file=") ? [word.slice(7)] : /^-f./.test(word) ? [word.slice(2)] : ["-f", "--file"].includes(rest[at - 1] ?? "") ? [word] : []));
	const scope = negated ? "" : rest.includes("--global") ? "--global" : rest.includes("--system") ? "--system" : rest.includes("--worktree") ? "--worktree" : "";
	return { key: operands[subcommand ? 1 : 0] ?? "", scope, file: negated ? undefined : files.at(-1) };
}

// Whether `git <sub> <rest>` writes a ref, beside the subcommands that always do: `branch` or `tag` with a flag that
// forces, deletes, moves, copies or sets an upstream, or naming one without a flag that lists; `remote` or `notes` with a
// verb that changes them.
function writesRef(sub: string, rest: readonly string[]): boolean {
	if (sub === "remote" || sub === "notes") return /^(?:add|remove|rm|rename|set-|prune|update|append|copy|edit|merge)/.test(rest[0] ?? "");
	if (sub !== "branch" && sub !== "tag") return false;
	const changes = rest.some((word) => /^-[a-zA-Z]*[fdDmMcCu]|^--(?:force|delete|move|copy|(?:un)?set-upstream)/.test(word));
	const lists = rest.some((word) => /^-[a-zA-Z]*l|^--(?:list|contains|no-contains|merged|no-merged|points-at)/.test(word));
	return changes || (rest.some((word) => !word.startsWith("-")) && !lists);
}
