import { lookup } from "node:dns";
import { get as plain, type IncomingMessage } from "node:http";
import { get as secure } from "node:https";
import type { LookupFunction } from "node:net";
import { BLOCKED_PORTS, PRIVATE } from "./uptime-options.ts";

// One check of one site (spec/roadmap.md, entry 98): a plain HTTP GET, at most 20 redirects followed, no model. `answered` says
// whether the site gave an HTTP answer at all, which tells a site that is down from a machine that cannot reach anything.

export type Check = { readonly ok: true } | { readonly ok: false; readonly reason: string; readonly answered: boolean };

// The error codes of a TLS failure: OpenSSL's ERR_SSL_*, Node's ERR_TLS_*, a certificate's (CERT_HAS_EXPIRED, SELF_SIGNED_CERT_IN_CHAIN).
const TLS = /SSL|TLS|CERT|ISSUER|SIGNATURE|SELF_SIGNED/;
// Where a redirect leads only when the config names its host (AR0367): not PRIVATE. A hop past that host is sent by
// node:http(s), whose socket connects only where `guarded`, its one lookup, allows (AR0424).
const REFUSED = new Error("a private address the config does not name");
const guarded: LookupFunction = (name, options, done) => lookup(name, options, (error, address, family) => done(error ?? ((typeof address === "string" ? [{ address, family }] : address).some((each) => PRIVATE.check(each.address, `ipv${each.family}` as "ipv4" | "ipv6")) ? REFUSED : null), address, family));
const get = (at: URL, signal: AbortSignal) => new Promise<IncomingMessage>((resolve, reject) => void (at.protocol === "https:" ? secure : plain)(at, { signal, agent: false, lookup: guarded, headers: { "user-agent": "arthur-uptime" } }, resolve).on("error", reject)).then((answer) => new Response([204, 205, 304].includes(answer.statusCode ?? 0) ? answer.resume() && null : (answer as unknown as ReadableStream), { status: answer.statusCode, headers: answer.headers as HeadersInit }));

export async function checkSite(url: string, expect: number | string | undefined, limitSeconds: number, second = 1000): Promise<Check> {
	const [signal, named] = [AbortSignal.timeout(limitSeconds * second), new URL(url).host];
	let [at, response]: [URL, Response?] = [new URL(url)];
	try {
		for (let hops = 0; ; hops++) {
			response = await (at.host === named ? fetch(at, { signal, redirect: "manual", headers: { "user-agent": "arthur-uptime" } }) : get(at, signal));
			if (hops === 20 || !response.headers.has("location") || ![301, 302, 303, 307, 308].includes(response.status)) break;
			await response.body?.cancel();
			at = new URL(response.headers.get("location") as string, at);
			if (at.host !== named) await new Promise((ok, no) => (signal.throwIfAborted(), signal.addEventListener("abort", () => no(signal.reason)), guarded(at.hostname.replace(/^\[(.*)\]$/, "$1"), { all: true }, (error) => (error ? no(error) : ok(at)))));
			if (BLOCKED_PORTS.includes(at.port)) throw new Error("bad port"); // as fetch, which judged every hop before AR0424
		}
	} catch (error) {
		return error === REFUSED ? { ok: false, reason: `redirected to ${at.host}, ${REFUSED.message}`, answered: true } : { ok: false, reason: failure(error, limitSeconds, signal.aborted), answered: false };
	}
	const wanted = typeof expect === "number" ? response.status === expect : response.ok;
	if (!wanted || typeof expect !== "string") {
		await response.body?.cancel();
		return wanted ? { ok: true } : { ok: false, reason: `answered ${response.status}, expected ${typeof expect === "number" ? expect : "a 2xx status"}`, answered: true };
	}
	try {
		return (await response.text()).includes(expect) ? { ok: true } : { ok: false, reason: `answered ${response.status} without the text ${JSON.stringify(expect)}`, answered: true };
	} catch (error) {
		return { ok: false, reason: `its page broke off: ${failure(error, limitSeconds, signal.aborted)}`, answered: true };
	}
}

// One probe outside the projects (AR0620): any HTTP answer, a redirect or an error status too, proves this machine reaches the network.
export const probe = (url: string, limitSeconds: number, second = 1000): Promise<boolean> =>
	fetch(url, { signal: AbortSignal.timeout(limitSeconds * second), redirect: "manual", headers: { "user-agent": "arthur-uptime" } }).then(async (response) => (await response.body?.cancel(), true), () => false);

function failure(error: unknown, limitSeconds: number, late: boolean): string {
	if (late) return `no answer within ${limitSeconds} s`;
	const cause = error instanceof Error ? (error.cause instanceof Error ? error.cause : error) : undefined;
	const code = cause !== undefined && "code" in cause && typeof cause.code === "string" ? cause.code : "";
	if (code === "ECONNREFUSED") return "connection refused";
	if (code === "ENOTFOUND") return "its host name is not found";
	if (TLS.test(code)) return `TLS error (${code})`;
	const said = cause?.message.split("\n")[0]?.trim() || String(error);
	return code === "" ? said : `${said} (${code})`;
}
