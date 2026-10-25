import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// A repository's own Git config (its `.git/config`, the main checkout's `config.worktree`, any file they include) is shared by
// every worktree, so a program a job runs can write it, and Git runs the programs it names (a filter, a merge driver, a
// credential helper, `core.sshCommand`, `gpg.program`) in Arthur's own git calls, outside the job (AR0380). Before such a call
// in a checkout (a worktree's checkout, a merge, a reset, a push), that config may set only these keys, which name no program:
// what `git init`, `git clone`, Git LFS, a branch's upstream and Arthur itself write. `core.hooksPath` and `core.fsmonitor`
// pass, as each of those calls sets both itself with `-c`. A program the owner wants goes into his own `~/.gitconfig`.
const ALLOWED = new RegExp(
	`^(${[
		"core\\.(repositoryformatversion|filemode|bare|worktree|logallrefupdates|ignorecase|precomposeunicode|symlinks|autocrlf|eol|safecrlf|hookspath|fsmonitor|sparsecheckout|sparsecheckoutcone|untrackedcache)",
		"extensions\\.(objectformat|refstorage|worktreeconfig)",
		"remote\\..+\\.(url|pushurl|fetch|tagopt|prune|mirror)",
		"branch\\..+\\.(remote|pushremote|merge|rebase|description)",
		"submodule\\..+\\.(url|active)",
		"lfs\\.repositoryformatversion",
		"lfs\\..+\\.(access|locksverify)",
		"user\\.(name|email)",
		"pull\\.(rebase|ff)",
		"push\\.(default|autosetupremote)",
		"fetch\\.prune",
		"maintenance\\.(auto|strategy)",
		"index\\.sparse",
	].join("|")})$`,
);

// Why Arthur runs no git call that may run a program in the checkout or repository at `root`: the first key of its own config
// outside ALLOWED, with the file that sets it; "" when there is none. Git lists a section and a key in lower case.
export function configRefusal(root: string): string {
	const listed = spawnSync("git", ["-C", root, "config", "--list", "--show-scope", "--show-origin", "-z"], { encoding: "utf8" });
	if (listed.status !== 0) return `git config --list in ${root}: ${listed.error?.message ?? (listed.stderr.trim().split("\n").at(-1) || `exit code ${listed.status}`)}`;
	// `<scope>\0<origin>\0<key>\n<value>\0`, each entry.
	const fields = listed.stdout.split("\0");
	for (let at = 0; at + 2 < fields.length; at += 3) {
		const [scope, origin = "", key = ""] = [fields[at], fields[at + 1], fields[at + 2]?.split("\n")[0]];
		if ((scope === "local" || scope === "worktree") && !ALLOWED.test(key))
			return `${resolve(root, origin.replace(/^file:/, ""))} sets ${key}, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	}
	return "";
}
