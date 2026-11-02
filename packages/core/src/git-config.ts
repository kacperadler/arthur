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

// The keys Git reads by a fixed name that name a program or turn signing on, each with the value Git takes when no config
// sets it. A job's program may write one into the repository's own config between the check and the git call (AR0392), so a
// git call that reads them sets each with `-c`, which Git reads after that config: the owner's own value, or this default.
const PINNED: Readonly<Record<string, string>> = {
	"commit.gpgsign": "false",
	"gpg.format": "openpgp",
	"gpg.program": "gpg",
	"gpg.ssh.program": "ssh-keygen",
	"gpg.x509.program": "gpgsm",
	"gpg.ssh.defaultkeycommand": "",
};

// The check of the checkout or repository at `root` before an Arthur git call that may run a program. `refusal`: the first
// key of its own config outside ALLOWED, with the file that sets it, "" when there is none (Git lists a section and a key in
// lower case). `pins`: the `-c` arguments of that call, the keys of PINNED, `core.sshCommand` and the credential helpers (the
// list reset by an empty one, then the owner's again) as the config outside the repository's own sets them, and no `ext::`.
export function checkConfig(root: string): { readonly refusal: string; readonly pins: readonly string[] } {
	const listed = spawnSync("git", ["-C", root, "config", "--list", "--show-scope", "--show-origin", "-z"], { encoding: "utf8" });
	if (listed.status !== 0) return { refusal: `git config --list in ${root}: ${listed.error?.message ?? (listed.stderr.trim().split("\n").at(-1) || `exit code ${listed.status}`)}`, pins: [] };
	const ssh = process.env.GIT_SSH;
	const owner = new Map([["core.sshcommand", ssh === undefined ? "ssh" : `'${ssh.replaceAll("'", "'\\''")}'`], ...Object.entries(PINNED)]);
	const helpers = ["-c", "credential.helper="];
	// `<scope>\0<origin>\0<key>\n<value>\0`, each entry; a key with no value, `true`.
	const fields = listed.stdout.split("\0");
	for (let at = 0; at + 2 < fields.length; at += 3) {
		const [scope, origin = "", entry = ""] = [fields[at], fields[at + 1], fields[at + 2]];
		const cut = entry.indexOf("\n");
		const [key, value] = cut < 0 ? [entry, "true"] : [entry.slice(0, cut), entry.slice(cut + 1)];
		if (scope === "local" || scope === "worktree") {
			if (ALLOWED.test(key)) continue;
			return { refusal: `${resolve(root, origin.replace(/^file:/, ""))} sets ${key}, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`, pins: [] };
		}
		const name = key === "gpg.openpgp.program" ? "gpg.program" : key;
		if (owner.has(name)) owner.set(name, value);
		else if (/^credential\.(.+\.)?helper$/.test(key)) helpers.push("-c", `${key}=${value}`);
	}
	return { refusal: "", pins: [...helpers, ...[...owner].flatMap(([key, value]) => ["-c", `${key}=${value}`]), "-c", "protocol.ext.allow=never"] };
}
