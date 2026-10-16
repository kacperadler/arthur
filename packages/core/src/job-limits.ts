// A job's limits, minutes and USD, `0` for none, and where a spawn takes them from: docs/commands/spawn.md.

export type Limits = { readonly timeoutMinutes: number; readonly budgetUsd: number };

// A request's or a kind's own limits, refused unless each is a number of 0 or more, and a kind's `resumeOnBudget` unless
// it is true or false; `where` names the one refused.
export function checkLimits(where: string, own: Partial<Limits> & { readonly resumeOnBudget?: unknown }): void {
	for (const key of ["timeoutMinutes", "budgetUsd"] as const) {
		const value: unknown = own[key];
		if (value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0)) continue;
		throw new Error(`${where}: ${key} must be a number of 0 or more, got ${typeof value === "string" ? JSON.stringify(value) : String(value)}`);
	}
	if (own.resumeOnBudget !== undefined && typeof own.resumeOnBudget !== "boolean") throw new Error(`${where}: resumeOnBudget must be true or false`);
}

// The limits of a spawn: the request's, else its kind's, else the core's `jobs` options (`defaults`); the request's checked.
export function spawnLimits(request: Partial<Limits>, kind: Partial<Limits>, defaults: Limits): Limits {
	checkLimits("spawn", request);
	return {
		timeoutMinutes: request.timeoutMinutes ?? kind.timeoutMinutes ?? defaults.timeoutMinutes,
		budgetUsd: request.budgetUsd ?? kind.budgetUsd ?? defaults.budgetUsd,
	};
}

// Whether `cost` reached `budget`, both in USD, at the 4 decimals the record's `cost` holds, so a sum of costs that floating
// point leaves a hair below the budget still reaches it. A budget of 0 is none.
export function reached(cost: number, budget: number): boolean {
	return budget > 0 && Math.round(cost * 10_000) >= Math.round(budget * 10_000);
}

// Calls `fn` once, `minutes` from now; 0 never. A Node timer waits at most 2^31 - 1 ms (about 24.8 days) and fires at
// once past it, so a longer wait is made of several. Returns the cancel.
export function deadline(minutes: number, fn: () => void): () => void {
	if (!(minutes > 0)) return () => {};
	const end = Date.now() + minutes * 60_000;
	let timer: NodeJS.Timeout | undefined;
	const arm = () => {
		const left = end - Date.now();
		if (left <= 0) return fn();
		timer = setTimeout(arm, Math.min(left, 2 ** 31 - 1));
	};
	arm();
	return () => clearTimeout(timer);
}
