// What a `git` command line writes, for the worktree guard (spec/roadmap.md, entry 20). `args` are the words after `git`.

// Subcommands that write a tree, the index or a ref of the checkout they run in, and those that change their file operands.
const WRITES_CHECKOUT = ["commit", "checkout", "checkout-index", "read-tree", "update-index", "reset", "add", "restore", "clean", "rebase", "merge", "cherry-pick", "revert", "apply", "am", "rm", "mv", "switch", "pull", "fetch", "push", "bisect", "sparse-checkout", "submodule", "symbolic-ref", "replace", "filter-branch"];
const WRITES_OPERANDS = ["add", "rm", "mv", "restore", "clean", "apply"];
const VALUE_OPTIONS = ["-C", "-c", "--git-dir", "--work-tree", "--namespace"];

// `sub` and the words after it (`rest`); `chdirs`, the folders of its `-C` options in order; `trees`, the folders its
// `--git-dir` and `--work-tree` name; whether it writes the checkout it runs in, and whether it changes its operands.
export type GitCall = {
	readonly sub: string;
	readonly rest: readonly string[];
	readonly chdirs: readonly string[];
	readonly trees: readonly string[];
	readonly writesCheckout: boolean;
	readonly writesOperands: boolean;
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
	return { sub, rest, chdirs, trees, writesCheckout: WRITES_CHECKOUT.includes(sub) || writesRef(sub, rest), writesOperands: WRITES_OPERANDS.includes(sub) || worktree };
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
