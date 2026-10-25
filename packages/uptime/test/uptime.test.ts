import assert from "node:assert/strict";
import dns, { type LookupAddress, type LookupOptions } from "node:dns";
import dnsPromises from "node:dns/promises";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { type FakeHost, fakeHost } from "@arthur/core/testing";
import { readState } from "../src/uptime-state.ts";
import { type UptimeOptions, uptime } from "../src/uptime.ts";

// The uptime plugin against the fake host and a local HTTP server on a port the OS picks, each path answering as the test
// sets it. Sites are checked every second here, so a check is cut after 1 s.

const START = new Date("2026-01-01T00:00:00Z");
const SINCE = "00:00 on thu 2026-01-01 (UTC)";
type Answer = (response: ServerResponse) => void;
const ok: Answer = (response) => void response.end("Welcome to Acme");
const broken: Answer = (response) => void response.writeHead(500).end("oops");
const hang: Answer = () => {};

async function until<T>(what: string, predicate: () => T | undefined | false): Promise<T> {
	for (const end = Date.now() + 20_000; Date.now() < end; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
	}
	throw new Error(`timed out waiting for ${what}`);
}

// A server whose path `p` answers with `answers[p]` (404 when unset); `seen(p)` counts the requests to it; `close` stops it.
async function server(t: TestContext) {
	const [answers, seen]: [Record<string, Answer>, string[]] = [{}, []];
	const http = createServer((request, response) => {
		seen.push(request.url ?? "");
		(answers[request.url ?? ""] ?? ((reply) => void reply.writeHead(404).end()))(response);
	});
	await once(http.listen(0, "127.0.0.1"), "listening");
	const close = () => {
		http.closeAllConnections();
		http.close();
	};
	t.after(close);
	const { port } = http.address() as AddressInfo;
	return { answers, port, close, url: (path: string) => `http://127.0.0.1:${port}${path}`, seen: (path: string) => seen.filter((each) => each === path).length };
}

// `name` resolved to `answer()` in this process, by dns.lookup and by its promise both: the exports the check and a socket read.
function resolving(t: TestContext, name: string, answer: () => LookupAddress[]): void {
	const [real, promised] = [dns.lookup, dnsPromises.lookup];
	dns.lookup = ((host: string, options: LookupOptions, done: (error: null, address: string | LookupAddress[], family?: number) => void) => {
		if (host !== name) return real(host, options, done as never);
		const all = answer();
		return options.all ? done(null, all) : done(null, all[0]?.address ?? "", all[0]?.family);
	}) as typeof real;
	dnsPromises.lookup = (async (host: string, options: LookupOptions) => (host !== name ? promised(host, options) : options.all ? answer() : answer()[0])) as typeof promised;
	syncBuiltinESMExports();
	t.after(() => void ((dns.lookup = real), (dnsPromises.lookup = promised), syncBuiltinESMExports()));
}

// A fake host for `sites`, now at START unless given, where projects acme and beta are the project list.
function host(sites: UptimeOptions["sites"], more: { readonly now?: Date; readonly quietHours?: { from: string; to: string } } = {}): FakeHost {
	const fake = fakeHost({ name: "uptime", options: { sites }, now: START, ...more });
	fake.provide("projects", () => [{ name: "acme" }, { name: "beta" }]);
	return fake;
}

// The plugin set up on `fake` and started; stopped at the end. Its checks run on real timers against a real server: the
// timeout cut by `fetch` and the server's own time are what is tested.
async function started(t: TestContext, sites: UptimeOptions["sites"], fake: FakeHost = host(sites)) {
	const plugin = uptime({ sites });
	await fake.setup(plugin);
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	const notices = () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text);
	const events = (name: string) => fake.emitted.filter((event) => event.name === name).map((event) => event.data);
	return { fake, plugin, notices, events };
}

test("a site is down after 2 failed checks: one notice and uptime-down; once it answers, one notice with how long and uptime-up", async (t) => {
	const site = await server(t);
	site.answers["/"] = broken;
	const url = site.url("/");
	const { fake, notices, events } = await started(t, { acme: [{ url, everySeconds: 1 }] });
	await until("the down notice", () => notices().length === 1);
	assert.deepEqual(notices(), [`uptime: ${url} (project acme) is down since ${SINCE}: answered 500, expected a 2xx status`]);
	assert.deepEqual(events("uptime-down"), [{ project: "acme", url, reason: "answered 500, expected a 2xx status", since: START.toISOString() }]);
	const failing = site.seen("/");
	await until("two more failed checks", () => site.seen("/") >= failing + 2);
	assert.equal(notices().length, 1, "no notice repeats while the site stays down");
	fake.setNow(new Date("2026-01-01T00:12:30Z"));
	site.answers["/"] = ok;
	await until("the up notice", () => notices().length === 2);
	assert.equal(notices()[1], `uptime: ${url} (project acme) answers again, after 12 min down since ${SINCE}`);
	assert.deepEqual(events("uptime-up"), [{ project: "acme", url, since: START.toISOString(), downSeconds: 750 }]);
	const answering = site.seen("/");
	await until("two more checks", () => site.seen("/") >= answering + 2);
	assert.deepEqual([notices().length, events("uptime-down").length, events("uptime-up").length], [2, 1, 1], "nothing repeats while it answers");
});

test("a 500 that answers 200 at the second check is no notice", async (t) => {
	const site = await server(t);
	site.answers["/"] = (response) => {
		site.answers["/"] = ok;
		broken(response);
	};
	const { notices, events } = await started(t, { acme: [{ url: site.url("/"), everySeconds: 1 }] });
	await until("three checks", () => site.seen("/") >= 3);
	assert.deepEqual([notices(), events("uptime-down")], [[], []]);
});

test("a slow answer past the timeout fails the check", async (t) => {
	const site = await server(t);
	site.answers["/"] = (response) => void setTimeout(() => response.destroyed || response.end("late"), 1500);
	const url = site.url("/");
	const { notices } = await started(t, { acme: [{ url, everySeconds: 1 }] });
	await until("the down notice", () => notices().length === 1);
	assert.deepEqual(notices(), [`uptime: ${url} (project acme) is down since ${SINCE}: no answer within 1 s`]);
});

test("a redirect is followed, and the page it leads to is judged", async (t) => {
	const site = await server(t);
	const to = (path: string): Answer => (response) => void response.writeHead(302, { location: path }).end();
	Object.assign(site.answers, { "/": to("/home"), "/home": ok, "/old": to("/gone"), "/gone": broken });
	const [home, old] = [site.url("/"), site.url("/old")];
	const { notices } = await started(t, { acme: [{ url: home, expect: "Welcome", everySeconds: 1 }, { url: old, everySeconds: 1 }] });
	await until("the down notice", () => notices().length === 1);
	await until("two checks of the page / leads to", () => site.seen("/home") >= 2);
	assert.deepEqual(notices(), [`uptime: ${old} (project acme) is down since ${SINCE}: answered 500, expected a 2xx status`]);
});

test("a redirect to another host is followed only when no address of it is loopback, link-local or private, at each of at most 20 hops", async (t) => {
	const [site, inside] = [await server(t), await server(t)];
	const own = (path: string) => `http://localhost:${site.port}${path}`;
	const to = (location: string): Answer => (response) => void response.writeHead(302, { location }).end();
	inside.answers["/"] = ok;
	// /r0 to /r21 is 21 redirects, one too many; /r1 to /r21, 20. 192.0.2.1 is public to the check (TEST-NET-1), so it is
	// followed; nothing answers there, which fails the check another way. A label of 64 letters is no host name the resolver takes.
	const targets = { "/away": inside.url("/"), "/meta": "http://169.254.169.254/latest/meta-data/", "/mapped": `http://[::ffff:127.0.0.1]:${inside.port}/`, "/self": own("/home"), "/nowhere": `http://${"a".repeat(64)}.example/`, "/public": "http://192.0.2.1:8080/" };
	const chain = Array.from({ length: 21 }, (_, hop) => [`/r${hop}`, `/r${hop + 1}`]);
	Object.assign(site.answers, { "/": to("/away"), "/home": ok, "/r21": ok }, Object.fromEntries([...Object.entries(targets), ...chain].map(([path, location]) => [path, to(location as string)])));
	const sites = ["/", "/meta", "/mapped", "/self", "/r0", "/r1", "/nowhere", "/public"].map((path) => ({ url: own(path), expect: "Welcome", everySeconds: 1 }));
	const { notices } = await started(t, { acme: sites });
	await until("six down notices", () => notices().length === 6);
	const reason = (path: string) => notices().find((text) => text.startsWith(`uptime: ${own(path)} `))?.replace(/^.*\(UTC\): /, "");
	const refused = (host: string) => `redirected to ${host}, a private address the config does not name`;
	const reasons = ["/", "/meta", "/mapped", "/self", "/r0", "/r1", "/nowhere"].map(reason);
	assert.deepEqual(reasons, [refused(`127.0.0.1:${inside.port}`), refused("169.254.169.254"), refused(`[::ffff:7f00:1]:${inside.port}`), undefined, "answered 302, expected a 2xx status", undefined, "its host name is not found"]);
	assert.match(reason("/public") ?? "", /^(?!redirected to)./);
	assert.deepEqual([inside.seen("/"), site.seen("/away") >= 2, site.seen("/home") >= 2, site.seen("/r21") >= 2], [0, true, true, true]);
});

test("a refused redirect is an answer: two sites refused at once are each down, not this machine offline", async (t) => {
	const [site, inside] = [await server(t), await server(t)];
	site.answers["/a"] = (response) => void response.writeHead(307, { location: inside.url("/") }).end();
	site.answers["/b"] = (response) => void response.writeHead(301, { location: "http://169.254.169.254/" }).end();
	const [a, b] = [`http://localhost:${site.port}/a`, `http://localhost:${site.port}/b`];
	const { events } = await started(t, { acme: [{ url: a, everySeconds: 1 }], beta: [{ url: b, everySeconds: 1 }] });
	await until("two sites down", () => events("uptime-down").length === 2);
	const [refused, since] = [", a private address the config does not name", START.toISOString()];
	assert.deepEqual(events("uptime-down"), [{ project: "acme", url: a, reason: `redirected to 127.0.0.1:${inside.port}${refused}`, since }, { project: "beta", url: b, reason: `redirected to 169.254.169.254${refused}`, since }]);
});

test("a redirect to each refused range is refused before a connection, also a name with one private address among public ones; a 3xx without Location is judged", async (t) => {
	const [site, inside] = [await server(t), await server(t)];
	// mixed.example resolves to a public and a private address.
	resolving(t, "mixed.example", () => [{ address: "203.0.113.7", family: 4 }, { address: "10.1.2.3", family: 4 }]);
	// One address in each range: unspecified, IPv6 loopback, RFC 1918, Tailscale's (its metadata address), link-local, unique local.
	const hosts = ["0.0.0.0", "[::1]", "10.0.0.1", "172.31.255.254", "192.168.0.1", "100.100.100.200", "[fe80::1]", "[fd00:ec2::254]", "mixed.example"].map((host) => `${host}:${inside.port}`);
	hosts.forEach((host, index) => void (site.answers[`/${index}`] = (response) => void response.writeHead(302, { location: `http://${host}/` }).end()));
	site.answers["/bare"] = (response) => void response.writeHead(302).end();
	const paths = [...hosts.map((_, index) => `/${index}`), "/bare"];
	const { events } = await started(t, { acme: paths.map((path) => ({ url: `http://localhost:${site.port}${path}`, everySeconds: 1 })) });
	await until("every site down", () => events("uptime-down").length === paths.length);
	const reasons = [...hosts.map((host) => `redirected to ${host}, a private address the config does not name`), "answered 302, expected a 2xx status"];
	assert.deepEqual(events("uptime-down"), paths.map((path, index) => ({ project: "acme", url: `http://localhost:${site.port}${path}`, reason: reasons[index], since: START.toISOString() })));
	assert.deepEqual([inside.seen("/"), site.seen("/null")], [0, 0]);
});

test("a redirect to a name that answers a public address, then loopback, never reaches it: the connection's own lookup is checked too", async (t) => {
	const [site, inside] = [await server(t), await server(t)];
	inside.answers["/"] = ok;
	// Each check resolves the name twice, for the Location's check and for the connection: public at the first, loopback at the second.
	let asked = 0;
	resolving(t, "rebind.example", () => [{ address: asked++ % 2 === 0 ? "203.0.113.9" : "127.0.0.1", family: 4 }]);
	site.answers["/"] = (response) => void response.writeHead(302, { location: `http://rebind.example:${inside.port}/` }).end();
	const url = `http://localhost:${site.port}/`;
	const { events } = await started(t, { acme: [{ url, everySeconds: 1 }] });
	await until("the site down", () => events("uptime-down").length === 1);
	assert.deepEqual(events("uptime-down"), [{ project: "acme", url, reason: `redirected to rebind.example:${inside.port}, a private address the config does not name`, since: START.toISOString() }]);
	assert.deepEqual([inside.seen("/"), asked >= 4], [0, true]);
});

test("each failure has its reason: a wrong status, the text missing, connection refused, a TLS error", async (t) => {
	const site = await server(t);
	Object.assign(site.answers, { "/": ok, "/?text": ok });
	// A port nothing listens on: the OS picks it for a server closed at once.
	const closed = createServer();
	await once(closed.listen(0, "127.0.0.1"), "listening");
	const { port } = closed.address() as AddressInfo;
	closed.close();
	const sites = [
		{ url: site.url("/"), expect: 401, everySeconds: 1 },
		{ url: site.url("/?text"), expect: "Goodbye", everySeconds: 1 },
		{ url: `http://127.0.0.1:${port}/`, everySeconds: 1 },
		{ url: `https://127.0.0.1:${site.port}/`, everySeconds: 1 },
	];
	const { notices } = await started(t, { beta: sites });
	await until("four down notices", () => notices().length === 4);
	const reasons = notices().map((text, index) => text.replace(`uptime: ${sites[index]?.url} (project beta) is down since ${SINCE}: `, ""));
	assert.deepEqual(reasons.slice(0, 3), ["answered 200, expected 401", 'answered 200 without the text "Goodbye"', "connection refused"]);
	assert.match(reasons[3] ?? "", /^TLS error \(ERR_SSL_[A-Z_]+\)$/);
});

test("this machine offline: no site answers, one notice that the checks cannot run, none per site, none again after a restart", async (t) => {
	// Both answer once, then a never answers and b's server is gone. b is due only every minute: it is asked again as a goes
	// down, so both fail at once.
	const [site, other] = [await server(t), await server(t)];
	Object.assign(site.answers, { "/a": ok });
	Object.assign(other.answers, { "/b": ok });
	const [a, b] = [site.url("/a"), other.url("/b")];
	const sites = { acme: [{ url: a, everySeconds: 1 }], beta: [{ url: b }] };
	const { fake, plugin, notices, events } = await started(t, sites);
	await until("the first checks", () => site.seen("/a") === 1 && other.seen("/b") === 1);
	site.answers["/a"] = hang;
	other.close();
	await until("the offline notice", () => notices().length === 1);
	assert.deepEqual(notices(), [`uptime: none of the 2 sites answers (${a}: no answer within 1 s), so this machine looks offline and the checks cannot run; one notice follows when a site answers again`]);
	await plugin.stop?.();
	const restarted = await started(t, sites, fake);
	const checks = site.seen("/a");
	await until("three more checks", () => site.seen("/a") >= checks + 3);
	assert.equal(restarted.notices().length, 1, "no second offline notice, after a restart too");
	fake.setNow(new Date("2026-01-01T00:05:00Z"));
	site.answers["/a"] = ok;
	await until("the notice that the checks run again", () => notices().length === 2);
	assert.equal(notices()[1], "uptime: a site answers again, so the checks run again, after 5 min without an answer from any site");
	assert.deepEqual([events("uptime-down"), events("uptime-up")], [[], []]);
});

test("one site with no answer while another answers is down, not offline", async (t) => {
	const site = await server(t);
	Object.assign(site.answers, { "/a": hang, "/b": ok });
	const a = site.url("/a");
	const { notices } = await started(t, { acme: [{ url: a, everySeconds: 1 }, { url: site.url("/b"), everySeconds: 1 }] });
	await until("the down notice", () => notices().length === 1);
	assert.deepEqual(notices(), [`uptime: ${a} (project acme) is down since ${SINCE}: no answer within 1 s`]);
});

test("in quiet hours the notice goes out as every notice does, for the channel to send it without a sound", async (t) => {
	const site = await server(t);
	site.answers["/"] = broken;
	const url = site.url("/");
	const sites = { acme: [{ url, everySeconds: 1 }] };
	const fake = host(sites, { now: new Date("2026-01-01T23:00:00Z"), quietHours: { from: "22:00", to: "07:30" } });
	assert.equal(fake.host.clock.isQuiet(), true);
	const { notices } = await started(t, sites, fake);
	await until("the down notice", () => notices().length === 1);
	assert.deepEqual(notices(), [`uptime: ${url} (project acme) is down since 23:00 on thu 2026-01-01 (UTC): answered 500, expected a 2xx status`]);
});

test("a restart while a site is down sends no second down notice; the up notice counts from before the restart", async (t) => {
	const site = await server(t);
	site.answers["/"] = broken;
	const url = site.url("/");
	const sites = { acme: [{ url, everySeconds: 1 }] };
	const { fake, plugin, notices } = await started(t, sites);
	await until("the down notice", () => notices().length === 1);
	await plugin.stop?.();
	await started(t, sites, fake);
	const checks = site.seen("/");
	await until("three checks after the restart", () => site.seen("/") >= checks + 3);
	assert.equal(notices().length, 1);
	fake.setNow(new Date("2026-01-01T01:05:00Z"));
	site.answers["/"] = ok;
	await until("the up notice", () => notices().length === 2);
	assert.equal(notices()[1], `uptime: ${url} (project acme) answers again, after 1 h 5 min down since ${SINCE}`);
});

test("a state file broken or edited by hand is taken as no site down; an entry that is not one is dropped", () => {
	const fake = fakeHost({ name: "uptime" });
	const file = join(fake.host.folder, "state.json");
	assert.deepEqual(readState(fake.host.folder), { down: {} }, "no file");
	writeFileSync(file, "{ not json");
	assert.deepEqual(readState(fake.host.folder), { down: {} });
	writeFileSync(file, JSON.stringify({ down: { "acme http://a/": { since: "yesterday", reason: "x" }, "acme http://b/": { since: START.toISOString(), reason: "refused" } }, offline: 5 }));
	assert.deepEqual(readState(fake.host.folder), { down: { "acme http://b/": { since: START.toISOString(), reason: "refused" } } });
});

test("a key of sites that is not a project refuses the load", async () => {
	const sites = { acme: [], acmee: [{ url: "https://acme.example/" }] };
	const fake = fakeHost({ name: "uptime", options: { sites } });
	fake.provide("projects", () => [{ name: "acme" }]);
	await assert.rejects(fake.setup(uptime({ sites })), {
		message: "sites names acmee, not a project of the projects list; each key of sites is a project's name",
	});
});
