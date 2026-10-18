import { checkLimits } from "./job-limits.ts";
import type { Kind } from "./jobs.ts";

// The kinds of job of one load (spec/roadmap.md, entry 9), each owned by the plugin that registers it; the core owns `worker`.

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function kindRegistry() {
	const kinds = new Map<string, { readonly owner: string; readonly kind: Kind }>();
	return {
		// `owner` is the plugin that registers, named in refusals.
		register(owner: string, kind: Kind): void {
			if (typeof kind.name !== "string" || !NAME.test(kind.name)) throw new Error(`kind ${JSON.stringify(kind.name)}: expected a name of lowercase letters, digits and dashes`);
			const first = kinds.get(kind.name);
			if (first) throw new Error(`kind ${kind.name}: registered by ${first.owner} and by ${owner}; a kind belongs to one plugin`);
			if (typeof kind.readOnly !== "boolean") throw new Error(`kind ${kind.name}: readOnly must be true or false`);
			checkLimits(`kind ${kind.name}`, kind);
			kinds.set(kind.name, { owner, kind });
		},
		get: (name: string): Kind | undefined => kinds.get(name)?.kind,
		all: (): Kind[] => [...kinds.values()].map((entry) => entry.kind),
	};
}
