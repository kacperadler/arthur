import type { Host, Ran, Requirement } from "@arthur/core/plugin";

// The docker plugin's `arthur doctor` lines (spec/roadmap.md, entries 70 and 80): one per machine labelled `tools: docker`,
// whether Docker answers there as the user Arthur runs as, without sudo, and is not unsafe. docs/docker.md, "arthur doctor".

// Under the core doctor's own 10 s cut, so a hung machine gets this line's reason and fix.
const LIMIT_SECONDS = 5;
const INSTALL = "install Docker Engine there (https://docs.docker.com/engine/install/), or drop docker from its tools label";

// Exit 4: Arthur's user there is root; 3: no docker; 0: Docker's version, then its security options and warnings, a JSON line
// each; 5: docker info failed and the context's Unix socket is there but not writable, its path printed; else 6.
const PROBE = `[ "$(id -u)" != 0 ] || exit 4
command -v docker >/dev/null || exit 3
docker info --format '{{.ServerVersion}}{{"\\n"}}{{json .SecurityOptions}}{{"\\n"}}{{json .Warnings}}' && exit 0
socket=$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null)
case $socket in unix://*) socket=\${socket#unix://}; if [ -e "$socket" ] && [ ! -w "$socket" ]; then echo "$socket"; exit 5; fi;; esac
exit 6`;

// The line of `machine` from what PROBE answered there, and its fix.
function verdict(ran: Ran, machine: string): readonly [line: string, fix: string] {
	const said = ran.stderr.trim().split("\n").at(-1) || `exit code ${ran.code}`;
	if (ran.code === 4) return [`missing: unsafe: Arthur runs as root on ${machine}, so each job's docker would be root's`, `run Arthur on ${machine} as an ordinary user in the docker group, or with rootless Docker`];
	if (ran.code === 3) return [`missing: command -v finds no docker on ${machine}`, INSTALL];
	if (ran.code === 5) return [`missing: unsafe: the Docker socket ${ran.stdout.trim()} on ${machine} is reachable only through sudo`, `on ${machine}: sudo usermod -aG docker "$USER", then log in again; or rootless Docker (dockerd-rootless-setuptool.sh install)`];
	if (ran.code === null) return [`missing: docker info on ${machine} timed out after ${LIMIT_SECONDS} s`, `start Docker on ${machine}: sudo systemctl start docker`];
	if (ran.code !== 0) return [`missing: docker info failed on ${machine}: ${said}`, `start Docker on ${machine} (sudo systemctl start docker), or reach ${machine} over ssh by hand`];
	// A JSON line each, Docker's `null` an empty list; what is no JSON throws, which the doctor names as this line's failure.
	const [version = "", options = "", warnings = ""] = ran.stdout.trim().split("\n");
	const [security, warned]: unknown[] = [JSON.parse(options) ?? [], JSON.parse(warnings) ?? []];
	if (!Array.isArray(security) || !Array.isArray(warned)) return [`missing: docker info on ${machine} answered ${JSON.stringify(ran.stdout.trim().slice(0, 80))}, not its JSON`, INSTALL];
	const open = warned.find((warning) => /API is accessible on http:\/\//.test(String(warning)));
	if (open !== undefined) return [`missing: unsafe: the Docker daemon on ${machine} listens on TCP without TLS (${String(open).split("\n")[0]})`, `on ${machine}: remove the tcp:// host from dockerd's -H or daemon.json "hosts", or give it TLS (--tlsverify)`];
	return [`ok (Docker ${version}${security.includes("name=rootless") ? ", rootless" : ""})`, ""];
}

export function dockerDoctor(host: Host, docker: (machine: string) => unknown): Requirement[] {
	return host.jobs.machines().filter((name) => docker(name) !== undefined).map((name) => {
		let fix = INSTALL;
		return {
			name,
			check: async () => {
				const [line, how] = verdict(await host.jobs.run(name, ["sh", "-c", PROBE], LIMIT_SECONDS), name);
				fix = how;
				return line;
			},
			costs: `the jobs on ${name} cannot use Docker, or reach the machine's root through it`,
			get fix() {
				return fix;
			},
			critical: false,
		};
	});
}
