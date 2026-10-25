import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { type FakeHost, fakeHost, temporaryFolder } from "@arthur/core/testing";
import { type ProjectsOptions, projects } from "../src/projects.ts";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

// A new repository with `files` in its one commit.
function repository(files: Readonly<Record<string, string>> = { "README.md": "# demo\n" }): string {
	const root = temporaryFolder();
	git(root, "init", "--quiet", "--initial-branch=main");
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "--quiet", "-m", "first");
	return root;
}

// The plugin set up on a fake host with these options; `home` gets the host's home folder, for options that name it.
async function load(options: ProjectsOptions | ((home: string) => ProjectsOptions)): Promise<FakeHost> {
	const fake = fakeHost({ name: "projects" });
	const given = typeof options === "function" ? options(dirname(fake.host.folder)) : options;
	await fake.setup({ setup: (host) => projects(given).setup({ ...host, options: given }) });
	return fake;
}

test("the list is served in config order, each folder absolute, the title the name when left out", async () => {
	const [shop, blog] = [repository(), repository()];
	const cwd = process.cwd();
	process.chdir(dirname(blog));
	try {
		const fake = await load({ list: [{ name: "web-shop", title: "Shop", prefix: "SH", path: shop }, { name: "blog", prefix: "BL", path: relative(dirname(blog), blog) }] });
		const [list] = fake.collect<readonly { name: string; path: string; title: string }[]>("projects");
		assert.deepEqual(list?.map(({ name, path, title }) => [name, path, title]), [["web-shop", shop, "Shop"], ["blog", blog, "blog"]]);
	} finally {
		process.chdir(cwd);
	}
});

test("each load keeps every project's name and checkout in <home>/projects/checkouts, rewritten only when the list changed", async () => {
	const [shop, blog] = [repository(), repository()];
	const first = await load({ list: [{ name: "web-shop", prefix: "SH", path: shop }] });
	const file = join(first.host.folder, "checkouts");
	// The config loaded again in the same home folder, as each `arthur` command does.
	const reload = async (list: ProjectsOptions["list"]) => {
		const again = fakeHost({ name: "projects" });
		await again.setup({ setup: (host) => projects({ list }).setup({ ...host, folder: first.host.folder, options: { list } }) });
	};
	assert.equal(readFileSync(file, "utf8"), `web-shop ${shop}\n`);
	const inode = statSync(file).ino;
	await reload([{ name: "web-shop", prefix: "SH", path: shop }]);
	assert.equal(statSync(file).ino, inode, "the same list leaves the file as it is");
	await reload([{ name: "web-shop", prefix: "SH", path: shop }, { name: "blog", prefix: "BL", path: blog }]);
	assert.equal(readFileSync(file, "utf8"), `web-shop ${shop}\nblog ${blog}\n`);
	await assert.rejects(reload([{ name: "web-shop", prefix: "SH", path: join(shop, "gone") }]), /is not a folder/);
	assert.equal(readFileSync(file, "utf8"), `web-shop ${shop}\nblog ${blog}\n`, "a config that does not load leaves the list as it was");
	assert.deepEqual(readdirSync(first.host.folder), ["checkouts"]);
});

test("one repository checked out three times is three projects, each with its own board, whatever ids that board holds", async () => {
	const board = JSON.stringify([{ id: "SH0005", title: "Old", status: "merged", path: "spec/features/SH0005-old/ticket.md", updated: "2026-10-01T00:00:00Z" }]);
	const origin = repository({ "spec/build.json": board });
	const folders = ["shop", "north", "south"].map((name) => {
		const folder = join(temporaryFolder(), name);
		git(dirname(folder), "clone", "--quiet", origin, folder);
		return folder;
	});
	const [shop = "", north = "", south = ""] = folders;
	const fake = await load({
		list: [
			{ name: "shop", prefix: "SH", path: shop },
			{ name: "shop-north", prefix: "NO", path: north },
			{ name: "shop-south", prefix: "SO", path: south },
		],
	});
	const ticket = fake.host.board.create("Paint the fence", "shop-north");
	assert.deepEqual([ticket.id, ticket.project], ["NO0001", "shop-north"]);
	assert.deepEqual(JSON.parse(readFileSync(join(north, "spec/build.json"), "utf8")).map((each: { id: string }) => each.id), ["SH0005", "NO0001"]);
	assert.equal(readFileSync(join(south, "spec/build.json"), "utf8"), board);
	assert.equal(fake.host.board.get("SH0005")?.project, "shop", "an id's prefix names the project that has it");
});

test("a missing repo is cloned into reposDir; the same origin is not cloned again; another origin is refused and left as it is", async () => {
	const origin = repository();
	const reposDir = join(temporaryFolder(), "repos");
	const options = { reposDir, list: [{ name: "docs", prefix: "DOC", repo: origin }] };
	const [list] = (await load(options)).collect<readonly { path: string }[]>("projects");
	assert.equal(list?.[0]?.path, join(reposDir, "docs"));
	assert.equal(git(join(reposDir, "docs"), "remote", "get-url", "origin"), origin);
	writeFileSync(join(reposDir, "docs", "local.txt"), "mine\n");
	await load(options);
	assert.equal(readFileSync(join(reposDir, "docs", "local.txt"), "utf8"), "mine\n", "an existing clone is used as it is");
	const other = repository();
	await assert.rejects(load({ reposDir, list: [{ name: "docs", prefix: "DOC", repo: other }] }), {
		message: `project docs: ${join(reposDir, "docs")} holds ${origin}, not ${other}; it is left as it is`,
	});
	assert.equal(readFileSync(join(reposDir, "docs", "local.txt"), "utf8"), "mine\n");
	mkdirSync(join(reposDir, "plain"));
	await assert.rejects(load({ reposDir, list: [{ name: "plain", prefix: "P", repo: other }] }), { message: `project plain: ${join(reposDir, "plain")} holds no origin, not ${other}; it is left as it is` });
});

test("a clone that fails names the project and leaves no folder", async () => {
	const reposDir = join(temporaryFolder(), "repos");
	const missing = join(temporaryFolder(), "missing.git");
	await assert.rejects(load({ reposDir, list: [{ name: "docs", prefix: "DOC", repo: missing }] }), (error: Error) => {
		assert.match(error.message, new RegExp(`^project docs: git clone ${missing} failed: .+`));
		return true;
	});
	assert.deepEqual(readdirSync(reposDir), []);
});

test("a clone's refusals name a repo's host and path, never the credential its URL holds", async () => {
	const reposDir = join(temporaryFolder(), "repos");
	// git:// takes no userinfo: git looks up `arthur:s3cret@127.0.0.1` as a host name, which fails at once without a query, and
	// its line names that host whole, credential included.
	const repo = "git://arthur:s3cret@127.0.0.1:1/acme/shop.git";
	await assert.rejects(load({ reposDir, list: [{ name: "shop", prefix: "SH", repo }] }), (error: Error) => {
		assert.match(error.message, /^project shop: git clone git:\/\/127\.0\.0\.1:1\/acme\/shop\.git failed: fatal: unable to look up the repo .+/);
		assert.doesNotMatch(error.message, /s3cret|arthur:/);
		return true;
	});
	// A port out of range: new URL cannot parse it, so its userinfo cannot be dropped; the word holding the `@` is masked instead.
	const unparsable = "https://u:s3cret@host:99999/x.git";
	await assert.rejects(load({ reposDir, list: [{ name: "bad", prefix: "BD", repo: unparsable }] }), (error: Error) => {
		assert.match(error.message, /^project bad: git clone the repo failed: .+/);
		assert.doesNotMatch(error.message, /s3cret/);
		return true;
	});
	git(reposDir, "init", "--quiet", "other");
	git(join(reposDir, "other"), "remote", "add", "origin", "https://token:t0ken@example.com/acme/other.git");
	await assert.rejects(load({ reposDir, list: [{ name: "other", prefix: "OT", repo }] }), {
		message: `project other: ${join(reposDir, "other")} holds https://example.com/acme/other.git, not git://127.0.0.1:1/acme/shop.git; it is left as it is`,
	});
});

test("reposDir inside Arthur's home folder is refused", async () => {
	const origin = repository();
	await assert.rejects(load((home) => ({ reposDir: join(home, "repos"), list: [{ name: "docs", prefix: "DOC", repo: origin }] })), (error: Error) => {
		assert.match(error.message, /^project docs: reposDir .+\/repos is inside Arthur's home folder .+; put it outside$/);
		return true;
	});
	await assert.rejects(load((home) => ({ reposDir: home, list: [{ name: "docs", prefix: "DOC", repo: origin }] })), /is inside Arthur's home folder/);
});

test("a path that is not a folder or holds no .git is refused, naming the project", async () => {
	const plain = temporaryFolder();
	await assert.rejects(load({ list: [{ name: "a", prefix: "A", path: plain }] }), { message: `project a: path ${plain} is not a Git repository (no .git in it)` });
	const missing = join(plain, "gone");
	await assert.rejects(load({ list: [{ name: "a", prefix: "A", path: missing }] }), { message: `project a: path ${missing} is not a folder` });
	assert.equal(existsSync(missing), false);
});

test("two known lockfiles and no install are refused at load, naming the files; an install lets them be", async () => {
	const root = repository({ "bun.lock": "{}", "package-lock.json": "{}" });
	await assert.rejects(load({ list: [{ name: "a", prefix: "A", path: root }] }), {
		message: "project a: two known lockfiles (bun.lock, package-lock.json) and no install; set install in its entry of arthur.config.ts",
	});
	await load({ list: [{ name: "a", prefix: "A", path: root, install: "bun install" }] });
});

test("the coordinator's context: the matching line, then one line per project in config order", async () => {
	const fake = await load({
		list: [
			{ name: "web-shop", title: "Shop", prefix: "SH", path: repository(), about: "Online shop for garden tools." },
			{ name: "blog", prefix: "BL", path: repository(), about: "The company blog." },
			{ name: "api", title: "Shop API", prefix: "API", path: repository() },
		],
	});
	const [block] = fake.collect<string>("coordinator.context");
	assert.deepEqual(block?.split("\n"), [
		"A prefix, name or title, in any case, names that project, even when another project's title or about holds the word; a word found in only one project's title or about names it; a word that fits none or several: ask which, naming the candidates. Without `--project` a spawn or ticket goes to the first, the main one.",
		"SH Shop (web-shop): Online shop for garden tools.",
		"BL blog: The company blog.",
		"API Shop API (api)",
	]);
});

test("arthur projects and /projects: each line, folder, open tickets and install; a broken board costs its count only", async (t) => {
	const [shop, blog, api] = [repository({ "package-lock.json": "{}" }), repository(), repository({ "uv.lock": "" })];
	const fake = await load({
		list: [
			{ name: "web-shop", title: "Shop", prefix: "SH", path: shop, about: "Online shop." },
			{ name: "blog", prefix: "BL", path: blog, install: "make deps" },
			{ name: "api", prefix: "API", path: api, install: "" },
		],
	});
	for (const title of ["One", "Two", "Three"]) fake.host.board.create(title);
	fake.host.board.move("SH0002", "dropped");
	fake.host.board.create("Only", "blog");
	const expected = [
		"SH Shop (web-shop): Online shop.",
		`  ${shop}; 2 open tickets; install: npm ci`,
		"BL blog",
		`  ${blog}; 1 open ticket; install: make deps`,
		"API api",
		`  ${api}; 0 open tickets; install: none`,
	];
	const log = t.mock.method(console, "log", () => {});
	const [command] = fake.commands;
	assert.equal(await command?.run({ args: [], project: undefined }), undefined);
	assert.deepEqual(log.mock.calls.map((call) => call.arguments), [[expected.join("\n")]]);
	assert.equal(await fake.host.commands.route("/projects"), expected.join("\n"), "the phone reply is the shell's output");
	writeFileSync(join(blog, "spec/build.json"), "{ broken");
	const reply = (await fake.host.commands.route("/projects")).split("\n");
	assert.match(reply[3] ?? "", new RegExp(`^  ${blog}; board unreadable: .*spec/build\\.json.*; install: make deps$`));
	assert.deepEqual([reply[1], reply[5]], [expected[1], expected[5]]);
	assert.equal(await fake.host.commands.route("/projects all"), "usage: /projects");
	t.mock.method(console, "error", () => {});
	assert.equal(await command?.run({ args: ["all"], project: undefined }), 2);
});

test("doctor: a project with an about and a board is ok; one without either is a non-critical miss each, with its costs and fix", async () => {
	const fake = await load({ list: [{ name: "web-shop", prefix: "SH", path: repository({ "spec/build.json": "[]\n" }), about: "Online shop." }, { name: "blog", prefix: "BL", path: repository() }] });
	const [requirements] = fake.collect<readonly { name: string; check: () => string; costs: string; fix: string; critical: boolean }[]>("doctor");
	const about = "the coordinator knows it only by prefix, name and title";
	assert.deepEqual(
		requirements?.map((each) => [each.name, each.check(), each.costs, each.fix, each.critical]),
		[
			["web-shop about", "ok", about, "add about to project web-shop in arthur.config.ts", false],
			["web-shop board", "ok", "no tickets for web-shop", "arthur init web-shop", false],
			["blog about", "missing: no about", about, "add about to project blog in arthur.config.ts", false],
			["blog board", "missing: no spec/build.json", "no tickets for blog", "arthur init blog", false],
		],
	);
});
