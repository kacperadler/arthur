import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The run state of one entry, in `<home>/schedule/<id>/`, outside Git: a file per claimed slot, named by its instant
// (`2026-10-19T07:00:00.000Z`), of which only the latest is kept, and `seen`, when a sweep first saw the entry.

const SLOT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// The latest slot claimed, as an instant; undefined when none is.
export function lastClaimed(folder: string, id: string): number | undefined {
	let names: string[];
	try {
		names = readdirSync(join(folder, id));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
	const last = names.filter((name) => SLOT.test(name)).sort().at(-1);
	return last === undefined ? undefined : Date.parse(last);
}

// Creating the slot's file either succeeds or finds it there: of any number of sweeps, in any processes, exactly one claims
// a slot. The one that does drops the entry's older slots.
export function claim(folder: string, id: string, slot: Date, now: Date): boolean {
	const own = join(folder, id);
	const name = slot.toISOString();
	mkdirSync(own, { recursive: true });
	try {
		writeFileSync(join(own, name), `claimed ${now.toISOString()}\n`, { flag: "wx" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
		throw error;
	}
	for (const older of readdirSync(own)) if (SLOT.test(older) && older < name) rmSync(join(own, older), { force: true });
	return true;
}

// When a sweep first saw the entry: written by the first, read by every later one; one that cannot be read counts as now.
export function seen(folder: string, id: string, now: Date): number {
	const file = join(folder, id, "seen");
	mkdirSync(join(folder, id), { recursive: true });
	try {
		writeFileSync(file, now.toISOString(), { flag: "wx" });
		return now.getTime();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
	}
	const at = Date.parse(readFileSync(file, "utf8"));
	return Number.isNaN(at) ? now.getTime() : at;
}
