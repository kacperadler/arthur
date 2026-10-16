import { linkSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";

// A lock between processes on one machine: the file `path` holds the pid of its holder. A lock whose pid is dead (a crash
// while it was held) is taken over. The lock is meant to be held for a moment: a live holder past `waitMs` is an error.

const RETRY_MS = 2;

export function withLock<T>(path: string, run: () => T, waitMs = 10_000): T {
	const mine = `${path}.${process.pid}`;
	// Linked in whole, so a reader of `path` never sees it empty or half written.
	writeFileSync(mine, String(process.pid));
	try {
		for (const until = Date.now() + waitMs; !take(path, mine); ) {
			if (Date.now() > until) throw new Error(`${path}: held by pid ${holder(path)?.pid} for over ${waitMs / 1000} s`);
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_MS);
		}
	} finally {
		unlinkSync(mine);
	}
	try {
		return run();
	} finally {
		unlinkSync(path);
	}
}

function take(path: string, mine: string): boolean {
	try {
		linkSync(mine, path);
		return true;
	} catch (error) {
		if (code(error) !== "EEXIST") throw error;
	}
	const stale = holder(path);
	if (stale !== undefined && !alive(stale.pid)) takeOver(path, mine, stale);
	return false;
}

// Removes a dead holder's lock. Takers queue on `<path>.takeover`, so a slow one never removes the lock a faster one took
// after the dead holder's; the inode tells the dead holder's file from a new one written by a pid that was reused since.
function takeOver(path: string, mine: string, stale: Holder): void {
	const guard = `${path}.takeover`;
	try {
		linkSync(mine, guard);
	} catch (error) {
		if (code(error) !== "EEXIST") throw error;
		const other = holder(guard);
		if (other !== undefined && !alive(other.pid)) rmSync(guard, { force: true });
		return;
	}
	try {
		const now = holder(path);
		if (now?.pid === stale.pid && now.ino === stale.ino) rmSync(path, { force: true });
	} finally {
		unlinkSync(guard);
	}
}

type Holder = { readonly pid: number; readonly ino: number };

// Undefined when the file is gone; a file that names no pid (edited by hand) counts as a dead holder's.
function holder(path: string): Holder | undefined {
	try {
		const { ino } = statSync(path);
		const pid = Number(readFileSync(path, "utf8"));
		return { pid: Number.isSafeInteger(pid) && pid > 0 ? pid : 0, ino };
	} catch (error) {
		if (code(error) === "ENOENT") return undefined;
		throw error;
	}
}

function alive(pid: number): boolean {
	if (pid === 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return code(error) === "EPERM";
	}
}

function code(error: unknown): unknown {
	return (error as NodeJS.ErrnoException).code;
}
