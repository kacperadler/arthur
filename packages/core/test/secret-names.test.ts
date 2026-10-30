import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { readEvents } from "../src/event-log.ts";
import { namedChunks, secretNames } from "../src/secret-names.ts";
import { fakeAgent, jobSlice, temporaryFolder, until } from "../src/testing.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const NAME = "ARTHUR_ORCHESTRATION_TOKEN";

// Two plugins as a config holds them. `orchestration` names the token in `tokenEnv`, provides the repository as the one project,
// an install that prints the token, and `token.check`, a plugin call that fails with the token in its error, as an API's 401 may;
// `boom` makes that call from the shell and as a phone command, `say` emits a notice holding the token, `hold` blocks a job on it.
// `channel` is the fake channel: each notice it hears, each `arthur send` and its reply to `/boom` (`poll`) go to the file `sent`,
// one JSON line each.
function config(sent: string, envFile: string, agent: string): string {
	return `import { appendFileSync } from "node:fs";
const doc = new URL("./doc.md", import.meta.url);
const sent = (message) => appendFileSync(${JSON.stringify(sent)}, JSON.stringify(message) + "\\n");
export default { core: { timeZone: "UTC", jobs: { unsandboxed: true }, envFile: ${JSON.stringify(envFile)}, agent: { command: ${JSON.stringify(agent)} } }, plugins: [
	{ name: "orchestration", options: { tokenEnv: "${NAME}" }, setup(host) {
		const token = host.env.${NAME};
		host.provide("projects", () => [{ name: "acme", path: import.meta.dirname, prefix: "AC" }]);
		host.jobs.prepare(() => ({ ARTHUR_INSTALL: "printf 'piece %s' " + token.slice(0, 10) + "; sleep 0.3; printf '%s whole\\\\n' " + token.slice(10) + "; echo installed for " + token + "; printf 'then %s' " + token.slice(0, 10) }));
		host.provide("prompt", () => "Use the token " + token + " for the API.");
		host.provide("token.check", () => { throw new Error("401 Unauthorized: the token " + token + " was refused"); });
		host.commands.register({ name: "boom", doc, run: () => host.call("token.check"), phone: { about: "checks the token", reply: () => host.call("token.check") } });
		host.commands.register({ name: "say", doc, run: () => void host.events.emit("notice", { text: "the token is " + token }) });
		host.commands.register({ name: "hold", doc, run: ({ args }) => host.jobs.block(args[0], "waits on " + token) });
	} },
	{ name: "channel", setup(host) {
		host.events.on("notice", (event) => sent(event.data));
		host.provide("channel.send", (message) => () => (sent(message), "sent"));
		host.commands.register({ name: "poll", doc, run: async () => sent(await host.commands.route("/boom")) });
	} },
] };
`;
}

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

// Without the user manager's variables, so a job runs bare, and with the kit's slice, so it never joins Arthur's own.
function arthur(root: string, ...args: string[]): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
	return spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: "utf8", env: { PATH: process.env.PATH ?? "", XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, ARTHUR_JOB_SLICE: jobSlice.slice } });
}

const files = (folder: string): string[] => readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));

test("a token of the env file never lands under the home, in a line the CLI prints, nor in a channel's message: its variable's name does", async () => {
	const token = `t0ken-${randomBytes(12).toString("hex")}`;
	const secrets = temporaryFolder();
	writeFileSync(join(secrets, "env"), `${NAME}=${token}\n`);
	const [gate, sent] = [join(secrets, "go"), join(secrets, "sent.jsonl")];
	// An agent that came by the token (a prepare's variable it prints, a tool's output) says it on stdout, on stderr (once split
	// across two writes) and in its final message, which blocks it on the owner with the token in the question.
	const played = fakeAgent({ steps: [{ stdout: `calling with ${token}` }, { stderr: `401 for ${token}` }, { waitFor: gate }, { message: `Blocked: user is ${token} still valid?` }] });
	const agent = join(secrets, "omp");
	// Its stderr ends on the token's first characters, which wait for the pipe's end.
	writeFileSync(agent, `#!/bin/sh\nprintf 'split ${token.slice(0, 10)}' >&2\nsleep 0.3\nprintf '${token.slice(10)} ends\\n' >&2\n'${played}' "$@"\ncode=$?\nprintf 'last ${token.slice(0, 10)}' >&2\nexit $code\n`, { mode: 0o755 });
	const root = join(temporaryFolder(), "acme");
	mkdirSync(root);
	writeFileSync(join(root, ".gitignore"), ".arthur/\n");
	git(dirname(root), "init", "--quiet", "--initial-branch=main", root);
	git(root, "add", "--all");
	git(root, "-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "first");
	writeFileSync(join(root, "arthur.config.ts"), config(sent, join(secrets, "env"), agent));
	writeFileSync(join(root, "doc.md"), "# arthur\n");
	const home = join(root, ".arthur");
	const ended = (count: number) => readEvents(home, 1).filter((event) => event.name === "job-ended").length === count;
	const runs = [arthur(root, "spawn", `Call the API with the token ${token}.`)];
	const id = runs[0]?.stdout.trim() ?? "";
	assert.match(id, /^\d{4}-\d\d-\d\d-worker-[0-9a-f]{8}$/, runs[0]?.stderr);
	const record = (name: string) => readFileSync(join(home, "jobs", id, name), "utf8");
	// Its stdout line: the last characters of stderr wait for more output or the pipe's end (`namedChunks`).
	await until("the agent's output in the log", () => existsSync(join(home, "jobs", id, "log")) && readFileSync(join(home, "jobs", id, "log"), "utf8").includes(`calling with ${NAME}`));
	runs.push(arthur(root, "steer", id, `Use ${token} only once.`), arthur(root, "hold", id));
	// The hold's reason, which the run's end replaces.
	assert.deepEqual([record("hold"), record("reason")], [`waits on ${NAME}`, `dependency: waits on ${NAME}`]);
	writeFileSync(gate, "");
	await until("the job's end", () => ended(1));
	runs.push(arthur(root, "continue", id, `Go on with ${token}.`));
	await until("the continued job's end", () => ended(2));
	runs.push(arthur(root, "boom"), arthur(root, "poll"), arthur(root, "say"), arthur(root, "send", join(root, "doc.md"), "--caption", `the token ${token}`));
	assert.deepEqual([record("task"), record("reason")], [`Call the API with the token ${NAME}.`, `user: is ${NAME} still valid?`]);
	assert.match(record("prompt"), new RegExp(`Use the token ${NAME} for the API\\.`));
	const start = token.slice(0, 10);
	assert.match(record("log"), new RegExp(`install: printf [\\s\\S]*\npiece ${NAME} whole\ninstalled for ${NAME}\nthen ${start}\\[arthur [\\s\\S]*split ${NAME} ends\n[\\s\\S]*calling with ${NAME}\n[\\s\\S]*401 for ${NAME}\n[\\s\\S]*last ${start}[\\s\\S]*arthur continue: Go on with ${NAME}\\.\n`));
	assert.deepEqual(files(join(home, "jobs", id, "steer")).map((file) => readFileSync(file, "utf8")).filter((text) => text.includes("only once")), [`Use ${NAME} only once.\n`]);
	assert.match(runs[4]?.stderr ?? "", new RegExp(`^arthur boom: 401 Unauthorized: the token ${NAME} was refused\n$`));
	assert.deepEqual(readFileSync(sent, "utf8").trimEnd().split("\n").map((line) => JSON.parse(line)), [
		`/boom failed: 401 Unauthorized: the token ${NAME} was refused`,
		{ text: `the token is ${NAME}` },
		{ files: [join(root, "doc.md")], caption: `the token ${NAME}` },
	]);
	for (const run of runs) assert.ok(!`${run.stdout}${run.stderr}`.includes(token), `${run.stdout}${run.stderr}`);
	const written = files(home);
	assert.ok(written.length > 20, written.join("\n"));
	for (const file of written) assert.ok(!readFileSync(file, "utf8").includes(token), file);
});

test("a plugin's setup that fails with the token says its name in every command's line, the error and the list's reason", () => {
	const secrets = temporaryFolder();
	writeFileSync(join(secrets, "env"), `${NAME}=supersecret-value-123\n`);
	const root = temporaryFolder();
	writeFileSync(join(root, "arthur.config.ts"), `export default { core: { envFile: ${JSON.stringify(join(secrets, "env"))} }, plugins: [{ name: "orchestration", options: { tokenEnv: "${NAME}" }, setup(host) { throw new Error("setup failed with " + host.env.${NAME}); } }] };\n`);
	const line = `plugin orchestration: setup failed: setup failed with ${NAME}`;
	for (const args of [["spawn", "hello"], ["help"]]) {
		const run = arthur(root, ...args);
		assert.ok(run.stderr.includes(line), run.stderr);
		assert.ok(!`${run.stdout}${run.stderr}`.includes("supersecret-value-123"), `${run.stdout}${run.stderr}`);
	}
});

test("an uncaught exception, an unhandled rejection and bytes written by a plugin say the token's name; the first two exit 1", () => {
	const secrets = temporaryFolder();
	writeFileSync(join(secrets, "env"), `${NAME}=supersecret-value-123\n`);
	const root = temporaryFolder();
	writeFileSync(join(root, "doc.md"), "# arthur\n");
	const wait = "new Promise((done) => setTimeout(done, 5000))";
	writeFileSync(join(root, "arthur.config.ts"), `const doc = new URL("./doc.md", import.meta.url);
export default { core: { envFile: ${JSON.stringify(join(secrets, "env"))} }, plugins: [{ name: "orchestration", options: { tokenEnv: "${NAME}" }, setup(host) {
	const token = host.env.${NAME};
	host.commands.register({ name: "later", doc, run: () => (setTimeout(() => { throw new Error("later " + token); }, 10), ${wait}) });
	host.commands.register({ name: "rejects", doc, run: () => (void Promise.reject(new Error("rejected " + token)), ${wait}) });
	host.commands.register({ name: "bytes", doc, run: () => void process.stdout.write(Buffer.from("buf " + token + " ä\\n")) });
} }] };
`);
	const later = arthur(root, "later"), rejects = arthur(root, "rejects"), bytes = arthur(root, "bytes");
	assert.deepEqual([later.status, later.stderr.split("\n")[0]], [1, `Error: later ${NAME}`]);
	assert.deepEqual([rejects.status, rejects.stderr.split("\n")[0]], [1, `Error: rejected ${NAME}`]);
	assert.deepEqual([bytes.status, bytes.stdout], [0, `buf ${NAME} ä\n`]);
	for (const run of [later, rejects, bytes]) assert.ok(!`${run.stdout}${run.stderr}`.includes("supersecret-value-123"), `${run.stdout}${run.stderr}`);
});

test("each value of 8 characters or more becomes its name, the longest first, whatever characters it holds; a shorter one stays", () => {
	const hide = secretNames({ ARTHUR_A_KEY: "a+b.c*d?(e)$&", ARTHUR_A_LONG: "a+b.c*d?(e)$&-and-more", ARTHUR_A_PIN: "1234567", ARTHUR_A_CODE: "12345678" });
	assert.equal(hide("x a+b.c*d?(e)$&-and-more y a+b.c*d?(e)$& z 1234567 12345678 abXcYd"), "x ARTHUR_A_LONG y ARTHUR_A_KEY z 1234567 ARTHUR_A_CODE abXcYd");
	assert.deepEqual(hide.values, ["a+b.c*d?(e)$&-and-more", "a+b.c*d?(e)$&", "12345678"]);
	assert.equal(secretNames({ ARTHUR_A_PIN: "1234567", ARTHUR_A_EMPTY: "" })("1234567"), "1234567");
	// In bytes, a value as its UTF-8; a character a chunk cuts short stays the byte it was.
	const bytes = secretNames({ ARTHUR_A_WORD: "pässwörd-123" }).bytes;
	assert.equal(bytes(Buffer.from("x pässwörd-123 y")).toString(), "x ARTHUR_A_WORD y");
	assert.deepEqual(bytes(Buffer.from("ä").subarray(0, 1)), Buffer.from("ä").subarray(0, 1));
});

test("a value a pipe splits across chunks is named whole; only an end that may start a value waits, for the next chunk or the end", () => {
	const written: string[] = [];
	const chunks = namedChunks(secretNames({ ARTHUR_A_TOKEN: "s3cret-t0ken" }), (text) => void written.push(text));
	for (const chunk of ["calling with s3c", "ret-", "t0ken now and then a long line"]) chunks.push(chunk);
	assert.deepEqual(written, ["calling with ", "", "ARTHUR_A_TOKEN now and then a long line"]);
	chunks.push(" and last s3cret-t0ke");
	assert.equal(written.at(-1), " and last ");
	chunks.end();
	assert.equal(written.join(""), "calling with ARTHUR_A_TOKEN now and then a long line and last s3cret-t0ke");
	const bare: string[] = [];
	const none = namedChunks(secretNames({}), (text) => void bare.push(text));
	none.push("all at once s");
	assert.deepEqual(bare, ["all at once s"]);
});
