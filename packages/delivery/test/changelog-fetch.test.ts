import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { writeChangelog } from "../src/changelog.ts";
import { delivery } from "../src/delivery.ts";
import { plantAfterCheck } from "./merge-setup.ts";

// The tag fetch of a merge's changelog rebuild (AR0699), `writeChangelog` with `fetch`: origin's v* tags and nothing else, never
// with a prompt or a program. Origin is a bare folder with main and the tags v0.1.0 and `other` at it; `owner` the user's config.

const git = (at: string, ...args: string[]) => execFileSync("git", ["-C", at, ...args], { encoding: "utf8" }).trim();

async function setup(t: TestContext, owner = '[protocol "file"]\n\tallow = always\n') {
	const folder = temporaryFolder();
	const [ran, program, config, root, origin] = ["ran", "program", "gitconfig", "acme", "origin.git"].map((name) => join(folder, name)) as [string, string, string, string, string];
	// One program for every place git may run one (askpass, a hook, fsmonitor, upload-pack, ssh): it notes it ran.
	writeFileSync(program, `#!/bin/sh\necho "$0 $*" >> '${ran}'\necho arthur\n`, { mode: 0o755 });
	writeFileSync(config, `[user]\n\tname = t\n\temail = t@example.com\n${owner}`);
	const env = { GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1", GIT_ASKPASS: program, SSH_ASKPASS: program, GIT_TERMINAL_PROMPT: undefined };
	for (const [name, value] of Object.entries(env)) {
		const was = process.env[name];
		value === undefined ? delete process.env[name] : (process.env[name] = value);
		t.after(() => (was === undefined ? delete process.env[name] : (process.env[name] = was)));
	}
	mkdirSync(join(root, "spec"), { recursive: true });
	writeFileSync(join(root, "spec/build.json"), "[]");
	git(folder, "init", "--quiet", "--initial-branch=main", root);
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "first");
	git(folder, "init", "--quiet", "--bare", origin);
	git(root, "push", "--quiet", origin, "main");
	git(origin, "tag", "v0.1.0", "main");
	git(origin, "tag", "other", "main");
	git(root, "remote", "add", "origin", origin);
	const fake = fakeHost({ name: "delivery" });
	fake.provide("projects", () => [{ name: "acme", path: root, prefix: "AC" }]);
	await fake.setup(delivery());
	const tags = () => git(root, "tag", "--list").split("\n").filter(Boolean);
	return { root, origin, program, ran: () => (existsSync(ran) ? readFileSync(ran, "utf8") : ""), fetch: () => writeChangelog(fake.host, undefined, true), tags };
}

const not = (root: string, why: string) => `tags not fetched from origin: ${why}; CHANGELOG.md counts the tags of ${root}\nwrote CHANGELOG.md: 0 merged tickets`;

test("origin's v* tags only, by the refspec given: no other tag, no ref a remote.origin.fetch names, no prune, no hook or fsmonitor run, a tag held here not moved", async (t) => {
	const { root, origin, program, ran, fetch, tags } = await setup(t);
	// What a job may write: a refspec onto a branch of its own work, a prune, a hook in the repository, an fsmonitor program.
	git(root, "checkout", "--quiet", "-b", "work");
	git(root, "commit", "--quiet", "--allow-empty", "-m", "mine");
	const mine = git(root, "rev-parse", "HEAD");
	git(root, "checkout", "--quiet", "main");
	git(root, "config", "remote.origin.fetch", "+refs/tags/v0.1.0:refs/heads/work");
	git(root, "config", "fetch.prune", "true");
	git(root, "tag", "v0.0.9", "main");
	copyFileSync(program, join(root, ".git/hooks/reference-transaction"));
	git(root, "config", "core.fsmonitor", program);
	assert.equal(fetch(), "wrote CHANGELOG.md: 0 merged tickets");
	assert.deepEqual([tags(), git(root, "rev-parse", "work"), ran()], [["v0.0.9", "v0.1.0"], mine, ""]);
	git(origin, "tag", "v0.2.0", "main");
	git(root, "tag", "v0.2.0", mine);
	assert.equal(fetch(), not(root, "git fetch: exit code 1"));
	assert.equal(git(root, "rev-parse", "v0.2.0"), mine, "not moved");
});

test("refused before any call to origin while the checkout's config sets a key that may name a program; one written after the check runs none", async (t) => {
	const { root, program, ran, fetch, tags } = await setup(t);
	git(root, "config", "remote.origin.uploadpack", program);
	const said = `${join(root, ".git", "config")} sets remote.origin.uploadpack, which a job can write and which may name a program Arthur's git would run; remove it, or set it in your ~/.gitconfig`;
	assert.equal(fetch(), not(root, said));
	assert.deepEqual([tags(), ran()], [[], ""]);
	git(root, "config", "--unset", "remote.origin.uploadpack");
	git(root, "remote", "set-url", "origin", "git@example.invalid:acme/shop.git");
	plantAfterCheck(t, [["core.sshCommand", program]]);
	fetch();
	assert.deepEqual([git(root, "config", "core.sshCommand"), ran()], [program, ""], "planted, not run");
});

test("no transport origin's URL names that the owner does not allow, no prompt, no askpass; git's line said without the URL or a credential", async (t) => {
	const { root, ran, fetch, tags } = await setup(t, "");
	assert.equal(fetch(), not(root, "git fetch: fatal: transport 'file' not allowed"));
	// A server that asks for a credential, in a process of its own: the fetch blocks this one's event loop while it runs.
	const answer = `res.writeHead(401, { "www-authenticate": 'Basic realm="GitHub"' }).end()`;
	const code = `require("node:http").createServer((req, res) => ${answer}).listen(0, "127.0.0.1", function () { console.log(this.address().port); });`;
	const asks = spawn(process.execPath, ["-e", code], { stdio: ["ignore", "pipe", "inherit"] });
	t.after(async () => void (asks.kill(), await once(asks, "exit")));
	const port = Number(String((await once(asks.stdout, "data"))[0]).trim());
	git(root, "remote", "set-url", "origin", `http://127.0.0.1:${port}/acme/shop.git`);
	assert.equal(fetch(), not(root, "git fetch: fatal: could not read Username for origin: terminal prompts disabled"));
	git(root, "remote", "set-url", "origin", `http://arthur:s3cr3t@127.0.0.1:${port}/acme/shop.git`);
	assert.equal(fetch(), not(root, "git fetch: fatal: Authentication failed for origin"));
	assert.deepEqual([tags(), ran()], [[], ""], "nothing fetched, no askpass run");
});
