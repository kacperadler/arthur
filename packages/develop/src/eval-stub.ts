import { chmodSync, writeFileSync } from "node:fs";

// What the stub answers to a call whose line, `arthur <arguments joined by spaces>`, matches `match` (a regex): first the
// files it writes into the run's repository, as the real command would change it, then its output and exit code.
export type StubAnswer = { readonly match: string; readonly output?: string; readonly exit?: number; readonly files?: Readonly<Record<string, string>> };

// `arthur eval`'s stand-in for `arthur` in a run (spec/roadmap.md, entry 67): it notes each call in `log`, one JSON line
// `{ call, answer }`, and answers with the first answer that matches and has not answered yet, else the last that matches; with
// none, it prints nothing and exits 0. It writes only into `repo`: a file of an answer outside it (an absolute path, `..`) is
// refused, noted with the call, and nothing of that answer is written. Arthur's own home is no path it knows.
// A help call, `arthur <command> ... --help` or `arthur help [<command>]`, takes no answer: it prints what the live CLI prints
// (cli.ts), the commands it knows those of `pages` (each one's doc page), and is noted `{ call, help: true }`.
export function writeStub(stub: string, repo: string, log: string, answers: readonly StubAnswer[], pages: Readonly<Record<string, string>>): void {
	const script = `#!${process.execPath}
const fs = process.getBuiltinModule("node:fs");
const path = process.getBuiltinModule("node:path");
const [repo, log, answers, pages] = ${JSON.stringify([repo, log, answers, pages])};
const call = ["arthur", ...process.argv.slice(2)].join(" ");
const words = process.argv.slice(2).filter((word, index, all) => word !== "--project" && all[index - 1] !== "--project");
const [name = "help", ...rest] = words[0] === "--help" ? [] : words;
const usage = "usage: arthur <command> [args] [--project <name>]; arthur <command> --help; arthur help <command>\\n";
const names = "commands: " + Object.keys(pages).sort().join(", ") + "\\n";
const page = (word) => (Object.hasOwn(pages, word) ? [pages[word], 0] : ["arthur: unknown command " + word + "\\n" + names, 2]);
const help = rest.includes("--help") ? page(name) : name !== "help" ? undefined : rest.length === 1 ? page(rest[0]) : rest.length > 1 ? ["arthur: help takes one command name\\n" + usage, 2] : [usage + names, 0];
if (help !== undefined) {
	fs.appendFileSync(log, JSON.stringify({ call, help: true }) + "\\n");
	(help[1] === 0 ? process.stdout : process.stderr).write(help[0]);
	process.exitCode = help[1];
} else reply();
function reply() {
	const used = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\\n").filter(Boolean).map((line) => JSON.parse(line).answer) : [];
	const matching = answers.flatMap((answer, index) => (new RegExp(answer.match).test(call) ? [index] : []));
	const index = matching.find((each) => !used.includes(each)) ?? matching.at(-1) ?? -1;
	const answer = answers[index] ?? {};
	const files = Object.entries(answer.files ?? {}).map(([file, text]) => [path.resolve(repo, file), text]);
	const outside = files.find(([file]) => /^\\.\\.(\\/|$)/.test(path.relative(repo, file)) || file === repo);
	fs.appendFileSync(log, JSON.stringify({ call, answer: index, ...(outside ? { refused: outside[0] } : {}) }) + "\\n");
	if (outside) {
		process.stderr.write("arthur (eval stub): refused to write " + outside[0] + ", outside the run's repository\\n");
		process.exit(1);
	}
	for (const [file, text] of files) {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, text);
	}
	const output = answer.output ?? "";
	if (output !== "") process.stdout.write(output.endsWith("\\n") ? output : output + "\\n");
	process.exitCode = answer.exit ?? 0;
}
`;
	writeFileSync(stub, script);
	chmodSync(stub, 0o755);
}
