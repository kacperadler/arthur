import { posix } from "node:path";
import type { Plugin } from "@arthur/core/plugin";
import { checkOptions } from "./nvm-options.ts";

// The nvm plugin (spec/roadmap.md, entry 84): a job whose worktree has `.nvmrc` gets the bin folder of the Node it names,
// as `nvm which` answers it on the job's machine, first on its PATH; a doctor line per machine says whether nvm is there.
// docs/nvm.md.

// One call on a machine: nvm.sh sourced and asked, nothing downloaded.
const LIMIT_SECONDS = 30;

// nvm from `$NVM_DIR`, else nvm's own default `~/.nvm`: a command over ssh and a systemd service have no NVM_DIR. Exit 5 without it.
const NVM = 'dir=${NVM_DIR:-$HOME/.nvm}; [ -s "$dir/nvm.sh" ] || { echo "no $dir/nvm.sh" >&2; exit 5; }; . "$dir/nvm.sh" >/dev/null; command -v nvm >/dev/null || { echo "$dir/nvm.sh defines no nvm" >&2; exit 5; }';

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

export function nvm(options: { readonly enabled?: boolean } = {}): Plugin {
	return {
		name: "nvm",
		options,
		check: checkOptions,
		setup(host) {
			host.jobs.prepare(async (job, env) => {
				const [file, machine] = [`${job.worktree}/.nvmrc`, `machine ${job.machine}`];
				const ran = await host.jobs.run(job.machine, ["sh", "-c", WHICH, "nvm", job.worktree], LIMIT_SECONDS);
				const [version = "", path = "", ...which] = ran.stdout.trim().split("\n");
				const said = lastLine(ran.stderr);
				if (ran.code === 0 && version === "") return undefined;
				if (ran.code === 0) return { PATH: `${posix.dirname(which.at(-1)?.trim() ?? "")}:${env.PATH ?? path}` };
				if (ran.code === 3) throw new Error(`${file} on ${machine} is unreadable: ${said}`);
				if (ran.code === 4) throw new Error(`${file} on ${machine} names no Node version; write the project's, such as 24`);
				if (ran.code === 5) throw new Error(`nvm is missing on ${machine} (${said}), which ${file} needs; fix: ${INSTALL}, then nvm install ${version} there`);
				if (ran.code === 6) throw new Error(`Node ${version}, which ${file} names, is not installed on ${machine}; fix: nvm install ${version} there`);
				if (ran.code === null) throw new Error(`nvm which on ${machine} timed out after ${LIMIT_SECONDS} s`);
				throw new Error(`nvm which on ${machine} exited ${ran.code}: ${said}`);
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
