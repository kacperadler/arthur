import { spawnSync } from "node:child_process";
import { posix } from "node:path";
import type { Plugin, Ran } from "@arthur/core/plugin";
import { checkOptions } from "./nvm-options.ts";

// The nvm plugin (spec/roadmap.md, entry 84): a job whose worktree has `.nvmrc` gets the bin folder of the Node it names,
// as `nvm which` answers it on the job's machine, first on its PATH; `nvm.path` answers the same PATH for a project's checkout
// here, which `arthur merge` runs its checks on main with; a doctor line per machine says whether nvm is there. docs/nvm.md.

// One call on a machine: nvm.sh sourced and asked, nothing downloaded.
const LIMIT_SECONDS = 30;

// nvm from `$NVM_DIR`, else nvm's own default `~/.nvm`: a command over ssh and a systemd service have no NVM_DIR, and nvm.sh
// sourced by dash finds none of its versions without it. Exit 5 without nvm.
const NVM = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] || { echo "no $NVM_DIR/nvm.sh" >&2; exit 5; }; . "$NVM_DIR/nvm.sh" >/dev/null; command -v nvm >/dev/null || { echo "$NVM_DIR/nvm.sh defines no nvm" >&2; exit 5; }';

// In the worktree `$1`: nothing without `.nvmrc`; else the version, its first line that is neither blank nor a comment, then the
// PATH before nvm's, then what `nvm which` prints, the node last. Exit 3: unreadable, 4: no version, 5: no nvm, 6: not installed.
const WHICH = `cd "$1" || exit 2
[ -e .nvmrc ] || [ -L .nvmrc ] || exit 0
text=$(cat .nvmrc) || exit 3
version=$(printf '%s\\n' "$text" | sed -e 's/#.*//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e '/^$/d' | sed -n 1p)
[ -n "$version" ] || exit 4
printf '%s\\n%s\\n' "$version" "$PATH"
${NVM}
nvm which "$version" || exit 6`;

const INSTALL = "curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash";

const lastLine = (text: string) => text.trim().split("\n").at(-1)?.trim() ?? "";

// What WHICH answered in `worktree` on `machine`: "" without `.nvmrc`, else its Node's bin before `before` or the PATH it saw.
function nodePath(ran: Ran, worktree: string, machine: string, before?: string): string {
	const [file, where] = [`${worktree}/.nvmrc`, `machine ${machine}`];
	const [version = "", path = "", ...which] = ran.stdout.trim().split("\n");
	const said = lastLine(ran.stderr);
	if (ran.code === 0 && version === "") return "";
	if (ran.code === 0) return `${posix.dirname(which.at(-1)?.trim() ?? "")}:${before ?? path}`;
	if (ran.code === 3) throw new Error(`${file} on ${where} is unreadable: ${said}`);
	if (ran.code === 4) throw new Error(`${file} on ${where} names no Node version; write the project's, such as 24`);
	if (ran.code === 5) throw new Error(`nvm is missing on ${where} (${said}), which ${file} needs; fix: ${INSTALL}, then nvm install ${version} there`);
	if (ran.code === 6) throw new Error(`Node ${version}, which ${file} names, is not installed on ${where}; fix: nvm install ${version} there`);
	if (ran.code === null) throw new Error(`nvm which on ${where} timed out after ${LIMIT_SECONDS} s`);
	throw new Error(`nvm which on ${where} exited ${ran.code}: ${said}`);
}

export function nvm(options: { readonly enabled?: boolean } = {}): Plugin {
	return {
		name: "nvm",
		module: import.meta.url,
		options,
		check: checkOptions,
		setup(host) {
			// Prepares run in setup order: one after projects' install would leave it on the service's Node.
			if (host.collect("projects").length > 0) throw new Error("nvm is listed after projects, whose install would then run before nvm's PATH exists; list nvm() before projects in the plugins of arthur.config.ts");
			host.jobs.prepare(async (job, env) => {
				const PATH = nodePath(await host.jobs.run(job.machine, ["sh", "-c", WHICH, "nvm", job.worktree], LIMIT_SECONDS), job.worktree, job.machine, env.PATH);
				return PATH === "" ? undefined : { PATH };
			});
			// The PATH of `root`, a project's checkout here, which `arthur merge` (delivery) runs its steps on main with.
			host.provide("nvm.path", ({ root }: { readonly root: string }) => {
				const ran = spawnSync("sh", ["-c", WHICH, "nvm", root], { encoding: "utf8", timeout: LIMIT_SECONDS * 1000 });
				return nodePath({ code: ran.status, stdout: ran.stdout ?? "", stderr: ran.stderr ?? "" }, root, "local");
			});
			// One line per machine, asked when the doctor runs, so every machine another plugin registered is there.
			host.provide("doctor", () =>
				host.jobs.machines().map((name) => ({
					name,
					check: async () => {
						const ran = await host.jobs.run(name, ["sh", "-c", `${NVM}; nvm --version`], LIMIT_SECONDS);
						return ran.code === 0 ? `ok (nvm ${lastLine(ran.stdout)})` : `missing: ${lastLine(ran.stderr) || `exit code ${ran.code ?? "on a signal"}`}`;
					},
					costs: `a job on ${name} of a project with .nvmrc is refused`,
					fix: name === "local" ? INSTALL : `on ${name}: ${INSTALL}`,
					critical: false,
				})),
			);
		},
	};
}
