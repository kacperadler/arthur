import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type TestContext, test } from "node:test";
import { fakeAgent, fakeHost, temporaryFolder } from "@arthur/core/testing";
import type { LoadedConfig } from "@arthur/core";
import { session } from "../src/session.ts";

const HOST = hostname();
const USER = userInfo().username;

async function until(what: string, holds: () => boolean): Promise<void> {
	for (const deadline = Date.now() + 20_000; !holds(); await sleep(50)) if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
}

// `systemctl` and `loginctl` first on PATH, each a script of `body`, until the test ends, which restores the PATH of the file's start.
const PATH = process.env.PATH;
function tools(t: TestContext, scripts: { readonly systemctl: string; readonly loginctl?: string }): void {
	const bin = temporaryFolder();
	for (const [name, body] of Object.entries(scripts)) writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
	t.after(() => void (process.env.PATH = PATH));
	process.env.PATH = [bin, PATH].join(delimiter);
}

// A user manager that answers `show arthur.service` as systemd 255 prints it (`-p` properties in its own order).
const manager = (unit: { readonly load: string; readonly file: string; readonly restart: string }) =>
	`[ "$2" = show-environment ] && { echo HOME=/home/arthur; exit 0; }
[ "$2" = show ] && [ "$3" = arthur.service ] && { printf 'Restart=%s\\nLoadState=%s\\nUnitFileState=%s\\n' '${unit.restart}' '${unit.load}' '${unit.file}'; exit 0; }
exit 1`;
const linger = (value: string) => `[ "$*" = "show-user ${USER} -p Linger --value" ] && echo ${value}`;

// The plugin's own doctor, read without its setup (it reads neither its options nor the core's); its setup provides none, so
// `arthur doctor` lists each once.
async function requirements() {
	const fake = fakeHost({ name: "session", options: { compactAt: [] } });
	await fake.setup(session({ compactAt: [] }));
	assert.deepEqual(fake.collect("doctor"), []);
	const list = (await session().doctor?.({}, {} as LoadedConfig["core"])) ?? [];
	return Promise.all(list.map(async (requirement) => [requirement.name, await requirement.check(), requirement.critical === true]));
}

test("doctor: the service installed, enabled, with Restart=always, and linger on are ok; neither is critical", async (t) => {
	tools(t, { systemctl: manager({ load: "loaded", file: "enabled", restart: "always" }), loginctl: linger("yes") });
	assert.deepEqual(await requirements(), [
		["service", "ok", false],
		["linger", "ok", false],
	]);
});

test("doctor: each way the service or linger is missing, with its reason", async (t) => {
	for (const [unit, reason] of [
		[{ load: "not-found", file: "", restart: "no" }, "missing: arthur.service is not installed"],
		[{ load: "loaded", file: "disabled", restart: "always" }, "missing: arthur.service is disabled, not enabled"],
		[{ load: "loaded", file: "", restart: "always" }, "missing: arthur.service is not enabled"],
		[{ load: "loaded", file: "enabled", restart: "on-failure" }, "missing: arthur.service has Restart=on-failure, not always"],
	] as const) {
		tools(t, { systemctl: manager(unit), loginctl: linger("no") });
		assert.deepEqual(await requirements(), [
			["service", reason, false],
			["linger", `missing: linger is off for ${USER}`, false],
		]);
	}
	tools(t, { systemctl: manager({ load: "loaded", file: "enabled", restart: "always" }), loginctl: `echo "Failed to get user: User ID 1000 is not logged in or lingering" >&2; exit 1` });
	assert.deepEqual((await requirements())[1], ["linger", `missing: loginctl show-user ${USER}: Failed to get user: User ID 1000 is not logged in or lingering`, false]);
});

test("doctor: no systemd user manager (macOS, a container) gives no session line; the core's says so once", async (t) => {
	tools(t, { systemctl: 'echo "Failed to connect to bus: No medium found" >&2; exit 1' });
	assert.deepEqual(await requirements(), []);
	process.env.PATH = temporaryFolder();
	assert.deepEqual(await requirements(), [], "no systemctl at all");
});

test("the start notice opens with the missing lines the core's doctor event sends; none, or a malformed event, leaves it as it was", async (t) => {
	const path = process.env.PATH;
	t.after(() => void (process.env.PATH = path));
	process.env.PATH = `${dirname(fakeAgent({ steps: [{ message: "Ready." }] }))}${delimiter}${path}`;
	const missing = ["core controllers: missing: no systemd user manager; without it: ...; fix: ...", "projects blog about: missing: no about; without it: ...; fix: ..."];
	for (const [data, text] of [
		[{ lines: missing }, [...missing, `coordinator up on ${HOST}`].join("\n")],
		[{ lines: [] }, `coordinator up on ${HOST}`],
		[{ lines: "not a list" }, `coordinator up on ${HOST}`],
		[undefined, `coordinator up on ${HOST}`],
	] as const) {
		const fake = fakeHost({ name: "session", options: { compactAt: [] } });
		const plugin = session({ compactAt: [] });
		await fake.setup(plugin);
		t.after(() => plugin.stop?.());
		if (data !== undefined) fake.emit("doctor", data);
		await plugin.start?.();
		const notices = () => fake.emitted.filter((event) => event.name === "notice").map((event) => (event.data as { text: string }).text);
		await until("the notice", () => notices().length === 1);
		assert.deepEqual(notices(), [text]);
	}
});
