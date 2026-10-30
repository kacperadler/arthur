import { setTimeout as sleep } from "node:timers/promises";

// The one wait of every test (AR0578; test/structure.test.ts refuses a test's own): checks `predicate` every 20 ms until it gives
// a value other than `undefined` and `false`, and returns it; past `deadlineMs` (default 20 s) it throws, naming `what`.
export async function until<T>(what: string, predicate: () => T | undefined | false, { deadlineMs = 20_000 }: { readonly deadlineMs?: number } = {}): Promise<T> {
	for (const end = Date.now() + deadlineMs; ; await sleep(20)) {
		const value = predicate();
		if (value !== undefined && value !== false) return value;
		if (Date.now() > end) throw new Error(`waited ${deadlineMs / 1000} s for ${what}`);
	}
}
