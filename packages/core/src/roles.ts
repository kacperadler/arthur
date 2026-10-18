import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { basename, isAbsolute, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

// The prompt loader: what a role's prompt holds, in which order, and what it refuses: docs/commands/roles.md.

export type Role = {
	readonly name: string;
	// The role file the plugin ships, e.g. `new URL("../roles/reviewer.md", import.meta.url)`.
	readonly file: URL;
	// The criteria files the role reads from the project's criteria folder, by name: `styleguide` is `<criteria>/styleguide.md`.
	readonly criteria: readonly string[];
};

// Where a project keeps the files the roles read, relative to its repository; its `prompts` in the project list moves them.
export type PromptFiles = { readonly vision: string; readonly criteriaDir: string; readonly rolesDir: string };
export const PROJECT_FILES: PromptFiles = { vision: "spec/vision.md", criteriaDir: ".agents/arthur/criteria", rolesDir: ".agents/arthur/roles" };

// A project's `prompts` over the defaults. The list comes from another plugin and the core reads these files, so each must
// be a path inside the project's repository; anything else is refused, naming the project.
export function promptFiles(project: { readonly name: string; readonly prompts?: unknown }): PromptFiles {
	const files: Readonly<Record<string, unknown>> = { ...PROJECT_FILES, ...(project.prompts ?? {}) };
	for (const [key, path] of Object.entries(files))
		if (!Object.hasOwn(PROJECT_FILES, key) || typeof path !== "string" || path === "" || isAbsolute(path) || normalize(path).split(sep)[0] === "..")
			throw new Error(`project ${project.name}: prompts.${key}: expected ${Object.keys(PROJECT_FILES).join(", ")}, each a path inside its repository, got ${JSON.stringify(path)}`);
	return files as PromptFiles;
}

// One file a role reads: `path` is absolute for the role file, else relative to the project; `problem` when it is not read.
export type Source = {
	readonly what: "role" | "override" | "criteria";
	readonly path: string;
	readonly text?: string;
	readonly problem?: "missing" | "a symlink" | "not a file";
};

export type Collect = (name: string, args: readonly unknown[]) => unknown[];
// The main checkout of a project and where its prompt files are; `Where` finds it for a project, the main one when undefined.
export type ProjectCheckout = { readonly root: string; readonly project: string; readonly files: PromptFiles };
type Where = (project: string | undefined) => ProjectCheckout;

// What a plugin reads of the roles outside a spawn, as `host.jobs`: the prompt of `role` for the main checkout of `project`,
// without the plugins' sections, which are a job's; and the project's vision, `text` unless `problem` says why it is not read.
export type RoleReads = {
	prompt(role: string, project?: string): { readonly prompt: string; readonly warnings: string[] };
	vision(project?: string): { readonly project: string; readonly path: string; readonly text?: string; readonly problem?: Source["problem"] };
};

export function roleReads(registry: RoleRegistry, where: Where): RoleReads {
	return {
		prompt(name, project) {
			const { root, files } = where(project);
			return prompt(registry.get(name), root, files, () => []);
		},
		vision(project) {
			const { root, project: name, files } = where(project);
			return { project: name, path: files.vision, ...projectFile(root, files.vision) };
		},
	};
}

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
	readonly quick?: string;
	readonly sources: readonly Source[];
};

export function describeRoles(registry: RoleRegistry, kinds: readonly { readonly name: string; readonly role: string }[], at: ProjectCheckout, collect: Collect): RoleView[] {
	return registry.list().map(({ owner, role }) => ({
		name: role.name,
		owner,
		kinds: kinds.filter((kind) => kind.role === role.name).map((kind) => kind.name),
		...roleModel(collect, role.name),
		sources: sources(role, at.root, at.files),
	}));
}

// The files `role` reads in the project at `folder`, whose prompt files are `files`, in the order of the prompt.
export function sources(role: Role, folder: string, files: PromptFiles): Source[] {
	const file = fileURLToPath(role.file);
	const own = (what: "override" | "criteria", path: string): Source => ({ what, path, ...projectFile(folder, path) });
	return [
		existsSync(file) ? { what: "role", path: file, text: readFileSync(file, "utf8") } : { what: "role", path: file, problem: "missing" },
		own("override", join(files.rolesDir, `${role.name}.md`)),
		...role.criteria.map((name) => own("criteria", join(files.criteriaDir, `${name}.md`))),
	];
}

// The prompt of `role` for a job in `folder`, with its warnings; `sections` is asked only once the project's files passed.
export function prompt(role: Role, folder: string, files: PromptFiles, sections: () => readonly unknown[]): { readonly prompt: string; readonly warnings: string[] } {
	const parts: string[] = [];
	const warnings: string[] = [];
	for (const { what, path, text = "", problem } of sources(role, folder, files)) {
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

// The role's model, thinking level and quick model (omp's `--smol`), from the one plugin that provides `roles.model`
// (orchestration's `roles` option); left out, the agent's own default.
export function roleModel(collect: Collect, role: string): { readonly model?: string; readonly thinking?: string; readonly quick?: string } {
	const found = collect("roles.model", [role]);
	if (found.length > 1) throw new Error(`roles.model is provided ${found.length} times; one plugin provides it`);
	const { model, thinking, quick } = (found[0] ?? {}) as Record<string, unknown>;
	for (const [key, value] of Object.entries({ model, thinking, "quick model": quick }))
		if (value !== undefined && (typeof value !== "string" || value === "")) throw new Error(`roles.model: the ${key} of role ${role} must be a non-empty string or undefined`);
	return { model: model as string | undefined, thinking: thinking as string | undefined, quick: quick as string | undefined };
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
