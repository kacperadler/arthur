import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

// The prompt loader (spec/roadmap.md, entry 10). A role's prompt is the role file the plugin owning the role ships, then the
// project's own override `<roles>/<role>.md`, then each criteria file the role names, `<criteria>/<name>.md`, as
// `## <title> (<path>)`, then the sections plugins provide as `prompt` for that role and job. The project's files are read
// from the job's worktree, so they are its HEAD; one that is a symlink, or under one, is refused and never read.

export type Role = {
	readonly name: string;
	// The role file the plugin ships, e.g. `new URL("../roles/reviewer.md", import.meta.url)`.
	readonly file: URL;
	// The criteria files the role reads from the project's criteria folder, by name: `styleguide` is `<criteria>/styleguide.md`.
	readonly criteria: readonly string[];
};

// Where a project keeps the files the roles read, relative to its repository.
export const PROJECT_FILES = { roles: ".agents/arthur/roles", criteria: ".agents/arthur/criteria" } as const;

// One file a role reads: `path` is absolute for the role file, else relative to the project; `problem` when it is not read.
export type Source = {
	readonly what: "role" | "override" | "criteria";
	readonly path: string;
	readonly text?: string;
	readonly problem?: "missing" | "a symlink" | "not a file";
};

type Collect = (name: string, args: readonly unknown[]) => unknown[];

export type RoleRegistry = {
	register(owner: string, role: Role): void;
	// The role a spawn uses: refused when no plugin registered it or its role file is gone, naming the file.
	get(name: string): Role;
	// In the order they were registered, the core's `worker` first.
	list(): { readonly owner: string; readonly role: Role }[];
};

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// The roles of one load; `owner` is the plugin that registers, named in refusals.
export function roleRegistry(): RoleRegistry {
	const roles = new Map<string, { readonly owner: string; readonly role: Role }>();
	return {
		register(owner, role) {
			if (typeof role.name !== "string" || !NAME.test(role.name)) throw new Error(`role ${JSON.stringify(role.name)}: expected a name of lowercase letters, digits and dashes`);
			const first = roles.get(role.name);
			if (first) throw new Error(`role ${role.name}: registered by ${first.owner} and by ${owner}; a role belongs to one plugin`);
			if (!(role.file instanceof URL) || role.file.protocol !== "file:") throw new Error(`role ${role.name}: file must be a file URL, e.g. new URL("../roles/${role.name}.md", import.meta.url)`);
			if (!Array.isArray(role.criteria) || !role.criteria.every((name) => typeof name === "string" && NAME.test(name)))
				throw new Error(`role ${role.name}: criteria must be a list of file names without .md, e.g. ["styleguide"]`);
			roles.set(role.name, { owner, role });
		},
		get(name) {
			const role = roles.get(name)?.role;
			if (role === undefined) throw new Error(`role ${name} is not registered; roles: ${[...roles.keys()].sort().join(", ")}`);
			if (!existsSync(role.file)) throw new Error(`role ${name}: its role file ${fileURLToPath(role.file)} is missing`);
			return role;
		},
		list: () => [...roles.values()],
	};
}

// A role as `arthur roles` shows it: the plugin that registered it, the kinds that use it, its model, and the files it reads.
export type RoleView = {
	readonly name: string;
	readonly owner: string;
	readonly kinds: readonly string[];
	readonly model?: string;
	readonly thinking?: string;
	readonly sources: readonly Source[];
};

export function describeRoles(registry: RoleRegistry, kinds: readonly { readonly name: string; readonly role: string }[], folder: string, collect: Collect): RoleView[] {
	return registry.list().map(({ owner, role }) => ({
		name: role.name,
		owner,
		kinds: kinds.filter((kind) => kind.role === role.name).map((kind) => kind.name),
		...roleModel(collect, role.name),
		sources: sources(role, folder),
	}));
}

// The files `role` reads in the project at `folder`, in the order of the prompt.
export function sources(role: Role, folder: string): Source[] {
	const file = fileURLToPath(role.file);
	const own = (what: "override" | "criteria", path: string): Source => ({ what, path, ...projectFile(folder, path) });
	return [
		existsSync(file) ? { what: "role", path: file, text: readFileSync(file, "utf8") } : { what: "role", path: file, problem: "missing" },
		own("override", join(PROJECT_FILES.roles, `${role.name}.md`)),
		...role.criteria.map((name) => own("criteria", join(PROJECT_FILES.criteria, `${name}.md`))),
	];
}

// The prompt of `role` for a job in `folder`, and a warning per criteria file that is missing or empty; `sections` asks the
// plugins for theirs (`prompt`), only once the project's files passed. Refused, naming the path: a missing role file, a
// symlinked or odd override or criteria file.
export function prompt(role: Role, folder: string, sections: () => readonly unknown[]): { readonly prompt: string; readonly warnings: string[] } {
	const parts: string[] = [];
	const warnings: string[] = [];
	for (const { what, path, text = "", problem } of sources(role, folder)) {
		if (problem === "missing" && what === "role") throw new Error(`role ${role.name}: its role file ${path} is missing`);
		if (problem === "missing" && what === "criteria") warnings.push(`criteria file ${path} is missing; the ${role.name} goes without it`);
		if (problem !== undefined && problem !== "missing") throw new Error(`${path} is ${problem}; refused, the roles read a project's file only as a plain file`);
		if (problem !== undefined) continue;
		const body = text.trim();
		if (body === "" && what === "criteria") warnings.push(`criteria file ${path} is empty; nothing added`);
		if (body === "") continue;
		if (what === "role") parts.push(body);
		if (what === "override") parts.push(`## Project override, which wins over the role above (${path})\n\n${body}`);
		if (what === "criteria") parts.push(`## ${/^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? basename(path, ".md")} (${path})\n\n${body}`);
	}
	for (const section of sections()) {
		if (section !== undefined && typeof section !== "string") throw new Error(`a plugin's prompt section must be text, got ${typeof section}`);
		if (section?.trim()) parts.push(section.trim());
	}
	return { prompt: `${parts.join("\n\n")}\n`, warnings };
}

// The role's model and thinking level, from the one plugin that provides `roles.model` (orchestration's `roles` option); left
// out, the agent's own default.
export function roleModel(collect: Collect, role: string): { readonly model?: string; readonly thinking?: string } {
	const found = collect("roles.model", [role]);
	if (found.length > 1) throw new Error(`roles.model is provided ${found.length} times; one plugin provides it`);
	const { model, thinking } = (found[0] ?? {}) as Record<string, unknown>;
	for (const [key, value] of Object.entries({ model, thinking }))
		if (value !== undefined && (typeof value !== "string" || value === "")) throw new Error(`roles.model: the ${key} of role ${role} must be a non-empty string or undefined`);
	return { model: model as string | undefined, thinking: thinking as string | undefined };
}

// A project's own file, never through a symlink: one on the way to it would read whatever it points at.
function projectFile(folder: string, path: string): Pick<Source, "text" | "problem"> {
	const full = join(folder, path);
	const stat = lstatSync(full, { throwIfNoEntry: false });
	if (stat === undefined) return { problem: "missing" };
	if (stat.isSymbolicLink() || realpathSync(full) !== join(realpathSync(folder), path)) return { problem: "a symlink" };
	if (!stat.isFile()) return { problem: "not a file" };
	return { text: readFileSync(full, "utf8") };
}
