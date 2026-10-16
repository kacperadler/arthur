import { readFileSync } from "node:fs";
import { join } from "node:path";

// The `checks` file of a job record (spec/roadmap.md, entry 11): what the project's own checks said each time the agent ran
// them. A project declares `npm run check` and `npm test` through the `check` and `test` scripts of the package.json in the
// job's worktree.

export type Script = "check" | "test";

// The scripts the package.json at `worktree` declares; a missing or broken one declares none.
export function declaredChecks(worktree: string): readonly Script[] {
	try {
		const { scripts } = JSON.parse(readFileSync(join(worktree, "package.json"), "utf8")) as { readonly scripts?: Readonly<Record<string, unknown>> };
		return (["check", "test"] as const).filter((name) => typeof scripts?.[name] === "string");
	} catch {
		return [];
	}
}

// The lines one bash command adds: `check pass|fail` per `npm run check`, `test pass|fail N/M` per `npm test`, in the
// command's order, for declared scripts only; any other command adds none. Commands joined by `;`, `&&` or `|` give one exit
// status, so the output decides too: a check passes when the call did not fail and no TypeScript error shows; a test takes
// pass or fail from node --test's last summary (`fail 0` passes, N/M are passed/total), and from the exit status without one.
export function checkLines(command: string, output: string, failed: boolean, declared: readonly Script[]): string[] {
	const ran = Array.from(command.matchAll(/(?:^|[;&|(\n])\s*npm\s+(test|t|run\s+test|run\s+check)(?=$|[\s;&|)])/g), (match): Script =>
		(match[1] ?? "").endsWith("check") ? "check" : "test",
	).filter((name) => declared.includes(name));
	const count = (word: string) => Array.from(output.matchAll(new RegExp(`^\\S+ ${word} (\\d+)\\s*$`, "gm"))).at(-1)?.[1];
	const [tests, passed, failures] = [count("tests"), count("pass"), count("fail")];
	const typeError = /\berror TS\d+|^error:/m.test(output);
	return ran.map((name) => {
		if (name === "check") return `check ${failed || typeError ? "fail" : "pass"}`;
		if (tests === undefined || passed === undefined || failures === undefined) return `test ${failed ? "fail" : "pass"}`;
		return `test ${failures === "0" ? "pass" : "fail"} ${passed}/${tests}`;
	});
}
