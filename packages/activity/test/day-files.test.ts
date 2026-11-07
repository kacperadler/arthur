import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { temporaryFolder } from "@arthur/core/testing";
import { append, lastSeq, prune } from "../src/day-files.ts";

// The day files: the last number written, a line appended whole after a line a crash cut, old days removed by name.

const line = (seq: number) => ({ seq, time: "2026-01-01T10:00:00.000Z", actor: "arthur", plugin: "core", what: "notice", text: `n${seq}` });
const day = (folder: string, date: string, text: string) => {
	mkdirSync(join(folder, "days"), { recursive: true });
	writeFileSync(join(folder, "days", `${date}.jsonl`), text);
};

test("the last number is the highest of the newest day file that holds a line that reads; none without one", () => {
	const folder = temporaryFolder();
	assert.equal(lastSeq(folder), undefined, "no days folder");
	day(folder, "2026-01-01", `${JSON.stringify(line(4))}\n${JSON.stringify(line(9))}\n${JSON.stringify(line(6))}\n`);
	assert.equal(lastSeq(folder), 9);
	day(folder, "2026-01-02", '{"seq":12,"time":"2026-01-02T0');
	assert.equal(lastSeq(folder), 9, "a newest file holding only a cut line: the day before");
	day(folder, "2026-01-02", '{"seq":"12"}\n{"seq":1.5}\n[]\n');
	assert.equal(lastSeq(folder), 9, "no whole number in it");
	day(folder, "2026-01-03", "");
	writeFileSync(join(folder, "days", "2026-01-09.jsonl.tmp"), `${JSON.stringify(line(99))}\n`);
	writeFileSync(join(folder, "days", "notes.jsonl"), `${JSON.stringify(line(98))}\n`);
	assert.equal(lastSeq(folder), 9, "an empty newest file, and names not a day's, read as nothing");
	day(folder, "2026-01-03", `${JSON.stringify(line(10))}\n`);
	assert.equal(lastSeq(folder), 10);
});

test("a line is appended whole, after a line break when a crash cut the last one, which then reads as one skipped line", () => {
	const folder = temporaryFolder();
	append(folder, "2026-01-01", line(1));
	assert.equal(readFileSync(join(folder, "days", "2026-01-01.jsonl"), "utf8"), `${JSON.stringify(line(1))}\n`);
	day(folder, "2026-01-02", '{"seq":2,"ti');
	append(folder, "2026-01-02", line(3));
	assert.equal(readFileSync(join(folder, "days", "2026-01-02.jsonl"), "utf8"), `{"seq":2,"ti\n${JSON.stringify(line(3))}\n`);
	assert.equal(lastSeq(folder), 3);
	append(folder, "2026-01-02", line(4));
	assert.equal(readFileSync(join(folder, "days", "2026-01-02.jsonl"), "utf8"), `{"seq":2,"ti\n${JSON.stringify(line(3))}\n${JSON.stringify(line(4))}\n`, "a whole last line gets no second break");
});

test("a day file more than keepDays days before today is removed; the one keepDays before, and any other name, stay", () => {
	const folder = temporaryFolder();
	for (const date of ["2025-12-30", "2025-12-31", "2026-01-01", "2026-03-31", "2026-04-01"]) day(folder, date, "");
	writeFileSync(join(folder, "days", "2020-01-01.jsonl.tmp"), "");
	prune(folder, "2026-03-31", 90);
	assert.deepEqual(readdirSync(join(folder, "days")).sort(), ["2020-01-01.jsonl.tmp", "2025-12-31.jsonl", "2026-01-01.jsonl", "2026-03-31.jsonl", "2026-04-01.jsonl"]);
	prune(folder, "2026-03-31", 0);
	assert.deepEqual(readdirSync(join(folder, "days")).sort(), ["2020-01-01.jsonl.tmp", "2026-03-31.jsonl", "2026-04-01.jsonl"], "0: today's alone");
	prune(temporaryFolder(), "2026-03-31", 90);
});
