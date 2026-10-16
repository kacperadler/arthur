import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import envGuard, { envRefusal } from "../src/env-guard.ts";
import { temporaryFolder } from "../src/testing.ts";

// A project with a secrets file, its example and a plain file, and beside it one whose `.env` is a folder (a virtualenv).
function folders(): { readonly project: string; readonly venv: string } {
	const project = temporaryFolder();
	for (const name of [".env", ".env.example", ".env.local", "notes.txt"]) writeFileSync(join(project, name), "KEY=old\nOTHER=1\n");
	const venv = temporaryFolder();
	mkdirSync(join(venv, ".env", "bin"), { recursive: true });
	writeFileSync(join(venv, ".env", "bin", "activate"), "PATH=x\n");
	return { project, venv };
}

// Each call, and the file its refusal names: undefined when it is allowed.
const PROJECT: ReadonlyArray<readonly [string, Record<string, unknown>, string | undefined]> = [
	["bash", { command: "cat .env" }, ".env"],
	["bash", { command: "cat .e''nv" }, ".env"],
	["bash", { command: 'cat .e"n"v' }, ".env"],
	["bash", { command: "cat .\\env" }, ".env"],
	["bash", { command: "cat .e\\\nnv" }, ".env"],
	["bash", { command: "cat $'\\x2eenv'" }, ".env"],
	["bash", { command: "cat $'\\056e\\u006ev'" }, ".env"],
	["bash", { command: "cat .e${UNSET}nv" }, ".env"],
	["bash", { command: "cat ${X:-.e''nv}" }, ".env"],
	["bash", { command: 'cat "$HOME/x/.env"' }, "$HOME/x/.env"],
	["bash", { command: 'cat "$HOME/x/.e""nv"' }, "/x/.env"],
	["bash", { command: "docker run --env-file=.env alpine" }, ".env"],
	["bash", { command: "docker run --env-file=.e''nv alpine" }, ".env"],
	["bash", { command: "grep -f.env notes.txt" }, "-f.env"],
	["bash", { command: "cat .e*" }, ".env (through the glob .e*)"],
	["bash", { command: "cat .en?" }, ".env (through the glob .en?)"],
	["bash", { command: "cat .[e]nv" }, ".env (through the glob .[e]nv)"],
	["bash", { command: "cat ./.*" }, ".env (through the glob .*)"],
	["bash", { command: "cat .e*.local" }, ".env.local (through the glob .e*.local)"],
	["bash", { command: "cat .{env,x}" }, ".env"],
	["bash", { command: "cat .e{n,x}v" }, ".env"],
	["bash", { command: "cat $(echo .e''nv)" }, ".env"],
	["bash", { command: "cat `echo .e''nv`" }, ".env"],
	["bash", { command: "cat .env.local" }, ".env.local"],
	["bash", { command: "cat .ENV" }, ".ENV"],
	["bash", { command: "cat .env/" }, ".env"],
	["bash", { command: "set -a && . ./.env" }, "./.env"],
	["bash", { command: "sed -i 's/^KEY=.*/KEY=new/' .env && cat .env" }, ".env"],
	["bash", { command: "sed -i 's/^KEY=.*/KEY=new/p' .env" }, ".env"],
	["bash", { command: "sed -i 's/^KEY=.*/KEY=new/w /dev/stdout' .env" }, ".env"],
	["bash", { command: "sed -n 's/^KEY=.*/KEY=new/' .env" }, ".env"],
	["read", { path: ".env" }, ".env"],
	["read", { path: ".env:1-5" }, ".env"],
	["read", { path: ".env/" }, ".env"],
	["grep", { pattern: "KEY", path: ".env" }, ".env"],
	["grep", { pattern: "KEY", path: ".", glob: ".e*" }, ".env (through the glob .e*)"],
	["glob", { path: "**/.e*" }, ".env (through the glob .e*)"],
	["write", { path: ".env", content: "KEY=x\n" }, ".env"],
	["edit", { input: "[.env#1A2B]\nPUT 1.=1:\n+KEY=x" }, ".env"],
	["edit", { input: "[notes.txt#1A2B]\nMV .env" }, ".env"],
	["eval", { code: "print(open('.e''nv').read())" }, ".env"],
	["eval", { code: "print(open('\\x2eenv').read())" }, ".env"],
	["bash", { command: "cat .env.example" }, undefined],
	["bash", { command: "cat .envrc" }, undefined],
	["bash", { command: "ls .venv src/env.ts" }, undefined],
	["bash", { command: "node -e 'console.log(process.env.HOME)'" }, undefined],
	["bash", { command: "cat .env.example*" }, undefined],
	["bash", { command: "grep -n '.*' notes.txt" }, undefined],
	["bash", { command: "ls .e\\*" }, undefined],
	["bash", { command: "sed -i 's/^KEY=.*/KEY=new/' .env" }, undefined],
	["bash", { command: "sed -i.bak 's|^KEY=|KEY=new|g' ./.env.local" }, undefined],
	["read", { path: ".env.example" }, undefined],
	["grep", { pattern: "\\.env", path: "src" }, undefined],
	["write", { path: "notes.txt", content: "copy .env.example to .env\n" }, undefined],
	["edit", { input: "[notes.txt#1A2B]\nPUT 1.=1:\n+cat .env" }, undefined],
	["read", { path: "notes.txt", i: "Reading .env" }, undefined],
	["todo_write", { text: "read .env" }, undefined],
];

const VENV: ReadonlyArray<readonly [string, Record<string, unknown>, string | undefined]> = [
	["bash", { command: "ls .env/" }, undefined],
	["bash", { command: ". .env/bin/activate" }, undefined],
	["read", { path: ".env/bin/activate" }, undefined],
	["bash", { command: "cat .env/../.env" }, ".env/../.env"],
	["bash", { command: "cat .env" }, ".env"],
];

test("each call naming a secrets file is refused in one line that names the file; every other call passes", () => {
	const { project, venv } = folders();
	for (const [cwd, table] of [[project, PROJECT], [venv, VENV]] as const) {
		for (const [tool, input, file] of table) {
			const reason = envRefusal(tool, input, cwd);
			const call = `${tool} ${JSON.stringify(input)} in ${cwd === project ? "the project" : "the virtualenv"}`;
			if (file === undefined) assert.equal(reason, undefined, `${call} was refused: ${reason}`);
			else {
				assert.ok(reason?.startsWith(`arthur: refused: this call names the secrets file ${file}, `), `${call}: ${reason ?? "allowed"}`);
				assert.doesNotMatch(reason ?? "", /\n/);
			}
		}
	}
});

test("the one sed -i the guard lets through sets the key and prints nothing", () => {
	const { project } = folders();
	const command = "sed -i 's/^KEY=.*/KEY=new/' .env";
	assert.equal(envRefusal("bash", { command }, project), undefined);
	assert.equal(execFileSync("bash", ["-c", command], { cwd: project, encoding: "utf8" }), "");
	assert.equal(readFileSync(join(project, ".env"), "utf8"), "KEY=new\nOTHER=1\n");
});

test("as an OMP extension it blocks the tool call with the refusal, and lets others through", () => {
	type Handler = (event: { toolName: string; input: Record<string, unknown> }) => { block: true; reason: string } | undefined;
	let handler: Handler | undefined;
	envGuard({ on: (event, registered) => event === "tool_call" && (handler = registered) });
	assert.deepEqual(handler?.({ toolName: "bash", input: { command: "cat .e''nv" } }), {
		block: true,
		reason: "arthur: refused: this call names the secrets file .env, whose values no tool call may read; set one key with sed -i 's/^KEY=.*/KEY=value/' <file>, or ask the human",
	});
	assert.equal(handler?.({ toolName: "bash", input: { command: "cat .env.example" } }), undefined);
});
