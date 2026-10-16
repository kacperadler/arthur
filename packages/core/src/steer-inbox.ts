import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// A job's steers (spec/roadmap.md, entry 14), in `<record>/steer/`: `arthur steer` links each correction into `inbox/` under
// the next number (`0001`, `0002`, ...); the steer extension (steer.ts) hands those to the agent after its next tool call and
// moves them to `done/`; at the job's end the wrapper writes `closed` (its own pid) and moves what is left to `undelivered/`,
// so a later run never gets one late. The inbox is closed before it is listed: a steer linked after the listing finds
// `closed` naming the run it was meant for and moves itself, so none is left behind.

const NUMBER = /^\d{4,}$/;

// The numbers of the steers in `box` (`inbox`, `done`, `undelivered`) of a job's `steer/` folder, oldest first.
export function waiting(steer: string, box: string): string[] {
	const path = join(steer, box);
	return existsSync(path) ? readdirSync(path).filter((name) => NUMBER.test(name)).sort((a, b) => Number(a) - Number(b)) : [];
}

// Queues `text` for the run of wrapper `pid` and returns its number; throws, naming it, when that run ended first.
export function queueSteer(steer: string, pid: string, text: string): string {
	mkdirSync(join(steer, "inbox"), { recursive: true });
	// Written whole under another name, then linked in: the extension never reads half a steer, and a number another steer
	// took makes the link fail.
	const draft = join(steer, `.draft-${process.pid}`);
	writeFileSync(draft, `${text}\n`);
	let name = "";
	try {
		const numbers = ["inbox", "done", "undelivered"].flatMap((box) => waiting(steer, box).map(Number));
		for (let number = Math.max(0, ...numbers) + 1; name === ""; number++) {
			try {
				linkSync(draft, join(steer, "inbox", String(number).padStart(4, "0")));
				name = String(number).padStart(4, "0");
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			}
		}
	} finally {
		rmSync(draft, { force: true });
	}
	if (!existsSync(join(steer, "closed")) || readFileSync(join(steer, "closed"), "utf8") !== pid) return name;
	mkdirSync(join(steer, "undelivered"), { recursive: true });
	try {
		renameSync(join(steer, "inbox", name), join(steer, "undelivered", name));
	} catch (error) {
		// The wrapper listed it after all and moved it first.
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	throw new Error(`the job ended before its next tool call; steer ${name} was not delivered`);
}

// Called by wrapper `pid` at the job's end, its `steer/` folder made: the numbers of the steers it moved to `undelivered/`.
export function closeSteers(steer: string, pid: string, note: (line: string) => void): string[] {
	writeFileSync(join(steer, "closed"), pid);
	const names = waiting(steer, "inbox");
	if (names.length > 0) mkdirSync(join(steer, "undelivered"), { recursive: true });
	return names.filter((name) => {
		try {
			const text = readFileSync(join(steer, "inbox", name), "utf8");
			renameSync(join(steer, "inbox", name), join(steer, "undelivered", name));
			note(`undelivered steer ${name}: ${text.trim().split("\n")[0]}`);
			return true;
		} catch (error) {
			// A steer linked after `closed` moved itself, and its `arthur steer` says so.
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			return false;
		}
	});
}
