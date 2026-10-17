import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { afterProblem } from "./board-after.ts";
import { type Entry, ID, NEXT, readBoard, STATUSES, type Status, writeBoard } from "./board-file.ts";
import { boardText } from "./board-text.ts";
import type { Clock } from "./clock.ts";
import { withLock } from "./lock.ts";
import { checkTitle, guidanceLeft, slug, ticketText } from "./ticket-template.ts";

// The ticket board (spec/roadmap.md, entries 17 and 18): each project's tickets as folders `spec/features/<id>-<slug>/` and its
// board `spec/build.json`, changed only here, one writer at a time across processes. Ids are the project's prefix and a number,
// from 1, counted on after every ticket the board or the folder has, dropped ones included. The projects are the list a
// plugin provides as `projects` (entry 41); the first one is the main project.

export type Project = { readonly name: string; readonly path: string; readonly prefix: string };

export type Ticket = Entry & { readonly project: string };

export type Board = {
	// The checked project list; the first is the main one.
	projects(): Project[];
	// The project's tickets, in the order they were created; `project` undefined is the main one.
	list(project?: string): Ticket[];
	// By its full id (`AR0014`): the prefix names the project. Undefined when no project or ticket has it.
	get(id: string): Ticket | undefined;
	// A new ticket in planning, its `ticket.md` from the template; emits `ticket-created`.
	create(title: string, project?: string): Ticket;
	// Emits `ticket-moved` (`id`, `project`, `from`, `to`); a move to the status it has is no change and no event. A move
	// `NEXT` does not allow is refused; `planned` is refused while the template's guidance is left in its `ticket.md`.
	move(id: string, to: string): Ticket;
	// The tickets `id` waits for, on its own board, replacing the ones before; none waits for nothing. Refused: an id not on the
	// board, a dropped one, a cycle. Emits `ticket-after` (`id`, `project`, `after`) when it changes.
	after(id: string, ids: readonly string[]): Ticket;
	// Every open ticket, the 10 newest merged, and one line counting the rest; `project` undefined is the main one.
	digest(project?: string): string;
};

const FILE = "spec/build.json";
const FEATURES = "spec/features";
// The board's lock and temporary files: a folder beside the board, so a rename from it stays on the board's filesystem and
// is atomic, whose `.gitignore` ignores the folder whole, so a writer killed mid-write leaves nothing a commit could take.
const TRANSIENT = "spec/.board";

// `lists`: what every provider of `projects` returned; `emit`: an event, named by whoever holds this board.
export function board(lists: () => readonly unknown[], clock: Clock, emit: (name: string, data: unknown) => unknown): Board {
	const project = (name: string | undefined): Project => {
		const all = projectList(lists());
		const found = name === undefined ? all[0] : all.find((each) => each.name === name);
		if (found === undefined) throw new Error(`unknown project ${name}; projects: ${all.map((each) => each.name).join(", ")}`);
		return found;
	};
	const owner = (id: string): Project | undefined => projectList(lists()).find((each) => ID.exec(id)?.[1] === each.prefix);
	const tickets = (where: Project): Ticket[] => readBoard(join(where.path, FILE)).map((entry) => ({ ...entry, project: where.name }));
	// Under the board's lock: read, change, and write the board only when `change` added or replaced a ticket. The temporary
	// files have fixed names: only the lock's holder writes them, over whatever a killed holder left.
	const write = <T>(where: Project, change: (entries: Entry[], transient: string) => T): T => {
		const file = join(where.path, FILE);
		const transient = transientFolder(where);
		return withLock(join(transient, "build.json.lock"), () => {
			const entries = readBoard(file);
			const before = [...entries];
			const result = change(entries, transient);
			if (entries.length !== before.length || entries.some((entry, index) => entry !== before[index])) {
				writeBoard(file, entries, join(transient, "build.json.tmp"));
			}
			return result;
		});
	};
	// Under the lock: ticket `id` replaced by what `change` returns for it (itself when nothing changes), on its own board.
	const update = (id: string, change: (found: Entry, entries: readonly Entry[], where: Project) => Entry) => {
		const where = owner(id);
		if (where === undefined) throw new Error(`${id}: no project has its prefix; prefixes: ${projectList(lists()).map((each) => each.prefix).join(", ")}`);
		const [before, after] = write(where, (entries) => {
			const index = entries.findIndex((each) => each.id === id);
			const found = entries[index];
			if (found === undefined) throw new Error(`${id}: not on the board of project ${where.name}`);
			const changed = change(found, entries, where);
			entries[index] = changed;
			return [found, changed] as const;
		});
		return { where, before, after, ticket: { ...after, project: where.name } };
	};
	return {
		projects: () => projectList(lists()),
		list: (name) => tickets(project(name)),
		digest: (name) => boardText(tickets(project(name)), false),
		get(id) {
			const where = owner(id);
			return where && tickets(where).find((ticket) => ticket.id === id);
		},
		create(title, name) {
			const problem = checkTitle(title);
			if (problem !== undefined) throw new Error(`${problem}: ${JSON.stringify(title)}`);
			const where = project(name);
			const entry = write(where, (entries, transient) => {
				const id = `${where.prefix}${String(lastNumber(where, entries) + 1).padStart(4, "0")}`;
				const folder = `${FEATURES}/${id}-${slug(title)}`;
				mkdirSync(join(where.path, folder), { recursive: true });
				const path = `${folder}/ticket.md`;
				writeWhole(join(where.path, path), ticketText(id, title, clock.local().date), join(transient, "ticket.md.tmp"));
				const created: Entry = { id, title, status: "planning", path, updated: clock.now().toISOString() };
				entries.push(created);
				return created;
			});
			emit("ticket-created", { id: entry.id, project: where.name, title, status: entry.status, path: entry.path });
			return { ...entry, project: where.name };
		},
		move(id, to) {
			if (!STATUSES.includes(to as Status)) throw new Error(`${id}: unknown status ${JSON.stringify(to)}; statuses: ${STATUSES.join(", ")}`);
			const { where, before, after, ticket } = update(id, (found, _, at) => {
				if (found.status === to) return found;
				const allowed = NEXT[found.status];
				if (!allowed.includes(to as Status)) throw new Error(`${id}: ${found.status} cannot move to ${to}; from ${found.status}: ${allowed.join(", ") || "none, it is final"}`);
				if (to === "planned") refuseGuidance(at, found);
				return { ...found, status: to as Status, updated: clock.now().toISOString() };
			});
			if (after !== before) emit("ticket-moved", { id, project: where.name, from: before.status, to });
			return ticket;
		},
		after(id, ids) {
			const wanted = [...new Set(ids)];
			const { where, before, after, ticket } = update(id, (found, entries) => {
				const problem = afterProblem(entries, id, wanted);
				if (problem !== undefined) throw new Error(problem);
				if ((found.after ?? []).join() === wanted.join()) return found;
				const { after: _, ...rest } = found;
				return wanted.length > 0 ? { ...rest, after: wanted } : rest;
			});
			if (after !== before) emit("ticket-after", { id, project: where.name, after: wanted });
			return ticket;
		},
	};
}

// The highest number of the prefix on the board or in a ticket folder (one whose board write failed, or made by hand).
function lastNumber(where: Project, entries: readonly Entry[]): number {
	let folders: string[] = [];
	try {
		folders = readdirSync(join(where.path, FEATURES));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const ids = [...entries.map((entry) => entry.id), ...folders.map((name) => name.split("-")[0] ?? "")];
	return Math.max(0, ...ids.map((id) => ID.exec(id)).flatMap((match) => (match?.[1] === where.prefix ? [Number(match[2])] : [])));
}

function refuseGuidance(where: Project, entry: Entry): void {
	let text: string;
	try {
		text = readFileSync(join(where.path, entry.path), "utf8");
	} catch (error) {
		throw new Error(`${entry.id}: cannot read ${entry.path} to check it for template guidance: ${(error as Error).message}`);
	}
	const left = guidanceLeft(text);
	if (left.length > 0) throw new Error(`${entry.id}: not planned: ${entry.path} still holds the template's guidance, replace it first:\n${left.join("\n")}`);
}

function writeWhole(path: string, text: string, temporary: string): void {
	writeFileSync(temporary, text);
	renameSync(temporary, path);
}

function transientFolder(where: Project): string {
	const folder = join(where.path, TRANSIENT);
	mkdirSync(folder, { recursive: true });
	const ignore = join(folder, ".gitignore");
	if (!existsSync(ignore) || readFileSync(ignore, "utf8") !== "*\n") writeFileSync(ignore, "*\n");
	return folder;
}

const PREFIX = /^[A-Z]+$/;

// The project list, checked: it comes from another plugin. The job runner reads it too, for a job's project.
export function projectList(lists: readonly unknown[]): Project[] {
	if (lists.length === 0) throw new Error("no project list: the board needs each project's folder and ticket prefix, which the projects plugin provides");
	if (lists.length > 1) throw new Error(`the project list is provided ${lists.length} times; one plugin provides it`);
	const [list] = lists;
	if (!Array.isArray(list) || list.length === 0) throw new Error("the project list is empty or not a list");
	const seen = new Set<string>();
	for (const [index, each] of list.entries()) {
		const { name, path, prefix } = (each ?? {}) as Record<string, unknown>;
		const at = `project list [${index}]`;
		if (typeof name !== "string" || name === "") throw new Error(`${at}.name: expected a non-empty string`);
		if (typeof path !== "string" || !isAbsolute(path)) throw new Error(`${at}.path: expected the project's folder as an absolute path, got ${JSON.stringify(path)}`);
		if (typeof prefix !== "string" || !PREFIX.test(prefix)) throw new Error(`${at}.prefix: expected capital letters A-Z, got ${JSON.stringify(prefix)}`);
		for (const key of [`name ${name}`, `prefix ${prefix}`]) {
			if (seen.has(key)) throw new Error(`${at}: a second project with the ${key}`);
			seen.add(key);
		}
	}
	return list as Project[];
}
