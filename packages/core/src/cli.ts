#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { configCheck } from "./config-check.ts";

// The `arthur` binary. Until the command registry (spec/roadmap.md, entry 6) it knows one command: `arthur config check`,
// on `arthur.config.ts` in the working folder.
const args = process.argv.slice(2);

if (args[0] === "config" && args.includes("--help")) {
	process.stdout.write(readFileSync(new URL("../docs/commands/config.md", import.meta.url), "utf8"));
} else if (args.length === 2 && args[0] === "config" && args[1] === "check") {
	const { lines, ok } = await configCheck("arthur.config.ts");
	for (const line of lines) console.log(line);
	process.exitCode = ok ? 0 : 1;
} else {
	console.error("usage: arthur config check");
	process.exitCode = 2;
}
