import { spawnSync } from "node:child_process";

// When the test `t` ends, passed or failed: `supervisor` (the plugin, or one `supervise` made) is stopped, so it starts no
// coordinator again, then the tmux server on `socket` is killed with the fake agent in its pane, also when that stop failed,
// whose error is then the test's. A test that starts a coordinator's session calls it once per supervisor it makes.
export function endCoordinator(t: { after(hook: () => Promise<void>): void }, socket: string, supervisor: { stop?(): Promise<void> | void }): void {
	t.after(async () => {
		try {
			await supervisor.stop?.();
		} finally {
			spawnSync("tmux", [socket.includes("/") ? "-S" : "-L", socket, "kill-server"]);
		}
	});
}
