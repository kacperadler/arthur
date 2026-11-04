import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { checkConfig } from "../src/git-config.ts";
import { temporaryFolder } from "../src/testing.ts";

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
const refused = (file: string, key: string) => `${file} sets ${key}, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
// `extensions.refStorage` came with Git 2.45; an older Git refuses the repository that sets it.
const refStorage = spawnSync("git", ["init", "--quiet", "--ref-format=files", join(temporaryFolder(), "probe")]).status === 0;

// A repository whose own config sets every key the check lets through: what `git init` and `git clone`, a branch's upstream,
// Git LFS, a submodule, husky's hooks folder, `git maintenance` and Arthur's own worktree setup write.
function repository(): string {
	const root = temporaryFolder();
	git(root, "init", "--quiet", "--initial-branch=main");
	const keys = [
		["core.repositoryFormatVersion", "1"], ["core.fileMode", "true"], ["core.bare", "false"], ["core.worktree", root], ["core.logAllRefUpdates", "true"],
		["core.ignoreCase", "false"], ["core.precomposeUnicode", "false"], ["core.symlinks", "true"], ["core.autocrlf", "false"], ["core.eol", "lf"],
		["core.safecrlf", "false"], ["core.hooksPath", ".husky"], ["core.fsmonitor", "false"], ["core.sparseCheckout", "false"], ["core.sparseCheckoutCone", "false"],
		["core.untrackedCache", "false"], ["extensions.objectFormat", "sha1"], ["extensions.worktreeConfig", "true"], ...(refStorage ? [["extensions.refStorage", "files"]] : []),
		["remote.origin.url", "git@github.com:acme/shop.git"], ["remote.origin.pushurl", "git@github.com:acme/shop.git"], ["remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*"],
		["remote.origin.tagOpt", "--no-tags"], ["remote.origin.prune", "true"], ["remote.origin.mirror", "false"], ["branch.main.remote", "origin"], ["branch.main.pushRemote", "origin"],
		["branch.main.merge", "refs/heads/main"], ["branch.main.rebase", "false"], ["branch.main.description", "main"], ["submodule.lib.url", "../lib.git"], ["submodule.lib.active", "true"],
		["lfs.repositoryFormatVersion", "0"], ["lfs.https://github.com/acme/shop.git/info/lfs.access", "basic"], ["lfs.https://github.com/acme/shop.git/info/lfs.locksVerify", "true"],
		["user.name", "test"], ["user.email", "test@example.com"], ["pull.rebase", "false"], ["pull.ff", "only"], ["push.default", "simple"], ["push.autoSetupRemote", "true"],
		["fetch.prune", "true"], ["maintenance.auto", "false"], ["maintenance.strategy", "incremental"], ["index.sparse", "false"],
	];
	for (const [key, value] of keys) git(root, "config", key ?? "", value ?? "");
	git(root, "config", "--worktree", "core.sparseCheckout", "false");
	return root;
}

test("a repository's own config that names no program passes: a clone's, a branch's upstream, Git LFS's, husky's and Arthur's", () => {
	assert.equal(checkConfig(repository()).refusal, "");
});

test("each key outside the allowed set is refused, named with the file that sets it, as Git lists it", () => {
	const root = repository();
	const keys = [
		["filter.x.smudge", "filter.x.smudge"], ["filter.x.clean", "filter.x.clean"], ["filter.x.process", "filter.x.process"], ["merge.x.driver", "merge.x.driver"],
		["diff.x.textconv", "diff.x.textconv"], ["diff.external", "diff.external"], ["credential.helper", "credential.helper"],
		["credential.https://example.com.helper", "credential.https://example.com.helper"], ["core.sshCommand", "core.sshcommand"], ["core.pager", "core.pager"],
		["gpg.program", "gpg.program"], ["commit.gpgSign", "commit.gpgsign"], ["log.showSignature", "log.showsignature"], ["push.gpgSign", "push.gpgsign"],
		["url.ext::sh -c evil.insteadOf", "url.ext::sh -c evil.insteadof"], ["protocol.ext.allow", "protocol.ext.allow"], ["remote.origin.receivepack", "remote.origin.receivepack"],
		["remote.x.url.uploadpack", "remote.x.url.uploadpack"], ["alias.lfs", "alias.lfs"], ["lfs.customtransfer.x.path", "lfs.customtransfer.x.path"], ["include.path", "include.path"],
		['includeIf.gitdir:/.path', "includeif.gitdir:/.path"], ["Filter.X.Smudge", "filter.X.smudge"],
	];
	for (const [key = "", listed = ""] of keys) {
		git(root, "config", key, "program");
		assert.deepEqual(checkConfig(root), { refusal: refused(join(root, ".git", "config"), listed), pins: [] }, key);
		git(root, "config", "--unset", key);
	}
	assert.equal(checkConfig(root).refusal, "", "nothing left");
});

test("the main checkout's own config.worktree is checked once Git reads it; the user's config and the command line's are not", (t) => {
	const root = repository();
	git(root, "config", "--worktree", "core.sshCommand", "program");
	assert.equal(checkConfig(root).refusal, refused(join(root, ".git", "config.worktree"), "core.sshcommand"));
	git(root, "config", "extensions.worktreeConfig", "false");
	assert.equal(checkConfig(root).refusal, "", "Git reads no config.worktree with extensions.worktreeConfig off");
	const user = join(temporaryFolder(), "gitconfig");
	writeFileSync(user, "[credential]\n\thelper = program\n[filter \"x\"]\n\tsmudge = program\n");
	const env = { GIT_CONFIG_GLOBAL: user, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.sshCommand", GIT_CONFIG_VALUE_0: "program" };
	for (const [name, value] of Object.entries(env)) {
		const was = process.env[name];
		process.env[name] = value;
		t.after(() => (was === undefined ? delete process.env[name] : (process.env[name] = was)));
	}
	assert.match(git(root, "config", "--list", "--show-scope"), /^global\tcredential\.helper=program$[^]*^command\tcore\.sshcommand=program$/m, "both are read");
	assert.equal(checkConfig(root).refusal, "");
});

test("a config Git cannot read is refused with Git's own line", () => {
	const root = repository();
	appendFileSync(join(root, ".git", "config"), "[broken\n");
	assert.deepEqual(checkConfig(root).pins, []);
	assert.match(checkConfig(root).refusal, new RegExp(`^git config --list in ${root}: fatal: bad config line \\d+ in file \\.git/config$`));
});

// AR0615, the finding of AR0396: `git -C other push --mirror` writes `refs/replace/<tip>` into the main checkout, which every worktree reads.
test("a replacement a mirror push writes is read past once the check ran, which sets core.useReplaceRefs=false again wherever a job undid it", () => {
	const m = repository();
	git(m, "commit", "--quiet", "--allow-empty", "-m", "tip");
	const [tip, other] = [git(m, "rev-parse", "HEAD"), join(temporaryFolder(), "other")];
	git(m, "clone", "--quiet", m, other);
	writeFileSync(join(other, "planted.txt"), "x\n");
	git(other, "add", "planted.txt");
	git(other, "-c", "user.name=x", "-c", "user.email=x@example.com", "commit", "--quiet", "-m", "planted");
	const planted = git(other, "rev-parse", "HEAD");
	git(other, "reset", "--quiet", "--hard", tip);
	git(other, "replace", tip, planted);
	assert.equal(checkConfig(m).refusal, "");
	git(other, "push", "--quiet", "--mirror", m);
	assert.equal(git(m, "rev-parse", `refs/replace/${tip}`), planted, "the push wrote it");
	const reads = (root: string) => [git(root, "status", "--porcelain"), git(root, "log", "-1", "--format=%s")];
	assert.deepEqual(reads(m), ["", "tip"]);
	const linked = join(temporaryFolder(), "linked");
	git(m, "worktree", "add", "--quiet", "-b", "job", linked);
	const undo: readonly (readonly [string, string, () => void])[] = [
		[m, "the shared config", () => git(m, "config", "core.useReplaceRefs", "true")],
		// Every other spelling Git reads as true: each is put back too, not only `true`.
		...["yes", "on", "1", "2", "True"].map((value) => [m, `the shared config, ${value}`, () => git(m, "config", "core.useReplaceRefs", value)] as const),
		[m, "a key with no value", () => appendFileSync(join(m, ".git", "config"), "[core]\n\tuseReplaceRefs\n")],
		[m, "the main checkout's config.worktree", () => git(m, "config", "--worktree", "core.useReplaceRefs", "true")],
		[linked, "the shared config, checked from a job's worktree", () => git(m, "config", "--local", "core.useReplaceRefs", "true")],
	];
	for (const [root, where, write] of undo) {
		write();
		assert.deepEqual(reads(root), ["D  planted.txt", "planted"], `${where}: read again`);
		assert.equal(checkConfig(root).refusal, "", where);
		assert.deepEqual(reads(root), ["", "tip"], `${where}: read past again`);
	}
	git(m, "config", "--worktree", "core.useReplaceRefs", "true");
	chmodSync(join(m, ".git"), 0o555);
	const refusal = checkConfig(m);
	chmodSync(join(m, ".git"), 0o755);
	assert.deepEqual(refusal.pins, []);
	assert.match(refusal.refusal, new RegExp(`^git config core\\.useReplaceRefs false in ${m}: error: could not lock config file .+: Permission denied$`));
});

// The env of the rest of the test: each variable set, or removed when undefined; each one back as it was at the end.
function environment(t: { after: (fn: () => void) => void }, vars: Readonly<Record<string, string | undefined>>): void {
	for (const [name, value] of Object.entries(vars)) {
		const was = process.env[name];
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
		t.after(() => (was === undefined ? delete process.env[name] : (process.env[name] = was)));
	}
}

// The owner's config of a test: `user` as ~/.gitconfig, no system config, nothing from the command line or the env.
const owner = (t: { after: (fn: () => void) => void }, user: string) =>
	environment(t, {
		...{ GIT_CONFIG_GLOBAL: user, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_COUNT: "0", GIT_CONFIG_KEY_0: undefined, GIT_CONFIG_VALUE_0: undefined, GIT_CONFIG_PARAMETERS: undefined },
		...{ GIT_SSH: undefined, GIT_SSH_COMMAND: undefined, GIT_ASKPASS: undefined, SSH_ASKPASS: undefined },
	});
const c = (...values: string[]) => values.flatMap((value) => ["-c", value]);

test("a passed check pins each key Git reads by a fixed name to the owner's config, outside the repository's own, or to Git's default", (t) => {
	const root = repository();
	const user = join(temporaryFolder(), "gitconfig");
	writeFileSync(user, "");
	owner(t, user);
	const defaults = ["gpg.ssh.defaultkeycommand=", "commit.gpgsign=false", "gpg.format=openpgp", "gpg.program=gpg", "gpg.ssh.program=ssh-keygen", "gpg.x509.program=gpgsm", "protocol.ext.allow=never"];
	assert.deepEqual(checkConfig(root).pins, c("credential.helper=", "core.sshcommand=ssh", "core.askpass=", ...defaults), "nothing set: Git's defaults");
	process.env.SSH_ASKPASS = "/usr/bin/ssh-askpass";
	assert.deepEqual(checkConfig(root).pins, c("credential.helper=", "core.sshcommand=ssh", "core.askpass=/usr/bin/ssh-askpass", ...defaults), "SSH_ASKPASS, which Git asks last");
	delete process.env.SSH_ASKPASS;
	// GIT_SSH names the program itself, which core.sshCommand, a shell's command, would otherwise override.
	const folder = temporaryFolder();
	const ssh = join(folder, "it's ssh");
	writeFileSync(ssh, `#!/bin/sh\necho "$@" > '${join(folder, "ran")}'\nexit 1\n`, { mode: 0o755 });
	process.env.GIT_SSH = ssh;
	const { pins } = checkConfig(root);
	assert.deepEqual(pins, c("credential.helper=", `core.sshcommand='${ssh.replaceAll("'", "'\\''")}'`, "core.askpass=", ...defaults), "GIT_SSH, quoted for the shell");
	spawnSync("git", ["-C", root, ...pins, "ls-remote", "ssh://example.invalid/x"]);
	assert.match(readFileSync(join(folder, "ran"), "utf8"), /^example\.invalid git-upload-pack '\/x'$/m, "Git runs it");
	const config = ["[credential]", "\thelper = first", "\thelper =", "\thelper = second", '[credential "https://example.com"]', "\thelper = url", "[core]", "\tsshCommand = user ssh", "\taskPass = asks"];
	config.push("[gpg]", "\tformat = ssh", "\tprogram = gpg one");
	const more = ['[gpg "openpgp"]', "\tprogram = gpg two", '[gpg "ssh"]', "\tprogram = keygen", "\tdefaultKeyCommand = key", '[gpg "x509"]', "\tprogram = gpgsm two", "[commit]", "\tgpgSign"];
	writeFileSync(user, [...config, ...more, ""].join("\n"));
	Object.assign(process.env, { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.sshCommand", GIT_CONFIG_VALUE_0: "command ssh" });
	assert.deepEqual(
		checkConfig(root).pins,
		c(...["credential.helper=", "credential.helper=first", "credential.helper=", "credential.helper=second", "credential.https://example.com.helper=url", "core.sshcommand=command ssh", "core.askpass=asks"],
			...["gpg.ssh.defaultkeycommand=key", "commit.gpgsign=true", "gpg.format=ssh", "gpg.program=gpg two", "gpg.ssh.program=keygen", "gpg.x509.program=gpgsm two", "protocol.ext.allow=never"]),
		"the owner's, the last one of each, in the order Git reads them; gpg.openpgp.program is gpg.program; a key with no value is true",
	);
});

test("a key a job writes into the repository's config after the check runs no program in a git call with the pins; without them it does", (t) => {
	const root = repository();
	const folder = temporaryFolder();
	const script = (name: string) => {
		writeFileSync(join(folder, name), `#!/bin/sh\necho "$@" >> '${join(folder, `${name}.ran`)}'\nexit 1\n`, { mode: 0o755 });
		return join(folder, name);
	};
	const [planted, own, user] = [script("planted"), script("own"), join(folder, "gitconfig")];
	const owned = [`[credential]\n\thelper = !${own}`, `[core]\n\tsshCommand = ${own}\n\taskPass = ${own}`, `[gpg]\n\tprogram = ${own}`, `[gpg "x509"]\n\tprogram = ${own}`];
	writeFileSync(user, [...owned, `[gpg "ssh"]\n\tprogram = ${own}\n\tallowedSignersFile = ${user}\n`].join("\n"));
	owner(t, user);
	environment(t, { GIT_TERMINAL_PROMPT: "0" });
	const { pins } = checkConfig(root);
	const tree = git(root, "hash-object", "-w", "-t", "tree", "/dev/null");
	const head = `tree ${tree}\nauthor a <a@example.com> 1 +0000\ncommitter a <a@example.com> 1 +0000\n`;
	const signed = (kind: string) =>
		execFileSync("git", ["-C", root, "hash-object", "-w", "-t", "commit", "--stdin"], { encoding: "utf8", input: `${head}gpgsig -----BEGIN ${kind}-----\n eA==\n -----END ${kind}-----\n\nsigned\n` }).trim();
	const fill = ["credential", "fill"];
	const commit = ["commit", "--quiet", "--allow-empty", "-m", "planted"];
	// The keys planted, the git call, whether the owner's own program runs in it instead.
	const rows: [string[][], string[], boolean][] = [
		[[["credential.helper", `!${planted}`]], fill, true],
		[[["core.askPass", planted]], fill, true],
		[[["credential.https://example.com.helper", `!${planted}`]], fill, true],
		[[["core.sshCommand", planted]], ["ls-remote", "ssh://example.invalid/x"], true],
		[[["protocol.ext.allow", "always"]], ["ls-remote", `ext::${planted}`], false],
		[[["commit.gpgSign", "true"], ["gpg.program", planted]], commit, false],
		[[["commit.gpgSign", "true"], ["gpg.openpgp.program", planted]], commit, false],
		[[["gpg.format", "x509"], ["gpg.x509.program", planted]], [...commit, "-S"], true],
		[[["gpg.format", "ssh"], ["gpg.ssh.defaultKeyCommand", planted]], [...commit, "-S"], true],
		[[["gpg.program", planted]], ["log", "--show-signature", signed("PGP SIGNATURE")], true],
		[[["gpg.ssh.program", planted]], ["log", "--show-signature", signed("SSH SIGNATURE")], true],
		[[["gpg.x509.program", planted]], ["log", "--show-signature", signed("SIGNED MESSAGE")], true],
	];
	for (const [keys, args, ran] of rows) {
		for (const [key = "", value = ""] of keys) git(root, "config", key, value);
		const run = (...before: string[]) => spawnSync("git", ["-C", root, ...before, ...args], { encoding: "utf8", input: "protocol=https\nhost=example.com\n\n" });
		const pinned = run(...pins);
		const what = `${keys.join(" ")}: git ${args.join(" ")}`;
		assert.deepEqual([existsSync(`${planted}.ran`), existsSync(`${own}.ran`)], [false, ran], `${what}: ${pinned.stderr}`);
		if (args === commit) assert.equal(pinned.status, 0, `${what}: unsigned, ${pinned.stderr}`);
		run();
		assert.equal(existsSync(`${planted}.ran`), true, `${what}: runs it without the pins`);
		for (const [key = ""] of keys) git(root, "config", "--unset", key);
		for (const name of [planted, own]) rmSync(`${name}.ran`, { force: true });
	}
});
