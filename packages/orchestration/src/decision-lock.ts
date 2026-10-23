import { join } from "node:path";
import { queueLock, takeLock, type withLock } from "@arthur/core/lock";
import type { Host, Project } from "@arthur/core/plugin";

// The decision log's lock, one per project in the plugin's folder. A command takes it with `withLock`, which blocks its
// process for a moment; the plugin's own handlers take it with `queued`, so another process holding it never stalls
// `arthur run`.

export const logLock = (host: Host, project: Project) => join(host.folder, `decisions-${project.name.replace(/[^\w-]/g, "_")}.lock`);

// Runs `write` under the lock, handing it the lock to pass the log's writers: at once when the lock is free, so a wake built
// right after the event reads what it wrote; else once `queueLock` gets it, the process going on meanwhile.
export function queued<T>(host: Host, project: Project, write: (lock: typeof withLock) => T): T | Promise<T> {
	const path = logLock(host, project);
	const now = takeLock(path);
	const under = (release: () => void) => {
		try {
			return write((_path, run) => run());
		} finally {
			release();
		}
	};
	return "release" in now ? under(now.release) : queueLock(path).then(under);
}
