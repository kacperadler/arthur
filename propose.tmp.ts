import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fakeHost, temporaryFolder } from "@arthur/core/testing";
import { manage } from "./packages/manage/src/manage.ts";
import { orchestration } from "./packages/orchestration/src/orchestration.ts";

delete process.env.ARTHUR_JOB;
const root = join(temporaryFolder(), "acme");
mkdirSync(join(root, "spec"), { recursive: true });
writeFileSync(join(root, "spec/build.json"), "[]");
execFileSync("git", ["init", "--quiet", root]);
const projects = () => [{ name: "acme", path: root, prefix: "AC" }];
const orch = fakeHost({ name: "orchestration" });
orch.provide("projects", projects);
await orch.setup(orchestration());
const run = async (args: string[]) => {
	const out: string[] = [];
	const [log, err] = [console.log, console.error];
	console.log = console.error = (text: string) => void out.push(text);
	const code = await orch.commands.find((each) => each.name === "decision")?.run({ args, project: undefined });
	[console.log, console.error] = [log, err];
	return [code ?? 0, out.join("\n")] as const;
};
for (const n of [1, 2, 3]) {
	await run(["ask", "--kind", "budget", "--question", `Raise the web line budget from ${n}0 to ${n}5 for AC000${n}?`, "--option", "Raise it", "--option", "Refuse", "--recommend", "1"]);
	await run(["answer", `AC-D${n}`, "--decided", "Raise the web line budget by what the fix's needs", "--picked", "1", `AC-D${n} 1`]);
}
const man = fakeHost({ name: "manage" });
man.provide("projects", projects);
man.provide("decision.entries", (request: unknown) => orch.call("decision.entries", request));
await man.setup(manage({}));
const printed: string[] = [];
const log = console.log;
console.log = (text: string) => void printed.push(text);
await man.commands.find((each) => each.name === "repeats")?.run({ args: [], project: undefined });
console.log = log;
const line = /`(arthur decision class propose [^`]+)`/.exec(printed.join("\n"))?.[1] ?? "";
console.log(line);
// The line split as sh splits it, then run as the CLI runs `decision`.
const args = JSON.parse(execFileSync("sh", ["-c", `node -e 'console.log(JSON.stringify(process.argv.slice(1)))' -- ${line.replace(/^arthur decision /, "")}`], { encoding: "utf8" })) as string[];
const project = args.indexOf("--project");
console.log(await run(args.filter((_, at) => at !== project && at !== project + 1)));
