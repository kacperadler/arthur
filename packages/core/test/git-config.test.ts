import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { configRefusal } from "../src/git-config.ts";
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
	assert.equal(configRefusal(repository()), "");
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
		assert.equal(configRefusal(root), refused(join(root, ".git", "config"), listed), key);
		git(root, "config", "--unset", key);
	}
	assert.equal(configRefusal(root), "", "nothing left");
});

test("the main checkout's own config.worktree is checked once Git reads it; the user's config and the command line's are not", (t) => {
	const root = repository();
	git(root, "config", "--worktree", "core.sshCommand", "program");
	assert.equal(configRefusal(root), refused(join(root, ".git", "config.worktree"), "core.sshcommand"));
	git(root, "config", "extensions.worktreeConfig", "false");
	assert.equal(configRefusal(root), "", "Git reads no config.worktree with extensions.worktreeConfig off");
	const user = join(temporaryFolder(), "gitconfig");
	writeFileSync(user, "[credential]\n\thelper = program\n[filter \"x\"]\n\tsmudge = program\n");
	const env = { GIT_CONFIG_GLOBAL: user, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.sshCommand", GIT_CONFIG_VALUE_0: "program" };
	for (const [name, value] of Object.entries(env)) {
		const was = process.env[name];
		process.env[name] = value;
		t.after(() => (was === undefined ? delete process.env[name] : (process.env[name] = was)));
	}
	assert.match(git(root, "config", "--list", "--show-scope"), /^global\tcredential\.helper=program$[^]*^command\tcore\.sshcommand=program$/m, "both are read");
	assert.equal(configRefusal(root), "");
});

test("a config Git cannot read is refused with Git's own line", () => {
	const root = repository();
	appendFileSync(join(root, ".git", "config"), "[broken\n");
	assert.match(configRefusal(root), new RegExp(`^git config --list in ${root}: fatal: bad config line \\d+ in file \\.git/config$`));
});
