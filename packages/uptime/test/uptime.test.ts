import assert from "node:assert/strict";
import dns, { type LookupAddress, type LookupOptions } from "node:dns";
import dnsPromises from "node:dns/promises";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import net, { type AddressInfo, type LookupFunction, type TcpNetConnectOpts } from "node:net";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { type FakeHost, fakeHost, until } from "@arthur/core/testing";
import { checkSite } from "../src/site-check.ts";
import { readState } from "../src/uptime-state.ts";
import type { Site, UptimeOptions } from "../src/uptime-options.ts";
import { uptime } from "../src/uptime.ts";

// The uptime plugin against the fake host and a local HTTP server on a port the OS picks, each path answering as the test
// sets it. Sites are checked every second here, so a check is cut after 1 s.

const START = new Date("2026-01-01T00:00:00Z");
const SINCE = "00:00 on thu 2026-01-01 (UTC)";
type Answer = (response: ServerResponse) => void;
const ok: Answer = (response) => void response.end("Welcome to Acme");
const broken: Answer = (response) => void response.writeHead(500).end("oops");
const hang: Answer = () => {};

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
// An answer of undefined is a dns.lookup that never answers.
function resolving(t: TestContext, name: string, answer: () => LookupAddress[] | undefined): void {
	const [real, promised] = [dns.lookup, dnsPromises.lookup];
	dns.lookup = ((host: string, options: LookupOptions, done: (error: null, address: string | LookupAddress[], family?: number) => void) => {
		if (host !== name) return real(host, options, done as never);
		const all = answer();
		if (all === undefined) return;
		return options.all ? done(null, all) : done(null, all[0]?.address ?? "", all[0]?.family);
	}) as typeof real;
	dnsPromises.lookup = (async (host: string, options: LookupOptions) => (host !== name ? promised(host, options) : options.all ? answer() : answer()?.[0])) as typeof promised;
	syncBuiltinESMExports();
	t.after(() => void ((dns.lookup = real), (dnsPromises.lookup = promised), syncBuiltinESMExports()));
}

// `name` resolves to a public address, which net.createConnection, replaced in this process, connects to at 127.0.0.1 once the
// check's own lookup has allowed it: a hop to an outside host without one. The ports connected to by that name are returned.
function outside(t: TestContext, name: string): number[] {
	resolving(t, name, () => [{ address: "203.0.113.5", family: 4 }]);
	const [real, ports] = [net.createConnection, [] as number[]];
	const local = (address: string) => (address === "203.0.113.5" ? "127.0.0.1" : address);
	net.createConnection = ((options: TcpNetConnectOpts, listener?: () => void) => {
		if (options.host !== name) return real(options, listener);
		ports.push(Number(options.port));
		const lookup = options.lookup as LookupFunction;
		return real({ ...options, lookup: (host, each, done) => lookup(host, each, (error, address, family) => done(error, typeof address === "string" ? local(address) : address.map((one) => ({ ...one, address: local(one.address) })), family)) }, listener);
	}) as typeof real;
	t.after(() => void (net.createConnection = real));
	return ports;
}

// The probes' fake fetch, for their hosts only, the default ones and probe.example: while `network.hang`, no answer until the
// signal aborts, then its reason, as a real fetch rejects, with the time it waited in `network.cuts`; while `network.up`, the
// answer 1.1.1.1 gives, a 301 to one.one.one.one; else what a real fetch without a network rejects with, a TypeError caused by
// ENOTFOUND. `network.asked` holds each URL asked. Every test starts with the network up.
const network = { up: true, hang: false, asked: [] as string[], cuts: [] as number[] };
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
	const url = new URL(input instanceof Request ? input.url : input);
	if (!["1.1.1.1", "dns.google", "probe.example"].includes(url.hostname)) return realFetch(input, init);
	network.asked.push(url.href);
	if (network.hang) {
		const [{ promise, reject }, from, signal] = [Promise.withResolvers<Response>(), Date.now(), init?.signal];
		signal?.addEventListener("abort", () => (network.cuts.push(Date.now() - from), reject(signal.reason)));
		return promise;
	}
	if (network.up) return new Response("<html><head><title>301 Moved Permanently</title></head></html>", { status: 301, headers: { location: "https://one.one.one.one/", "content-type": "text/html" } });
	const cause = Object.assign(new Error(`getaddrinfo ENOTFOUND ${url.hostname}`), { errno: -3008, code: "ENOTFOUND", syscall: "getaddrinfo", hostname: url.hostname });
	throw new TypeError("fetch failed", { cause });
}) as typeof fetch;

// Each project's sites, its piece, by the project's name.
type Sites = Readonly<Record<string, readonly Site[]>>;

// A fake host now at START unless given, where projects acme and beta are the project list, each with its `sites` as its piece.
function host(sites: Sites, more: { readonly now?: Date; readonly quietHours?: { from: string; to: string } } = {}): FakeHost {
	const fake = fakeHost({ name: "uptime", now: START, ...more });
	fake.provide("projects", () => ["acme", "beta"].map((name) => ({ name, pieces: sites[name] === undefined ? {} : uptime.project(sites[name]) })));
	return fake;
}

// The plugin set up on `fake` with `options` and started; stopped at the end. Its checks run on real timers against a real
// server: the timeout cut by `fetch` and the server's own time are what is tested.
async function started(t: TestContext, sites: Sites, fake: FakeHost = host(sites), options: UptimeOptions = {}) {
	const plugin = uptime(options);
	await fake.setup(plugin);
	await plugin.start?.();
	t.after(() => plugin.stop?.());
	t.after(() => void Object.assign(network, { up: true, hang: false, asked: [], cuts: [] }));
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

test("a redirect of each status 301, 302, 303, 307 and 308 is followed, and the page it leads to is judged", async (t) => {
	const site = await server(t);
	const to = (status: number, path: string): Answer => (response) => void response.writeHead(status, { location: path }).end();
	const statuses = [301, 302, 303, 307, 308];
	for (const status of statuses) Object.assign(site.answers, { [`/${status}`]: to(status, `/home${status}`), [`/home${status}`]: ok });
	Object.assign(site.answers, { "/old": to(302, "/gone"), "/gone": broken });
	const old = site.url("/old");
	const { notices } = await started(t, { acme: [...statuses.map((status) => ({ url: site.url(`/${status}`), expect: "Welcome", everySeconds: 1 })), { url: old, everySeconds: 1 }] });
	await until("the down notice", () => notices().length === 1);
	await until("two checks of each page a redirect leads to", () => statuses.every((status) => site.seen(`/home${status}`) >= 2));
	assert.deepEqual(notices(), [`uptime: ${old} (project acme) is down since ${SINCE}: answered 500, expected a 2xx status`]);
});

test("a redirect's lookup that never answers ends the check at its time limit, also when the limit passes just before it", { timeout: 10_000 }, async (t) => {
	const site = await server(t);
	let asked = 0;
	resolving(t, "slow.example", () => void asked++);
	outside(t, "public.example");
	site.answers["/"] = (response) => void response.writeHead(302, { location: "http://slow.example/" }).end();
	site.answers["/far"] = (response) => void response.writeHead(302, { location: `http://public.example:${site.port}/` }).end();
	const timed = async (path: string) => {
		const from = performance.now();
		const check = await checkSite(site.url(path), undefined, 1);
		return { check, took: performance.now() - from };
	};
	const first = await timed("/");
	assert.deepEqual([first.check, asked], [{ ok: false, reason: "no answer within 1 s", answered: false }, 1]);
	assert.ok(first.took >= 990 && first.took < 2000, `the check took ${first.took} ms`);
	// /far leads to public.example, whose answer leads to slow.example. That answer's body, the second one cancelled, is
	// cancelled past the limit, so the limit has passed when the lookup of slow.example would start: none starts.
	const [cancel, cancelled] = [ReadableStream.prototype.cancel, { count: 0 }];
	ReadableStream.prototype.cancel = async function (this: ReadableStream, reason?: unknown) {
		if (++cancelled.count === 2) await sleep(1100);
		return cancel.call(this, reason);
	};
	t.after(() => void (ReadableStream.prototype.cancel = cancel));
	const second = await timed("/far");
	assert.deepEqual([second.check, asked, cancelled.count, site.seen("/")], [{ ok: false, reason: "no answer within 1 s", answered: false }, 1, 2, 2]);
	assert.ok(second.took >= 1100 && second.took < 2000, `the check took ${second.took} ms`);
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

// With family autoselection, Node 24's default, a socket asks its lookup for all addresses; without it, for one.
for (const all of [true, false]) test(`a redirect to a name that answers a public address, then loopback, never reaches it: the connection's own lookup is checked too, asked for ${all ? "all addresses" : "one address"}`, async (t) => {
	const autoSelect = net.getDefaultAutoSelectFamily();
	net.setDefaultAutoSelectFamily(all);
	t.after(() => net.setDefaultAutoSelectFamily(autoSelect));
	const [site, inside] = [await server(t), await server(t)];
	inside.answers["/"] = ok;
	// Each check resolves the name twice, for the Location's check and for the connection: public at the first, loopback at the second.
	let asked = 0;
	resolving(t, "rebind.example", () => [{ address: asked++ % 2 === 0 ? "203.0.113.9" : "127.0.0.1", family: 4 }]);
	site.answers["/"] = (response) => void response.writeHead(302, { location: `http://rebind.example:${inside.port}/` }).end();
	// The site by its address: a localhost that resolves ::1 first, as on GitHub's runner, is refused when asked for one address.
	const url = site.url("/");
	const { events } = await started(t, { acme: [{ url, everySeconds: 1 }] });
	await until("the site down", () => events("uptime-down").length === 1);
	assert.deepEqual(events("uptime-down"), [{ project: "acme", url, reason: `redirected to rebind.example:${inside.port}, a private address the config does not name`, since: START.toISOString() }]);
	assert.deepEqual([inside.seen("/"), asked >= 4], [0, true]);
});

test("a hop to another host is judged by its own answer: its status, a status without a body, its text, the time limit; a bad port is refused before a connection", async (t) => {
	const [site, inside] = [await server(t), await server(t)];
	const ports = outside(t, "public.example");
	const paths = ["/500", "/204", "/205", "/304", "/text", "/hang"];
	Object.assign(inside.answers, { "/500": broken, "/204": (response) => void response.writeHead(204).end(), "/205": (response) => void response.writeHead(205).end(), "/304": (response) => void response.writeHead(304).end(), "/text": ok, "/hang": hang } satisfies Record<string, Answer>);
	for (const path of paths) site.answers[path] = (response) => void response.writeHead(302, { location: `http://public.example:${inside.port}${path}` }).end();
	site.answers["/port"] = (response) => void response.writeHead(302, { location: "http://public.example:25/" }).end();
	const own = (path: string) => `http://localhost:${site.port}${path}`;
	const expects: Record<string, number | string | undefined> = { "/204": 204, "/205": 205, "/304": 304, "/text": "Welcome" };
	const { events } = await started(t, { acme: [...paths, "/port"].map((path) => ({ url: own(path), expect: expects[path], everySeconds: 1 })) });
	await until("three sites down", () => events("uptime-down").length === 3);
	// A third request to each means its first two checks were judged, so a page wrongly judged down is down by now.
	await until("two judged checks of each page that passes", () => ["/204", "/205", "/304", "/text"].every((path) => inside.seen(path) >= 3));
	const down = Object.fromEntries((events("uptime-down") as { url: string; reason: string }[]).map(({ url, reason }) => [url, reason]));
	assert.deepEqual(down, { [own("/500")]: "answered 500, expected a 2xx status", [own("/hang")]: "no answer within 1 s", [own("/port")]: "bad port" });
	// Each request on a connection of its own (`agent: false`): no socket is kept, and none reused without its lookup.
	const requests = paths.reduce((sum, path) => sum + inside.seen(path), 0);
	assert.deepEqual([ports.includes(25), ports.filter((port) => port === inside.port).length >= requests], [false, true]);
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

test("this machine offline: no notice and no site down, one log line; no site requested, only the probes, a restart too; a probe answering resumes the checks silently", async (t) => {
	// Both answer once, then a never answers and b's server is gone. b is due only every minute: it is asked again as a goes
	// down, so both fail at once, and the probes with them.
	const logs = t.mock.method(console, "log", () => {});
	const said = () => logs.mock.calls.map((call) => String(call.arguments[0])).filter((line) => line.startsWith("uptime:"));
	const [site, other] = [await server(t), await server(t)];
	Object.assign(site.answers, { "/a": ok });
	Object.assign(other.answers, { "/b": ok });
	const [a, b] = [site.url("/a"), other.url("/b")];
	const sites = { acme: [{ url: a, everySeconds: 1 }], beta: [{ url: b }] };
	network.up = false;
	const { fake, plugin, notices, events } = await started(t, sites);
	await until("the first checks", () => site.seen("/a") === 1 && other.seen("/b") === 1);
	site.answers["/a"] = hang;
	other.close();
	await until("the offline log line", () => said().length === 1);
	assert.deepEqual(said(), ["uptime: none of the 2 sites answers, nor https://1.1.1.1/ nor https://dns.google/, so this machine looks offline: no site is checked, only the probes, until one answers"]);
	assert.equal(readState(fake.host.folder).offline, START.toISOString());
	// While offline, each check interval asks the probes and no site.
	let [checks, asked] = [site.seen("/a"), network.asked.length];
	await until("the probes asked twice more", () => network.asked.length >= asked + 4);
	assert.equal(site.seen("/a"), checks, "no site requested while offline");
	await plugin.stop?.();
	const restarted = await started(t, sites, fake);
	[checks, asked] = [site.seen("/a"), network.asked.length];
	await until("the probes asked twice after the restart", () => network.asked.length >= asked + 4);
	assert.equal(site.seen("/a"), checks, "no site requested after a restart while offline");
	assert.deepEqual([notices(), events("uptime-down"), said().length], [[], [], 1]);
	// Once a probe answers, the checks run again; a, still failing, is down after 2 more failed checks, the only notice.
	fake.setNow(new Date("2026-01-01T00:05:00Z"));
	network.up = true;
	await until("the down notice", () => restarted.notices().length === 1);
	assert.deepEqual(notices(), [`uptime: ${a} (project acme) is down since 00:05 on thu 2026-01-01 (UTC): no answer within 1 s`]);
	assert.deepEqual(said().slice(1), ["uptime: a probe answers again, so the site checks run again, after 5 min offline"]);
	assert.equal(readState(fake.host.folder).offline, undefined);
});

test("one site and the default probes, none answering: offline, nothing sent; once a probe answers, the site still failing needs 2 new failed checks", async (t) => {
	const logs = t.mock.method(console, "log", () => {});
	const closed = createServer();
	await once(closed.listen(0, "127.0.0.1"), "listening");
	const url = `http://127.0.0.1:${(closed.address() as AddressInfo).port}/`;
	closed.close();
	network.up = false;
	const { fake, notices } = await started(t, { acme: [{ url, everySeconds: 1 }] });
	await until("the offline log line", () => logs.mock.callCount() === 1);
	fake.setNow(new Date("2026-01-01T00:05:00Z"));
	network.up = true;
	await until("the down notice", () => notices().length === 1);
	assert.deepEqual(notices(), [`uptime: ${url} (project acme) is down since 00:05 on thu 2026-01-01 (UTC): connection refused`]);
});

test("with probes: [] an offline stored before (as AR0620 could save it) is ignored and cleared: the site is checked and down after 2 failed checks", async (t) => {
	const site = await server(t);
	site.answers["/"] = broken;
	const url = site.url("/");
	const sites = { acme: [{ url, everySeconds: 1 }] };
	const fake = host(sites);
	writeFileSync(join(fake.host.folder, "state.json"), JSON.stringify({ down: {}, offline: START.toISOString() }));
	const { notices } = await started(t, sites, fake, { probes: [] });
	await until("the down notice", () => notices().length === 1);
	assert.deepEqual(notices(), [`uptime: ${url} (project acme) is down since ${SINCE}: answered 500, expected a 2xx status`]);
	assert.ok(site.seen("/") >= 2);
	assert.equal(readState(fake.host.folder).offline, undefined);
});

test("with probes: [] nothing tells this machine offline apart: two sites with no answer are each down, no probe asked", async (t) => {
	const site = await server(t);
	Object.assign(site.answers, { "/a": hang, "/b": hang });
	const [a, b] = [site.url("/a"), site.url("/b")];
	const { notices } = await started(t, { acme: [{ url: a, everySeconds: 1 }], beta: [{ url: b, everySeconds: 1 }] }, undefined, { probes: [] });
	await until("both down notices", () => notices().length === 2);
	assert.deepEqual(notices().toSorted(), [`uptime: ${a} (project acme) is down since ${SINCE}: no answer within 1 s`, `uptime: ${b} (project beta) is down since ${SINCE}: no answer within 1 s`]);
	assert.deepEqual(network.asked, []);
});

for (const probes of [undefined, []]) test(`one site with no answer is down after 2 failed checks, ${probes === undefined ? "when a probe answers, even with a redirect" : "with probes: [], none asked"}`, async (t) => {
	const site = await server(t);
	site.answers["/"] = hang;
	const url = site.url("/");
	const { notices } = await started(t, { acme: [{ url, everySeconds: 1 }] }, undefined, { probes });
	await until("the down notice", () => notices().length === 1);
	assert.deepEqual(notices(), [`uptime: ${url} (project acme) is down since ${SINCE}: no answer within 1 s`]);
	assert.deepEqual(network.asked, probes === undefined ? ["https://1.1.1.1/", "https://dns.google/"] : [], "asked once, as the site was about to go down");
});

test("a probe with no answer is cut after 10 s, and none answering is this machine offline", async (t) => {
	const site = await server(t);
	site.answers["/"] = hang;
	network.hang = true;
	const logs = t.mock.method(console, "log", () => {});
	const { notices } = await started(t, { acme: [{ url: site.url("/"), everySeconds: 1 }] }, undefined, { probes: ["https://probe.example/"] });
	await until("the offline log line", () => logs.mock.callCount() === 1);
	assert.match(String(logs.mock.calls[0]?.arguments[0]), /^uptime: none of the 1 sites answers, nor https:\/\/probe\.example\/, so this machine looks offline/);
	assert.deepEqual(notices(), []);
	// Within a timer's few ms early or late, never 10 ms short of the 10 s.
	assert.equal(network.cuts.length, 1);
	assert.ok((network.cuts[0] ?? 0) >= 9_995 && (network.cuts[0] ?? 0) < 10_500, `cut after ${network.cuts[0]} ms`);
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

test("a project's piece that is no list of sites refuses the load before the setup, naming the project and the helper", async () => {
	const fake = host({ acme: [{ url: "https://acme.example/" }], beta: [{ url: "ftp://beta.example/" }, { url: "https://beta.example/", timeout: 5 } as Site] });
	await assert.rejects(fake.setup(uptime()), {
		message: 'project beta: uptime.project(...): [0].url: expected an http or https URL, got "ftp://beta.example/"; [1].timeout: unknown key; keys: url, expect, everySeconds',
	});
	assert.deepEqual(fake.provided, [], "no setup ran");
});
