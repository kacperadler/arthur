import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions, checkPiece, checkSites, PROBES, table } from "../src/uptime-options.ts";

// The uptime plugin's option check, and its check of a project's piece, its sites: every refusal names its place.

test("a project's sites pass: a url alone, a status, a text, everySeconds", () => {
	assert.equal(checkSites([{ url: "https://acme.example/" }, { url: "https://acme.example/admin", expect: 401, everySeconds: 1 }, { url: "http://acme.example:8080/health", expect: "ok" }]), undefined);
});

test("refused: any option but probes, the old sites among them; sites that are no list or an empty one, a site not an object", () => {
	assert.deepEqual(checkOptions({}), []);
	assert.deepEqual(checkOptions({ sites: { acme: [] }, probes: [] }), [{ path: "sites", problem: "unknown option; options: probes" }]);
	assert.equal(checkSites({ url: "https://acme.example/" }), "expected a list of at least one site { url, expect?, everySeconds? }, got an object");
	assert.equal(checkSites([]), "expected a list of at least one site { url, expect?, everySeconds? }, got a list");
	assert.equal(checkSites(["https://acme.example/"]), '[0]: expected a site { url, expect?, everySeconds? }, got "https://acme.example/"');
});

test("probes pass: the default ones, none, a public address or name; refused at load: no list, a URL not https, a loopback, link-local or private host", () => {
	assert.deepEqual(PROBES, ["https://1.1.1.1/", "https://dns.google/"]);
	// Just past each refused range, at both ends where there is one: public.
	const outside = ["1.0.0.0", "126.255.255.255", "128.0.0.0", "169.253.255.255", "169.255.0.0", "9.255.255.255", "11.0.0.0", "172.15.255.255", "172.32.0.0", "192.167.255.255", "192.169.0.0", "100.63.255.255", "100.128.0.0", "[::2]", "[fe7f::1]", "[fec0::1]", "[fbff::1]", "[fe00::1]"];
	for (const probes of [PROBES, [], ["https://203.0.113.5/", "https://[2001:db8::1]/", "https://example.com:8443/up", "https://localhost.example/", "https://dns.google./"], outside.map((host) => `https://${host}/`)])
		assert.deepEqual(checkOptions({ probes }), [], String(probes));
	assert.deepEqual(checkOptions({ probes: "https://1.1.1.1/" }), [{ path: "probes", problem: 'expected a list of https URLs, [] for none, got "https://1.1.1.1/"' }]);
	// Each refused range at its first and last address, and localhost however it is spelled.
	const hosts = ["0.0.0.0", "0.255.255.255", "127.0.0.1", "127.255.255.254", "127.1", "169.254.0.0", "169.254.255.255", "10.0.0.0", "10.255.255.255", "172.16.0.0", "172.31.255.255", "192.168.0.0", "192.168.255.255", "100.64.0.0", "100.127.255.255", "[::]", "[::1]", "[fe80::]", "[febf:ffff::1]", "[fc00::]", "[fdff:ffff::1]", "[::ffff:127.0.0.1]", "localhost", "LOCALHOST", "localhost.", "localhost..", "api.localhost.", "127.0.0.1."];
	const problem = (probe: unknown, at = 1) => ({ path: `probes[${at}]`, problem: `expected an https URL of a public host, not a loopback, link-local or private address, got ${JSON.stringify(probe)}` });
	for (const host of hosts) assert.deepEqual(checkOptions({ probes: ["https://1.1.1.1/", `https://${host}/`] }), [problem(`https://${host}/`)], host);
	for (const probe of ["http://1.1.1.1/", "1.1.1.1", ""]) assert.deepEqual(checkOptions({ probes: ["https://1.1.1.1/", probe] }), [problem(probe)], probe);
	assert.deepEqual(checkOptions({ probes: [5, "https://dns.google/", "https://10.0.0.1/"] }), [problem(5, 0), problem("https://10.0.0.1/", 2)], "each refused probe, by its place");
	const check = table.probes !== undefined && "check" in table.probes ? table.probes.check : () => "no check";
	assert.deepEqual([check(PROBES), check([]), check(["https://127.0.0.1/"]), check("https://1.1.1.1/")], [undefined, undefined, "a list of https URLs of public hosts, [] for none", "a list of https URLs of public hosts, [] for none"]);
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

test("a project's piece passes as sites alone or with a runbook inside its folder; refused: a runbook outside it, empty or no string, an unknown key, no { sites }", () => {
	const sites = [{ url: "https://acme.example/" }];
	for (const runbook of [undefined, "site-down.md", "ops/site-down.md", "ops/../site-down.md", "..site-down.md"]) assert.equal(checkPiece({ sites, runbook }), undefined, String(runbook));
	for (const runbook of ["/etc/site-down.md", "../site-down.md", "ops/../../site-down.md", "..", "", 5])
		assert.equal(checkPiece({ sites, runbook }), `runbook: expected a path inside the project's folder, such as "site-down.md", got ${JSON.stringify(runbook)}`, String(runbook));
	assert.equal(checkPiece({ sites, runbok: "x.md" }), "runbok: unknown key; keys: sites, runbook");
	for (const piece of [sites, "https://acme.example/", null, 5]) assert.match(checkPiece(piece) ?? "", /^expected \{ sites, runbook\? \}, as uptime\.project\(\[\.\.\.sites\], \{ runbook\? \}\) builds it, got /, JSON.stringify(piece));
	assert.equal(checkPiece({ sites: [{ url: "ftp://a.example/" }], runbook: "" }), '[0].url: expected an http or https URL, got "ftp://a.example/"; runbook: expected a path inside the project\'s folder, such as "site-down.md", got ""', "each problem, sites first");
	assert.equal(checkPiece({ runbook: "site-down.md" }), "expected a list of at least one site { url, expect?, everySeconds? }, got nothing");
});
