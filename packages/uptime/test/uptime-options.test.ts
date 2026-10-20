import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions } from "../src/uptime-options.ts";

// The uptime plugin's option check, before any setup: every refusal names its path.

test("the sites of each project pass: a url alone, a status, a text, everySeconds; no sites at all too", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(
		checkOptions({
			sites: {
				acme: [{ url: "https://acme.example/" }, { url: "https://acme.example/admin", expect: 401, everySeconds: 1 }, { url: "http://acme.example:8080/health", expect: "ok" }],
				beta: [],
			},
		}),
		[],
	);
});

test("refused: an unknown option, sites not an object, a project's sites not a list, a site not an object", () => {
	assert.deepEqual(checkOptions({ urls: [] }), [{ path: "urls", problem: "unknown option; options: sites" }]);
	assert.deepEqual(checkOptions({ sites: [] }), [{ path: "sites", problem: "expected an object of each project's list of sites, by the project's name, got a list" }]);
	assert.deepEqual(checkOptions({ sites: { acme: { url: "https://acme.example/" } } }), [{ path: "sites.acme", problem: "project acme: expected a list of sites, got an object" }]);
	assert.deepEqual(checkOptions({ sites: { acme: ["https://acme.example/"] } }), [
		{ path: "sites.acme[0]", problem: 'project acme: expected a site { url, expect?, everySeconds? }, got "https://acme.example/"' },
	]);
});

test("refused: a site without a url, a url that is not http or https, an unknown key, an expect or everySeconds out of range", () => {
	const problems = (site: object) => checkOptions({ sites: { acme: [site] } });
	assert.deepEqual(problems({ expect: 200 }), [{ path: "sites.acme[0].url", problem: "project acme: url is required" }]);
	for (const url of ["acme.example", "ftp://acme.example/", ""])
		assert.deepEqual(problems({ url }), [{ path: "sites.acme[0].url", problem: `project acme: expected an http or https URL, got ${JSON.stringify(url)}` }], url);
	assert.deepEqual(problems({ url: "https://a.example/", timeout: 5 }), [{ path: "sites.acme[0].timeout", problem: "project acme: unknown key; keys: url, expect, everySeconds" }]);
	for (const expect of [99, 600, 200.5, "", " ", true])
		assert.equal(problems({ url: "https://a.example/", expect })[0]?.problem.startsWith("project acme: expected a status code from 100 to 599, or non-empty text, got "), true, String(expect));
	for (const expect of [100, 599]) assert.deepEqual(problems({ url: "https://a.example/", expect }), [], `${expect}, at the limit`);
	for (const everySeconds of [0, -1, 1.5, "60"])
		assert.deepEqual(problems({ url: "https://a.example/", everySeconds }), [{ path: "sites.acme[0].everySeconds", problem: `project acme: expected a whole number of seconds, 1 or more, got ${typeof everySeconds === "string" ? `"${everySeconds}"` : everySeconds}` }]);
});

test("refused: the same url twice in one project; in two projects it is two sites", () => {
	const site = { url: "https://acme.example/" };
	assert.deepEqual(checkOptions({ sites: { acme: [site, { ...site, expect: 200 }] } }), [{ path: "sites.acme[1].url", problem: "project acme: https://acme.example/ is listed twice, at sites.acme[0] and sites.acme[1]" }]);
	assert.deepEqual(checkOptions({ sites: { acme: [site], beta: [site] } }), []);
});

test("refused: a url on a port fetch blocks, naming the port; fetch indeed never reaches each refused port", async () => {
	const refused = (url: string) => checkOptions({ sites: { acme: [{ url }] } });
	assert.deepEqual(refused("http://127.0.0.1:9/"), [
		{ path: "sites.acme[0].url", problem: "project acme: http://127.0.0.1:9/ is on port 9, which fetch never reaches: the Fetch standard blocks it; use another port" },
	]);
	for (const port of [1, 25, 6000, 6665, 6669, 10080]) assert.equal(refused(`https://acme.example:${port}/`).length, 1, String(port));
	for (const url of ["http://acme.example/", "https://acme.example:443/", "http://acme.example:80/", "http://acme.example:8/", "http://acme.example:10/", "http://acme.example:6664/", "http://acme.example:6670/", "http://acme.example:10081/", "http://acme.example:65535/"])
		assert.deepEqual(refused(url), [], url);
	const ports = Array.from({ length: 65535 }, (_, index) => index + 1).filter((port) => refused(`http://127.0.0.1:${port}/`).length > 0);
	for (const port of ports) await assert.rejects(fetch(`http://127.0.0.1:${port}/`), (error: Error) => (error.cause as Error).message === "bad port", String(port));
});
