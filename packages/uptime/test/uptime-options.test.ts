import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions, checkSites } from "../src/uptime-options.ts";

// The uptime plugin's option check, and its check of a project's piece, its sites: every refusal names its place.

test("a project's sites pass: a url alone, a status, a text, everySeconds", () => {
	assert.equal(checkSites([{ url: "https://acme.example/" }, { url: "https://acme.example/admin", expect: 401, everySeconds: 1 }, { url: "http://acme.example:8080/health", expect: "ok" }]), undefined);
});

test("refused: any option but enabled, the old sites among them; sites that are no list or an empty one, a site not an object", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ sites: { acme: [] } }), [{ path: "sites", problem: "unknown option; uptime takes none: a project's sites are its uptime.project([...]) in its project file" }]);
	assert.equal(checkSites({ url: "https://acme.example/" }), "expected a list of at least one site { url, expect?, everySeconds? }, got an object");
	assert.equal(checkSites([]), "expected a list of at least one site { url, expect?, everySeconds? }, got a list");
	assert.equal(checkSites(["https://acme.example/"]), '[0]: expected a site { url, expect?, everySeconds? }, got "https://acme.example/"');
});

test("refused: a site without a url, a url that is not http or https, an unknown key, an expect or everySeconds out of range", () => {
	const problem = (site: object) => checkSites([site]);
	assert.equal(problem({ expect: 200 }), "[0].url: url is required");
	for (const url of ["ftp://acme.example/", "acme.example", ""]) assert.equal(problem({ url }), `[0].url: expected an http or https URL, got ${JSON.stringify(url)}`, url);
	assert.equal(problem({ url: "https://a.example/", timeout: 5 }), "[0].timeout: unknown key; keys: url, expect, everySeconds");
	for (const expect of [99, 600, 2.5, "", " "]) assert.match(problem({ url: "https://a.example/", expect }) ?? "", /^\[0\]\.expect: expected a status code from 100 to 599, or non-empty text/, String(expect));
	for (const everySeconds of [0, 1.5, "60"]) assert.match(problem({ url: "https://a.example/", everySeconds }) ?? "", /^\[0\]\.everySeconds: expected a whole number of seconds, 1 or more/, String(everySeconds));
	assert.equal(problem({ url: "https://a.example/", expect: 100, everySeconds: 1 }), undefined);
	assert.equal(checkSites([{ expect: 200 }, { url: "x" }]), "[0].url: url is required; [1].url: expected an http or https URL, got \"x\"", "every problem, in one line");
});

test("refused: the same url twice in one project's sites", () => {
	const site = { url: "https://acme.example/" };
	assert.equal(checkSites([site, { ...site, expect: 200 }]), "[1].url: https://acme.example/ is listed twice, at [0] and [1]");
});

test("refused: a url on a port fetch blocks, naming the port; fetch indeed never reaches each refused port", async () => {
	const refused = (url: string) => checkSites([{ url }]);
	assert.equal(refused("http://127.0.0.1:9/"), "[0].url: http://127.0.0.1:9/ is on port 9, which fetch never reaches: the Fetch standard blocks it; use another port");
	for (const port of [1, 25, 6000, 6665, 6669, 10080]) assert.notEqual(refused(`https://acme.example:${port}/`), undefined, String(port));
	for (const url of ["http://acme.example/", "https://acme.example:443/", "http://acme.example:80/", "http://acme.example:8/", "http://acme.example:10/", "http://acme.example:6664/", "http://acme.example:6670/", "http://acme.example:10081/", "http://acme.example:65535/"])
		assert.equal(refused(url), undefined, url);
	const ports = Array.from({ length: 65535 }, (_, index) => index + 1).filter((port) => refused(`http://127.0.0.1:${port}/`) !== undefined);
	for (const port of ports) await assert.rejects(fetch(`http://127.0.0.1:${port}/`), (error: Error) => (error.cause as Error).message === "bad port", String(port));
});
