import { loadConfig } from "@arthur/core";
import { jobSlice } from "@arthur/core/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";

const root = mkdtempSync(join(tmpdir(), "arthur-config-test-"));
after(() => rmSync(root, { recursive: true, force: true }));

// Each config gets its own folder: Node caches a module by its path, so a path is never reused.
let count = 0;
function configFile(source: string): string {
	const folder = join(root, String(++count));
	const file = join(folder, "arthur.config.ts");
	mkdirSync(folder);
	writeFileSync(file, source);
	return file;
}

const withCore = (core: string) => configFile(`export default { core: ${core}, plugins: [] };\n`);

async function refusal(file: string): Promise<string> {
	try {
		await loadConfig(file);
	} catch (error) {
		return (error as Error).message;
	}
	assert.fail(`${file} loaded, expected a refusal`);
}

test("a config without core options loads with every default filled", async () => {
	const file = configFile("export default { plugins: [] };\n");
	const config = await loadConfig(file);
	assert.deepEqual(config, {
		path: file,
		core: {
			home: join(dirname(file), ".arthur"),
			envFile: join(dirname(file), ".env"),
			agent: { command: "omp" },
			timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			quietHours: undefined,
			jobs: { timeoutMinutes: 120, budgetUsd: 2, cpu: Math.max(1, availableParallelism() - 1), memory: "70%" },
		},
		plugins: [],
	});
});

test("given options are kept; relative paths are taken from the config's folder, absolute ones as they are", async () => {
	const file = configFile(`const minutes: number = 0; // a type annotation: the file is TypeScript
export default {
	core: {
		home: "state/arthur",
		envFile: "/etc/arthur/.env",
		agent: { command: "/usr/local/bin/omp" },
		timeZone: "Europe/Warsaw",
		quietHours: { from: "22:00", to: "07:30" },
		jobs: { timeoutMinutes: minutes, budgetUsd: 0, cpu: 0.5, memory: "8G" },
	},
	plugins: [{ name: "fake" }],
};
`);
	const config = await loadConfig(file);
	assert.deepEqual(config.core, {
		home: join(dirname(file), "state", "arthur"),
		envFile: "/etc/arthur/.env",
		agent: { command: "/usr/local/bin/omp" },
		timeZone: "Europe/Warsaw",
		quietHours: { from: "22:00", to: "07:30" },
		jobs: { timeoutMinutes: 0, budgetUsd: 0, cpu: 0.5, memory: "8G" },
	});
	assert.deepEqual(config.plugins, [{ name: "fake" }]);
});

test("an option set to undefined takes its default", async () => {
	const config = await loadConfig(withCore("{ timeZone: undefined, jobs: { cpu: undefined, budgetUsd: 3 } }"));
	assert.equal(config.core.jobs.cpu, Math.max(1, availableParallelism() - 1));
	assert.equal(config.core.jobs.budgetUsd, 3);
	assert.equal(config.core.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test("an unknown option is refused at every level, naming its path and the options there are", async () => {
	const top = await refusal(configFile("export default { core: {}, plugin: [] };\n"));
	assert.match(top, /: plugin: unknown option; expected one of core, plugins$/);
	const core = await refusal(withCore('{ homeDir: ".arthur" }'));
	assert.match(core, /: core\.homeDir: unknown option; expected one of home, envFile, agent, timeZone, quietHours, jobs$/);
	const jobs = await refusal(withCore("{ jobs: { idleMinutes: 10 } }"));
	assert.match(jobs, /: core\.jobs\.idleMinutes: unknown option; expected one of timeoutMinutes, budgetUsd, cpu, memory$/);
});

test("a wrong type is refused, naming the path, what was expected and what was given", async () => {
	const cases: ReadonlyArray<readonly [string, RegExp]> = [
		["{ home: 5 }", /: core\.home: expected a non-empty string, got 5$/],
		['{ envFile: "" }', /: core\.envFile: expected a non-empty string, got ""$/],
		['{ agent: "omp" }', /: core\.agent: expected an object, got "omp"$/],
		["{ agent: { command: null } }", /: core\.agent\.command: expected a non-empty string, got null$/],
		["{ jobs: [] }", /: core\.jobs: expected an object, got a list$/],
		['{ jobs: { budgetUsd: "2" } }', /: core\.jobs\.budgetUsd: expected a number of 0 or more, got "2"$/],
		["{ jobs: { timeoutMinutes: Infinity } }", /: core\.jobs\.timeoutMinutes: expected a number of 0 or more, got Infinity$/],
		["{ jobs: { cpu: 0 } }", /: core\.jobs\.cpu: expected a number above 0, got 0$/],
		["{ jobs: { memory: 70 } }", /: core\.jobs\.memory: expected systemd MemoryMax syntax .*, got 70$/],
		['{ jobs: { memory: "101%" } }', /: core\.jobs\.memory: expected systemd MemoryMax syntax .*, got "101%"$/],
		['{ jobs: { memory: "lots" } }', /: core\.jobs\.memory: expected systemd MemoryMax syntax .*, got "lots"$/],
	];
	for (const [core, expected] of cases) assert.match(await refusal(withCore(core)), expected, core);
	assert.match(await refusal(configFile('export default "core";\n')), /: default export: expected an object from defineConfig\(\{ \.\.\. \}\), got "core"$/);
	assert.match(await refusal(configFile("export const core = {};\n")), /: default export: expected an object .*, got nothing$/);
	assert.match(await refusal(configFile("export default { core: [] };\n")), /: core: expected an object, got a list$/);
	assert.match(await refusal(configFile("export default { plugins: {} };\n")), /: plugins: expected a list, got an object$/);
});

// The values at each edge of systemd's MemoryMax: what systemd takes loads, what it refuses is refused at load. Where a user
// manager runs, systemd itself is asked the same of each value, on the kit's test slice.
const TAKEN = ["100%", "100.00%", "0.01%", "0.5%", "1", "1.5", "1024", "0.01K", "512M", "1.5G", "2T", "8388607.99T", "infinity"];
const REFUSED = ["0", "0.5", "0K", "0%", "0.00%", "50.555%", "101%", "100.01%", ".5G", "8g", "1.5.5G", "16777216T", "99999999999999999999", "lots"];

test("memory loads what systemd's MemoryMax takes and is refused at load for what systemd refuses", async () => {
	for (const memory of TAKEN) assert.equal((await loadConfig(withCore(`{ jobs: { memory: "${memory}" } }`))).core.jobs.memory, memory);
	// Refused although systemd takes them: 2^63 bytes, and an empty value, which resets the limit to none.
	for (const memory of [...REFUSED, "8388608T", ""]) assert.match(await refusal(withCore(`{ jobs: { memory: "${memory}" } }`)), /: core\.jobs\.memory: expected systemd MemoryMax syntax/, memory);
	if (spawnSync("systemctl", ["--user", "show-environment"]).status !== 0) return;
	const set = (memory: string) => spawnSync("systemctl", ["--user", "set-property", "--runtime", `${jobSlice.slice}.slice`, `MemoryMax=${memory}`]).status;
	for (const memory of TAKEN) assert.equal(set(memory), 0, `systemd refuses ${memory}`);
	for (const memory of REFUSED) assert.notEqual(set(memory), 0, `systemd takes ${memory}`);
});

test("an unknown time zone is refused", async () => {
	for (const zone of ["Mars/Olympus", "Warsaw", ""]) {
		const message = await refusal(withCore(`{ timeZone: "${zone}" }`));
		assert.match(message, new RegExp(`: core\\.timeZone: expected a time zone such as Europe/Warsaw, got "${zone}"$`));
	}
	assert.equal((await loadConfig(withCore('{ timeZone: "UTC" }'))).core.timeZone, "UTC");
});

test('a quietHours time that is not "HH:MM" is refused, and so is a missing one', async () => {
	for (const time of ["7:30", "24:00", "22:60", "22:00:00", "noon"]) {
		const message = await refusal(withCore(`{ quietHours: { from: "${time}", to: "07:30" } }`));
		assert.match(message, new RegExp(`: core\\.quietHours\\.from: expected a time "HH:MM" from 00:00 to 23:59, got "${time}"$`));
	}
	const missing = await refusal(withCore('{ quietHours: { from: "22:00" } }'));
	assert.match(missing, /: core\.quietHours\.to: expected a time "HH:MM" from 00:00 to 23:59, got nothing$/);
	const edges = await loadConfig(withCore('{ quietHours: { from: "00:00", to: "23:59" } }'));
	assert.deepEqual(edges.core.quietHours, { from: "00:00", to: "23:59" });
});

test("a negative budget or timeout is refused; 0 is accepted", async () => {
	for (const key of ["budgetUsd", "timeoutMinutes"]) {
		const message = await refusal(withCore(`{ jobs: { ${key}: -0.01 } }`));
		assert.match(message, new RegExp(`: core\\.jobs\\.${key}: expected a number of 0 or more, got -0\\.01$`));
		assert.equal((await loadConfig(withCore(`{ jobs: { ${key}: 0 } }`))).core.jobs[key as "budgetUsd" | "timeoutMinutes"], 0);
	}
});

test("every problem is named, one line each, starting with the config file", async () => {
	const file = withCore('{ home: 1, timeZone: "Nowhere", jobs: { budgetUsd: -1, extra: true } }');
	const lines = (await refusal(file)).split("\n");
	assert.deepEqual(lines, [
		`${file}: core.home: expected a non-empty string, got 1`,
		`${file}: core.timeZone: expected a time zone such as Europe/Warsaw, got "Nowhere"`,
		`${file}: core.jobs.extra: unknown option; expected one of timeoutMinutes, budgetUsd, cpu, memory`,
		`${file}: core.jobs.budgetUsd: expected a number of 0 or more, got -1`,
	]);
});

test("a missing config file names the path looked at", async () => {
	const missing = join(root, "nowhere", "arthur.config.ts");
	await assert.rejects(loadConfig(missing), { message: `config file not found: ${missing}` });
});

test("a relative path is looked up from the working folder", async () => {
	await assert.rejects(loadConfig("no-such-arthur.config.ts"), {
		message: `config file not found: ${join(process.cwd(), "no-such-arthur.config.ts")}`,
	});
});

test("a config file that throws names the file and its error", async () => {
	const throwing = configFile('throw new Error("ARTHUR_HOME is not a path");\n');
	await assert.rejects(loadConfig(throwing), { message: `config file ${throwing} failed to load: ARTHUR_HOME is not a path` });
	const broken = configFile("export default { core: { ;\n");
	await assert.rejects(loadConfig(broken), (error: Error) => error.message.startsWith(`config file ${broken} failed to load: `));
});
