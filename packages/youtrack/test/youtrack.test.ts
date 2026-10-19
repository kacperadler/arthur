import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { type TestContext, test } from "node:test";
import { fakeHost } from "@arthur/core/testing";
import { checkOptions } from "../src/youtrack-options.ts";
import { type YoutrackOptions, youtrack } from "../src/youtrack.ts";

const TOKEN = "perm:YXJ0aHVy.dGVzdA==.Kn0wnT0kenN3verPr1nted";
const ACME_TOKEN = "perm:YWNtZQ==.dGVzdA==.AcmeT0kenN3verPr1nted";
const DAY = Date.UTC(2026, 9, 1);

// Entities as YouTrack's REST documentation shows them: every field the plugin asks for, `id` and `$type` too.
const issue = (project: string, number: number) => ({ idReadable: `${project}-${number}`, summary: `Issue ${number}`, resolved: number % 2 === 0 ? DAY : null, id: `2-${number}`, $type: "Issue" });
const FULL_ISSUE = {
	idReadable: "SHOP-1",
	summary: "Checkout fails\u001b[31m",
	description: "Steps:\n1. Pay.\n2. See the error.",
	created: DAY,
	updated: DAY + 86_400_000,
	resolved: null,
	reporter: { login: "jane", name: "Jane Doe", $type: "User" },
	customFields: [
		{ name: "Priority", value: { name: "Critical", $type: "EnumBundleElement" }, $type: "SingleEnumIssueCustomField" },
		{ name: "Assignee", value: null, $type: "SingleUserIssueCustomField" },
		{ name: "Fix versions", value: [{ name: "1.0", $type: "VersionBundleElement" }, { name: "1.1", $type: "VersionBundleElement" }], $type: "MultiVersionIssueCustomField" },
		{ name: "Estimation", value: { presentation: "1d 2h", $type: "PeriodValue" }, $type: "PeriodIssueCustomField" },
		{ name: "Story points", value: 5, $type: "SimpleIssueCustomField" },
		{ name: "Notes", value: { text: "See the wiki.", $type: "TextFieldValue" }, $type: "TextIssueCustomField" },
	],
	id: "2-1",
	$type: "Issue",
};
const ARTICLE = {
	idReadable: "SHOP-A-2",
	summary: "Release steps",
	content: "Tag, then deploy.",
	created: DAY,
	updated: DAY,
	reporter: { login: "jane", name: "Jane Doe", $type: "User" },
	parentArticle: { idReadable: "SHOP-A-1", $type: "Article" },
	id: "226-1",
	$type: "Article",
};

type Seen = { readonly path: string; readonly params: URLSearchParams; readonly authorization: string | undefined };

// A fake YouTrack on a loopback port the OS picks: the unnamed instance at `/`, holding project SHOP with `issues` issues, and
// `acme` under `/acme`, a server under a path, holding SITE. A wrong token gets YouTrack's 401, its reason echoing the token;
// `/slow` never answers; `/broken` answers HTML.
async function server(t: TestContext, issues = 3) {
	const seen: Seen[] = [];
	const send = (response: ServerResponse, status: number, body: unknown) => response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
	const fake = createServer((request: IncomingMessage, response: ServerResponse) => {
		const url = new URL(request.url ?? "/", "http://localhost");
		seen.push({ path: url.pathname, params: url.searchParams, authorization: request.headers.authorization });
		if (url.pathname.startsWith("/slow/")) return;
		if (url.pathname.startsWith("/broken/")) return response.writeHead(200, { "Content-Type": "text/html" }).end("<html>Log in</html>");
		const acme = url.pathname.startsWith("/acme/");
		const path = acme ? url.pathname.slice("/acme".length) : url.pathname;
		const [project, token] = acme ? ["SITE", ACME_TOKEN] : ["SHOP", TOKEN];
		if (request.headers.authorization !== `Bearer ${token}`)
			return send(response, 401, { error: "Unauthorized", error_description: `You are not logged in: ${request.headers.authorization ?? ""}` });
		const page = (all: readonly unknown[]) => {
			const skip = Number(url.searchParams.get("$skip") ?? 0);
			return all.slice(skip, skip + Number(url.searchParams.get("$top") ?? 42));
		};
		if (path === "/api/issues" && url.searchParams.get("query") === `project: ${project}`) return send(response, 200, page(Array.from({ length: acme ? 1 : issues }, (_, index) => issue(project, index + 1))));
		if (path === "/api/issues/SHOP-1" && !acme) return send(response, 200, FULL_ISSUE);
		if (path === "/api/issues/SHOP-500" && !acme) return send(response, 500, { error: "server_error", error_description: `Something went\nwrong at ${request.headers.host}` });
		if (path === `/api/admin/projects/${project}/articles`) return send(response, 200, page(acme ? [] : [{ ...ARTICLE, idReadable: "SHOP-A-1", summary: "Handbook", parentArticle: null }, ARTICLE]));
		if (path === "/api/articles/SHOP-A-2" && !acme) return send(response, 200, ARTICLE);
		send(response, 404, { error: "Not Found", error_description: "HTTP 404 Not Found" });
	});
	fake.listen(0, "127.0.0.1");
	await once(fake, "listening");
	t.after(() => {
		fake.closeAllConnections();
		fake.close();
	});
	return { url: `http://127.0.0.1:${(fake.address() as AddressInfo).port}`, seen };
}

const INSTANCES = [
	{ urlEnv: "ARTHUR_YOUTRACK_URL", tokenEnv: "ARTHUR_YOUTRACK_TOKEN" },
	{ name: "acme", urlEnv: "ARTHUR_YOUTRACK_ACME_URL", tokenEnv: "ARTHUR_YOUTRACK_ACME_TOKEN" },
];
const PROJECTS = [
	{ name: "web-shop", prefix: "SH", tracker: { plugin: "youtrack", project: "SHOP" } },
	{ name: "site", prefix: "SI", tracker: { plugin: "youtrack", instance: "acme", project: "SITE" } },
	{ name: "blog", prefix: "BL" },
];

// The plugin set up on a fake host with the project list `projects` and the variables `env`; `run` runs `arthur youtrack`
// and returns its exit code and what it printed, or rejects with its refusal.
async function load(t: TestContext, env: Readonly<Record<string, string>>, { options = { instances: INSTANCES } as YoutrackOptions, projects = PROJECTS as readonly unknown[] } = {}) {
	const plugin = youtrack(options);
	const fake = fakeHost({ name: "youtrack", options: plugin.options, env });
	fake.provide("projects", () => projects);
	await fake.setup(plugin);
	const command = fake.commands.find((each) => each.name === "youtrack");
	return async (project: string | undefined, ...args: string[]) => {
		const [logs, errors] = [[] as string[], [] as string[]];
		const log = t.mock.method(console, "log", (text: string) => void logs.push(text));
		const error = t.mock.method(console, "error", (text: string) => void errors.push(text));
		try {
			const code = await command?.run({ args, project });
			return { code, out: logs.join("\n"), err: errors.join("\n") };
		} finally {
			log.mock.restore();
			error.mock.restore();
		}
	};
}

const envFor = (url: string, acme = `${url}/acme/`) => ({ ARTHUR_YOUTRACK_URL: url, ARTHUR_YOUTRACK_TOKEN: TOKEN, ARTHUR_YOUTRACK_ACME_URL: acme, ARTHUR_YOUTRACK_ACME_TOKEN: ACME_TOKEN });

// A refusal: one line, never the token.
async function refusal(run: Promise<unknown>): Promise<string> {
	const error = await run.then(
		() => assert.fail("expected a refusal"),
		(error: Error) => error,
	);
	assert.doesNotMatch(error.message, /\n/);
	for (const token of [TOKEN, ACME_TOKEN]) assert.ok(!error.message.includes(token), `the token appears in: ${error.message}`);
	return error.message;
}

test("an unnamed and a named instance side by side: each project reads its own server with its own token", async (t) => {
	const { url, seen } = await server(t);
	const run = await load(t, envFor(url));
	assert.deepEqual(await run(undefined, "issue", "list"), { code: 0, out: "SHOP-1 Issue 1\nSHOP-2 Issue 2 (resolved)\nSHOP-3 Issue 3", err: "" });
	assert.deepEqual(await run("site", "issue", "list"), { code: 0, out: "SITE-1 Issue 1", err: "" });
	assert.deepEqual(await run("site", "article", "list"), { code: 0, out: "no articles in YouTrack project SITE", err: "" });
	assert.deepEqual(
		seen.map(({ path, authorization }) => [path, authorization]),
		[
			["/api/issues", `Bearer ${TOKEN}`],
			["/acme/api/issues", `Bearer ${ACME_TOKEN}`],
			["/acme/api/admin/projects/SITE/articles", `Bearer ${ACME_TOKEN}`],
		],
	);
	assert.deepEqual(Object.fromEntries(seen[0]?.params ?? []), { fields: "idReadable,summary,resolved", query: "project: SHOP", $top: "100", $skip: "0" });
});

test("a list is read past its first page, page by page, until a page holds fewer than 100", async (t) => {
	const { url, seen } = await server(t, 230);
	const run = await load(t, envFor(url));
	const { out } = await run(undefined, "issue", "list");
	const lines = out.split("\n");
	assert.equal(lines.length, 230);
	assert.deepEqual([lines[0], lines[100], lines[229]], ["SHOP-1 Issue 1", "SHOP-101 Issue 101", "SHOP-230 Issue 230 (resolved)"]);
	assert.deepEqual(seen.map(({ params }) => params.get("$skip")), ["0", "100", "200"]);
	const exact = await server(t, 100);
	await (await load(t, envFor(exact.url)))(undefined, "issue", "list");
	assert.deepEqual(exact.seen.map(({ params }) => params.get("$skip")), ["0", "100"], "a full last page asks once more");
});

test("issue get and article get print the item: who and when, custom fields of each shape, the text; control characters dropped", async (t) => {
	const { url } = await server(t);
	const run = await load(t, envFor(url));
	assert.deepEqual(await run(undefined, "issue", "get", "SHOP-1"), {
		code: 0,
		out: [
			"SHOP-1: Checkout fails[31m",
			"reporter: Jane Doe (jane); created 2026-10-01; updated 2026-10-02",
			"resolved: no",
			"Priority: Critical",
			"Assignee: none",
			"Fix versions: 1.0, 1.1",
			"Estimation: 1d 2h",
			"Story points: 5",
			"Notes: See the wiki.",
			"",
			"Steps:\n1. Pay.\n2. See the error.",
		].join("\n"),
		err: "",
	});
	assert.deepEqual(await run(undefined, "article", "list"), { code: 0, out: "SHOP-A-1 Handbook\nSHOP-A-2 Release steps", err: "" });
	assert.deepEqual((await run(undefined, "article", "get", "SHOP-A-2")).out, "SHOP-A-2: Release steps\nreporter: Jane Doe (jane); created 2026-10-01; updated 2026-10-01\nparent: SHOP-A-1\n\nTag, then deploy.");
});

test("an id outside the project's YouTrack project, or of another form, is refused before any call", async (t) => {
	const { url, seen } = await server(t);
	const run = await load(t, envFor(url));
	assert.equal(await refusal(run(undefined, "issue", "get", "SITE-1")), "SITE-1 is outside YouTrack project SHOP, the tracker of project web-shop; nothing was asked of YouTrack");
	assert.equal(await refusal(run("site", "article", "get", "SHOP-A-2")), "SHOP-A-2 is outside YouTrack project SITE, the tracker of project site; nothing was asked of YouTrack");
	assert.equal(await refusal(run(undefined, "issue", "get", "2-42")), "2-42 is not an issue id such as SHOP-12");
	assert.equal(await refusal(run(undefined, "issue", "get", "SHOP-1/../../admin")), "SHOP-1/../../admin is not an issue id such as SHOP-12");
	assert.equal(await refusal(run(undefined, "article", "get", "SHOP-2")), "SHOP-2 is not an article id such as SHOP-A-3");
	assert.equal(await refusal(run("blog", "issue", "list")), "project blog has no youtrack tracker; projects with one: web-shop, site");
	assert.deepEqual(seen, []);
	assert.equal((await run(undefined, "issue", "get", "shop-1")).code, 0, "the project's prefix in any case");
});

test("a 401, a 404, another status, an answer that is not JSON, a timeout and no server each give one line without the token or the URL", async (t) => {
	const { url } = await server(t);
	// acme's server refuses the unnamed one's token, and its reason echoes it.
	const wrong = await load(t, { ...envFor(url), ARTHUR_YOUTRACK_ACME_TOKEN: TOKEN });
	assert.equal(await refusal(wrong("site", "issue", "list")), "instance acme: 401: the token in ARTHUR_YOUTRACK_ACME_TOKEN was refused: You are not logged in: Bearer [token]");
	const run = await load(t, envFor(url));
	assert.equal(await refusal(run(undefined, "issue", "get", "SHOP-99")), "instance (unnamed): 404: issue SHOP-99 not found");
	assert.equal(await refusal(run("site", "issue", "get", "SITE-9")), "instance acme: 404: issue SITE-9 not found");
	assert.equal(await refusal(run(undefined, "issue", "get", "SHOP-500")), "instance (unnamed): 500 for issue SHOP-500: Something went wrong at [url]");
	const broken = await load(t, { ...envFor(url), ARTHUR_YOUTRACK_ACME_URL: `${url}/broken` });
	assert.equal(await refusal(broken("site", "issue", "list")), "instance acme: the answer for project SITE is not JSON");
	const slow = await load(t, { ...envFor(url), ARTHUR_YOUTRACK_ACME_URL: `${url}/slow` }, { options: { instances: INSTANCES, timeoutSeconds: 0.3 } });
	assert.equal(await refusal(slow("site", "issue", "list")), "instance acme: no answer in 0.3 s from the server in ARTHUR_YOUTRACK_ACME_URL");
	const closed = createServer();
	closed.listen(0, "127.0.0.1");
	await once(closed, "listening");
	const gone = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
	closed.close();
	await once(closed, "close");
	const away = await load(t, envFor(gone));
	const unreachable = await refusal(away(undefined, "issue", "list"));
	assert.equal(unreachable, "instance (unnamed): cannot reach the server in ARTHUR_YOUTRACK_URL (ECONNREFUSED)");
});

test("wrong usage prints the usage line and exits 2", async (t) => {
	const { url, seen } = await server(t);
	const run = await load(t, envFor(url));
	for (const args of [[], ["issue"], ["issue", "get"], ["issue", "list", "SHOP-1"], ["issue", "get", "SHOP-1", "more"], ["comment", "list"], ["issue", "delete", "SHOP-1"]]) {
		const { code, err } = await run(undefined, ...args);
		assert.deepEqual([code, err.startsWith("usage: arthur youtrack issue list|get <id>")], [2, true], args.join(" "));
	}
	assert.deepEqual(seen, []);
});

test("refused at load, naming the project: an instance youtrack does not have, no unnamed one to fall back on, a project id of another form", async (t) => {
	const env = envFor("https://youtrack.example");
	const loadWith = (projects: readonly unknown[], options?: YoutrackOptions) => load(t, env, { projects, ...(options === undefined ? {} : { options }) });
	assert.equal(
		await refusal(loadWith([{ name: "web-shop", tracker: { plugin: "youtrack", instance: "main", project: "SHOP" } }])),
		"project web-shop: tracker.instance main is not an instance of youtrack; youtrack's instances: (unnamed), acme",
	);
	assert.equal(
		await refusal(loadWith([{ name: "web-shop", tracker: { plugin: "youtrack", project: "SHOP" } }], { instances: INSTANCES.slice(1) })),
		"project web-shop: its tracker names no instance and youtrack has no unnamed one; youtrack's instances: acme",
	);
	assert.equal(
		await refusal(loadWith([{ name: "web-shop", tracker: { plugin: "youtrack", project: "SHOP/../x" } }])),
		'project web-shop: tracker.project "SHOP/../x" is not a YouTrack project id: a letter, then letters, digits and underscores',
	);
	await loadWith([{ name: "blog", tracker: { plugin: "jira", instance: "nope", project: "a b" } }]);
});

test("refused at load, naming the option and the variable but never its value: a URL that is not one, a token a header cannot carry", async (t) => {
	const env = envFor("https://youtrack.example");
	for (const url of ["", "youtrack.example", "ftp://youtrack.example", "https://me:pass@youtrack.example", "https://youtrack.example/?a=1", "https://youtrack.example/#top"]) {
		const message = await refusal(load(t, { ...env, ARTHUR_YOUTRACK_ACME_URL: url }));
		assert.equal(message, "instances[1].urlEnv: ARTHUR_YOUTRACK_ACME_URL does not hold an http or https URL without a user, query or fragment");
	}
	for (const token of ["", `${TOKEN} `, `${TOKEN}\n`, `${TOKEN}é`]) {
		const message = await refusal(load(t, { ...env, ARTHUR_YOUTRACK_TOKEN: token }));
		assert.equal(message, "instances[0].tokenEnv: ARTHUR_YOUTRACK_TOKEN is empty or holds a space or a character outside ASCII, which a header cannot carry");
	}
	assert.equal(
		await refusal(load(t, { ARTHUR_YOUTRACK_TOKEN: TOKEN, ARTHUR_YOUTRACK_ACME_URL: "https://acme.example", ARTHUR_YOUTRACK_ACME_TOKEN: ACME_TOKEN })),
		"instances[0].urlEnv: ARTHUR_YOUTRACK_URL does not hold an http or https URL without a user, query or fragment",
		"a variable not set",
	);
});

test("the options are checked before setup, each problem at its path", () => {
	const at = (options: Readonly<Record<string, unknown>>) => checkOptions(options).map(({ path, problem }) => `${path}: ${problem}`);
	assert.deepEqual(at({ instances: INSTANCES }), []);
	assert.deepEqual(at({ instances: INSTANCES, timeoutSeconds: 300 }), []);
	assert.deepEqual(at({}), ["instances: expected a list of at least one instance, got nothing"]);
	assert.deepEqual(at({ instances: [], nope: 1 }), ["nope: unknown option; options: instances, timeoutSeconds", "instances: expected a list of at least one instance, got an empty list"]);
	for (const seconds of [0, -1, 301, "5"]) assert.match(at({ instances: INSTANCES, timeoutSeconds: seconds })[0] ?? "", /^timeoutSeconds: expected a number of seconds above 0, at most 300, got /);
	assert.deepEqual(
		at({
			instances: [
				INSTANCES[0],
				"x",
				{ name: "Acme", urlEnv: "", tokenEnv: "T", extra: 1 },
				{ name: "acme", urlEnv: "U" },
				{ name: "acme", urlEnv: "U", tokenEnv: "T" },
				{ urlEnv: "U", tokenEnv: "T" },
			],
		}),
		[
			'instances[1]: expected an instance { name?, urlEnv, tokenEnv }, got "x"',
			"instances[2].extra: unknown key; keys: name, urlEnv, tokenEnv",
			'instances[2].name: expected lowercase letters, digits and single dashes, from a letter, got "Acme"',
			'instances[2].urlEnv: expected the name of an env variable, got ""',
			"instances[3].tokenEnv: expected the name of an env variable, got nothing",
			"instances[4].name: acme is the name of instances[3] too",
			"instances[5]: instances[0] has no name either; at most one instance is unnamed",
		],
	);
});
