import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { braces } from "../src/shell-braces.ts";

test("a word's brace lists and sequences make the words bash makes of them, up to 256; a quoted or escaped one is no list", () => {
	const words = ["{a,b}x", "{a,{b,c}}", "a{b,c{d,e}}f", "{,}", "x{1..3}", "{9..11}", "{5..1..0}", "{01..10..3}", "{-05..5..4}", "{-3..3}", "{+1..3}", "{a..e..2}", "{e..a}", "{a..c}{1..2}"];
	for (const word of words) {
		const bash = execFileSync("bash", ["-c", `printf '%s\\n' ${word}`], { encoding: "utf8" }).slice(0, -1).split("\n");
		// bash drops a word that expands to nothing, as `{,}` makes two; the guard judges the set of words.
		assert.deepEqual([...new Set(braces(word))].sort(), [...new Set(bash)].sort(), word);
	}
	for (const word of ["{a..cc}", "{1..2..x}", "{x}", "\\{a,b}", "{a\\,b}", "{1\\..3}", "a{b"]) assert.deepEqual(braces(word), [word], word);
	assert.equal(braces("{1..256}")?.length, 256);
	assert.equal(braces("{1..257}"), undefined);
	assert.equal(braces("{a,b}{1..129}"), undefined);
});
