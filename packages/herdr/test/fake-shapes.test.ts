import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fakeHerdr } from "./fake-herdr.ts";

// The keys of each answer, recorded in herdr-shapes.json from `herdr api schema --json` of herdr 0.9.3 (its `success_response`
// and `error_response`), which runs without a server. The fake changes shape only through a reviewed change of that file.
const { shapes } = JSON.parse(readFileSync(new URL("herdr-shapes.json", import.meta.url), "utf8")) as { shapes: Record<string, unknown> };

// Each key path where `got` and the recorded `shape` differ: `-` a key the record shows and the fake leaves out, `+` one the
// fake adds, or a list or object the fake answers as something else. Each item of a list is held to the recorded first
// item; a null on either side, or a value recorded as neither list nor object, is not compared.
const drift = (got: unknown, shape: unknown, at = ""): string[] => {
	if (got === null || shape === null || typeof shape !== "object") return [];
	if (Array.isArray(shape)) return Array.isArray(got) ? got.flatMap((item, index) => drift(item, shape[0], `${at}[${index}]`)) : [`${at}: not a list`];
	if (typeof got !== "object" || Array.isArray(got)) return [`${at}: not an object`];
	const [has, shown] = [got as Record<string, unknown>, shape as Record<string, unknown>];
	return [
		...Object.keys(shown).filter((key) => !(key in has)).map((key) => `- ${at}.${key}`),
		...Object.keys(has).filter((key) => !(key in shown)).map((key) => `+ ${at}.${key}`),
		...Object.keys(shown).filter((key) => key in has).flatMap((key) => drift(has[key], shown[key], `${at}.${key}`)),
	];
};

test("every command of the fake herdr answers with the keys herdr 0.9.3's API schema shows, at every depth, and a refusal as its error_response", () => {
	const server = fakeHerdr();
	const herdr = (...args: string[]): unknown => JSON.parse(execFileSync(join(server.folder, "herdr"), args, { encoding: "utf8" }));
	const created = herdr("workspace", "create", "--label", "arthur", "--cwd", "/srv", "--no-focus") as { result: { workspace: { workspace_id: string }; tab: { tab_id: string }; root_pane: { pane_id: string } } };
	const { workspace, tab, root_pane: pane } = created.result;
	const made = herdr("tab", "create", "--workspace", workspace.workspace_id, "--label", "worker 0000000a", "--cwd", "/srv", "--no-focus") as { result: { tab: { tab_id: string } } };
	const answers: [string, unknown][] = [
		["workspace_created", created],
		["workspace_list", herdr("workspace", "list")],
		["tab_created", made],
		["tab_list", herdr("tab", "list", "--workspace", workspace.workspace_id)],
		["tab_info", herdr("tab", "rename", tab.tab_id, "coordinator")],
		["ok", herdr("pane", "run", pane.pane_id, "arthur attach")],
		["ok", herdr("pane", "report-agent", pane.pane_id, "--source", "arthur", "--agent", "arthur", "--state", "working")],
		["pane_list", herdr("pane", "list", "--workspace", workspace.workspace_id)],
		["ok", herdr("tab", "close", made.result.tab.tab_id)],
	];
	const refused = spawnSync(join(server.folder, "herdr"), ["tab", "close", made.result.tab.tab_id], { encoding: "utf8" });
	assert.deepEqual([refused.status, refused.stdout], [1, ""]);
	answers.push(["error", JSON.parse(refused.stderr)]);
	assert.deepEqual(answers.map(([name, got]) => [name, (got as { result?: { type?: string } }).result?.type]).filter(([name, type]) => name !== "error" && name !== type), [], "each answer's type is its shape's name");
	assert.deepEqual(
		answers.flatMap(([name, got]) => (name in shapes ? drift(got, shapes[name], name) : [`${name} not recorded`])),
		[],
	);
});
