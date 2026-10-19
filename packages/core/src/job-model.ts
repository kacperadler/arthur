import type { Collect } from "./roles.ts";

// A spawn's model (spec/roadmap.md, entry 82): one name, or an ordered list of which the plugin that provides `models.pick` (the
// models plugin) answers the first available and the line why: docs/commands/spawn.md, "The model".

export type ModelList = string | readonly string[];
export type Picked = { readonly model: string | undefined; readonly modelWhy: string | undefined; readonly free: boolean };

export const isModelList = (value: unknown): value is ModelList =>
	(typeof value === "string" && value !== "") || (Array.isArray(value) && value.length > 0 && value.every((each) => typeof each === "string" && each !== ""));

// Without the models plugin one model is the agent's to resolve and a list is refused; with it every model is probed on the job's
// `machine`, a single one too, and the spawn is refused when none is available. A free model's job has no budget (entry 12).
export async function pickModel(collect: Collect, model: unknown, machine: string): Promise<Picked> {
	if (model === undefined) return { model: undefined, modelWhy: undefined, free: false };
	if (!isModelList(model)) throw new Error(`model must be a non-empty string or a non-empty list of them, got ${JSON.stringify(model)}`);
	const list = [model].flat();
	const picks = collect("models.pick", [list, machine]);
	if (picks.length > 1) throw new Error(`models.pick is provided ${picks.length} times; one plugin provides it`);
	if (picks.length === 0 && typeof model !== "string") throw new Error("a model list needs the models plugin");
	if (picks.length === 0) return { model: list[0], modelWhy: undefined, free: false };
	const { model: picked, why, free } = ((await picks[0]) ?? {}) as Record<string, unknown>;
	if (typeof picked !== "string" || !list.includes(picked) || typeof why !== "string" || typeof free !== "boolean") throw new Error("models.pick: expected { model, why, free }, the model one of the list");
	return { model: picked, modelWhy: free ? `${why}; budget: none, free model ${picked}` : why, free };
}
