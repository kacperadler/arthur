// One check of one site (spec/roadmap.md, entry 98): a plain HTTP GET, redirects followed, no model. `answered` says whether
// the site gave an HTTP answer at all, which tells a site that is down from a machine that cannot reach anything.

export type Check = { readonly ok: true } | { readonly ok: false; readonly reason: string; readonly answered: boolean };

// The error codes of a TLS failure: OpenSSL's ERR_SSL_*, Node's ERR_TLS_*, a certificate's (CERT_HAS_EXPIRED, SELF_SIGNED_CERT_IN_CHAIN).
const TLS = /SSL|TLS|CERT|ISSUER|SIGNATURE|SELF_SIGNED/;

export async function checkSite(url: string, expect: number | string | undefined, limitSeconds: number): Promise<Check> {
	let response: Response;
	try {
		response = await fetch(url, { signal: AbortSignal.timeout(limitSeconds * 1000), headers: { "user-agent": "arthur-uptime" } });
	} catch (error) {
		return { ok: false, reason: failure(error, limitSeconds), answered: false };
	}
	const wanted = typeof expect === "number" ? response.status === expect : response.ok;
	if (!wanted) {
		await response.body?.cancel();
		return { ok: false, reason: `answered ${response.status}, expected ${typeof expect === "number" ? expect : "a 2xx status"}`, answered: true };
	}
	if (typeof expect !== "string") {
		await response.body?.cancel();
		return { ok: true };
	}
	try {
		return (await response.text()).includes(expect) ? { ok: true } : { ok: false, reason: `answered ${response.status} without the text ${JSON.stringify(expect)}`, answered: true };
	} catch (error) {
		return { ok: false, reason: `its page broke off: ${failure(error, limitSeconds)}`, answered: true };
	}
}

function failure(error: unknown, limitSeconds: number): string {
	if (error instanceof DOMException && error.name === "TimeoutError") return `no answer within ${limitSeconds} s`;
	const cause = error instanceof Error && error.cause instanceof Error ? error.cause : undefined;
	const code = cause !== undefined && "code" in cause && typeof cause.code === "string" ? cause.code : "";
	if (code === "ECONNREFUSED") return "connection refused";
	if (code === "ENOTFOUND") return "its host name is not found";
	if (TLS.test(code)) return `TLS error (${code})`;
	const said = (cause ?? (error instanceof Error ? error : undefined))?.message.split("\n")[0]?.trim() || String(error);
	return code === "" ? said : `${said} (${code})`;
}
