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
		"core\\.(repositoryformatversion|filemode|bare|worktree|logallrefupdates|ignorecase|precomposeunicode|symlinks|autocrlf|eol|safecrlf|hookspath|fsmonitor|sparsecheckout|sparsecheckoutcone|untrackedcache|usereplacerefs)",
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

// The keys Git reads by a fixed name that name a program or turn signing on, with Git's default: a job may write one between the check and the git call
// (AR0392), so a call that reads them passes each with `-c`, read after the repository's config, as the owner's config sets it, else as this default.
const PINNED = { "commit.gpgsign": "false", "gpg.format": "openpgp", "gpg.program": "gpg", "gpg.ssh.program": "ssh-keygen", "gpg.x509.program": "gpgsm" };

// Before an Arthur git call that may run a program at `root`: `refusal`, the first key of its own config outside ALLOWED with the file that sets it, "" when
// none (Git lists a section and a key in lower case); `pins`, that call's `-c`: PINNED and the keys below, the credential helpers reset by an empty one and
// then the owner's again, no `ext::`. Unset, Git runs GIT_SSH or ssh, SSH_ASKPASS or no askpass, no key command. In a repository, it sets core.useReplaceRefs
// to false again where the last value is not: Git then reads past a replacement (refs/replace) a job wrote by any refspec, its config's too (AR0615).
export function checkConfig(root: string): { readonly refusal: string; readonly pins: readonly string[] } {
	const listed = spawnSync("git", ["-C", root, "config", "--list", "--show-scope", "--show-origin", "-z"], { encoding: "utf8" });
	if (listed.status !== 0) return { refusal: `git config --list in ${root}: ${listed.error?.message ?? (listed.stderr.trim().split("\n").at(-1) || `exit code ${listed.status}`)}`, pins: [] };
	const ssh = process.env.GIT_SSH === undefined ? "ssh" : `'${process.env.GIT_SSH.replaceAll("'", "'\\''")}'`;
	const owner = new Map(Object.entries({ "core.sshcommand": ssh, "core.askpass": process.env.SSH_ASKPASS ?? "", "gpg.ssh.defaultkeycommand": "", ...PINNED }));
	const helpers = ["-c", "credential.helper="];
	let target = ["--local"];
	// `<scope>\0<origin>\0<key>\n<value>\0`, each entry; a key with no value is `true`. No key ALLOWED lets through is pinned.
	const fields = listed.stdout.split("\0");
	for (let at = 0; at + 2 < fields.length; at += 3) {
		const [scope, origin = "", entry = ""] = [fields[at], fields[at + 1], fields[at + 2]];
		const [key, own, file] = [entry.split("\n", 1)[0] ?? "", scope === "local" || scope === "worktree", resolve(root, origin.replace(/^file:/, ""))];
		if (own && !ALLOWED.test(key)) return { refusal: `${file} sets ${key}, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`, pins: [] };
		const value = entry.includes("\n") ? entry.slice(key.length + 1) : "true";
		const name = key === "gpg.openpgp.program" ? "gpg.program" : key;
		if (owner.has(name)) owner.set(name, value);
		else if (/^credential\.(.+\.)?helper$/.test(key)) helpers.push("-c", `${key}=${value}`);
		else if (own && key === "core.usereplacerefs") target = value === "false" ? [] : ["--file", file];
	}
	const set = target.length > 0 && spawnSync("git", ["-C", root, "config", ...target, "--replace-all", "core.useReplaceRefs", "false"], { encoding: "utf8" });
	if (set && set.status !== 0 && spawnSync("git", ["-C", root, "rev-parse"]).status === 0)
		return { refusal: `git config core.useReplaceRefs false in ${root}: ${set.error?.message ?? set.stderr.trim().split("\n").at(-1)}`, pins: [] };
	return { refusal: "", pins: [...helpers, ...[...owner].flatMap(([key, value]) => ["-c", `${key}=${value}`]), "-c", "protocol.ext.allow=never"] };
}
