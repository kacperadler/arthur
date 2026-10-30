import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { constants, tmpdir } from "node:os";
import { join } from "node:path";

// The test kit's environment, set before the rest of the kit loads: every `ARTHUR_` and tmux session variable is cleared, and the kit's `root`, a new folder in `tmpdir()`, holds tmux's default socket, `XDG_CONFIG_HOME` (the env file's default place), `HOME`, `TMPDIR` and
// `GIT_CONFIG_GLOBAL`, a git identity of its own, so no test reads or writes the real ones. SIGTERM, SIGINT and SIGHUP end the process through its exit cleanup (code 128 + the signal's number) unless another handler takes the signal.
for (const key of Object.keys(process.env)) if (key.startsWith("ARTHUR_") || key === "TMUX" || key === "TMUX_PANE") delete process.env[key];
export const root = mkdtempSync(join(tmpdir(), "arthur-test-"));
for (const folder of ["home", "tmp"]) mkdirSync(join(root, folder));
writeFileSync(join(root, "gitconfig"), "[user]\n\tname = test\n\temail = test@example.com\n");
Object.assign(process.env, { TMUX_TMPDIR: root, XDG_CONFIG_HOME: root, HOME: join(root, "home"), TMPDIR: join(root, "tmp"), GIT_CONFIG_GLOBAL: join(root, "gitconfig") });
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) process.on(signal, () => process.listenerCount(signal) === 1 && process.exit(128 + constants.signals[signal]));
