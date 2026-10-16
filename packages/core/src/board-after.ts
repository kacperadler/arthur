import type { Entry } from "./board-file.ts";

// A ticket's `after` (spec/roadmap.md, entry 18): the tickets of its own board it waits for, until each is merged.

// Why ticket `id` cannot wait for `after` on `entries`, or undefined: an id the board does not hold, a dropped one, or one
// that leads back to `id` through the afters on the board (a cycle, named as its chain).
export function afterProblem(entries: readonly Entry[], id: string, after: readonly string[]): string | undefined {
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const unknown = after.filter((other) => !byId.has(other));
	if (unknown.length > 0) return `${id} cannot wait for ${unknown.join(", ")}: not on its board`;
	const dropped = after.filter((other) => byId.get(other)?.status === "dropped");
	if (dropped.length > 0) return `${id} cannot wait for ${dropped.join(", ")}: dropped`;
	const chains = after.map((other) => [id, other]);
	const seen = new Set<string>();
	for (const chain of chains) {
		const last = chain.at(-1) ?? id;
		if (last === id) return `${id} cannot wait for itself: ${chain.join(" after ")}`;
		if (seen.has(last)) continue;
		seen.add(last);
		for (const next of byId.get(last)?.after ?? []) chains.push([...chain, next]);
	}
	return undefined;
}

// The tickets of `after` not merged yet: while any is left, the ticket waits.
export function openAfter(entries: readonly Entry[], after: readonly string[] = []): string[] {
	return after.filter((other) => entries.find((entry) => entry.id === other)?.status !== "merged");
}
