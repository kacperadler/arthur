import { linkSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

// A lock between processes on one machine: the file `path` holds the pid of its holder and, where the system has one (Linux),
// the id of the boot it ran in. A lock whose pid is dead (a crash while it was held), or that was written in an earlier boot,
// whose pid may name another process now, is taken over. `withLock` holds it for a moment: a live holder past `waitMs` is an
// error. `takeLock` holds it for as long as a process runs. `queueLock` waits for it without blocking this process, whose
// own other holder may need its turn to finish.

const RETRY_MS = 2;
const BOOT = bootId();

export function withLock<T>(path: string, run: () => T, waitMs = 10_000): T {
	const mine = own(path);
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

// Takes the lock now, or names the live process that holds it. `release` removes the lock only while it is still this one's.
export function takeLock(path: string): { readonly release: () => void } | { readonly heldBy: number } {
	const mine = own(path);
	try {
		while (!take(path, mine)) {
			const other = holder(path);
			if (other !== undefined && alive(other.pid)) return { heldBy: other.pid };
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_MS);
		}
	} finally {
		unlinkSync(mine);
	}
	const { ino } = statSync(path);
	return {
		release() {
			const now = holder(path);
			if (now?.pid === process.pid && now.ino === ino) unlinkSync(path);
		},
	};
}

// Waits its turn behind any live holder, this process included; past `waitMs` it is an error. The function it returns
// releases the lock once: a second call never removes a lock taken since, whatever inode the new one got.
export async function queueLock(path: string, waitMs = 60_000): Promise<() => void> {
	for (const until = Date.now() + waitMs; ; await sleep(10)) {
		const lock = takeLock(path);
		if ("release" in lock) {
			let held = true;
			return () => {
				if (held) lock.release();
				held = false;
			};
		}
		if (Date.now() > until) throw new Error(`${path}: held by pid ${lock.heldBy} for over ${waitMs / 1000} s`);
	}
}

// This process's lock file beside `path`, written in whole: `path` is linked to it, so a reader never sees it half written.
function own(path: string): string {
	const mine = `${path}.${process.pid}`;
	writeFileSync(mine, BOOT === "" ? String(process.pid) : `${process.pid} ${BOOT}`);
	return mine;
}

// Empty where the system names no boot (macOS): there a pid reused after a reboot still counts as the holder.
function bootId(): string {
	try {
		return readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
	} catch {
		return "";
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
// A guard left by a crashed taker is a dead holder's file too, removed the same way, so that racing takers never remove
// the guard one of them took after it.
function takeOver(path: string, mine: string, stale: Holder): void {
	const guard = `${path}.takeover`;
	try {
		linkSync(mine, guard);
	} catch (error) {
		if (code(error) !== "EEXIST") throw error;
		const other = holder(guard);
		if (other !== undefined && !alive(other.pid)) takeOver(guard, mine, other);
		return;
	}
	try {
		const now = holder(path);
		if (now?.pid === stale.pid && now.ino === stale.ino) rmSync(path, { recursive: true, force: true });
	} finally {
		unlinkSync(guard);
	}
}

type Holder = { readonly pid: number; readonly ino: number };

// Undefined when the file is gone; a file that names no pid (edited by hand), or that an earlier boot wrote, counts as a dead
// holder's, and so does a folder: `arthur continue` held its `continuing` as an empty folder before it named its pid.
function holder(path: string): Holder | undefined {
	try {
		const stats = statSync(path);
		const [text = "", boot, ...rest] = stats.isDirectory() ? [] : readFileSync(path, "utf8").trim().split(" ");
		const pid = Number(text);
		const thisBoot = boot === undefined || BOOT === "" || (boot === BOOT && rest.length === 0);
		return { pid: Number.isSafeInteger(pid) && pid > 0 && thisBoot ? pid : 0, ino: stats.ino };
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
