import assert from "node:assert/strict";
import { test } from "node:test";
import { joinBoard, parseBoard, parseRoadmap, roadmapPage, type Ticket } from "../scripts/roadmap.ts";

const roadmap = [
	"# Roadmap",
	"",
	"## Core",
	"",
	"### 1. Rules",
	"### 2. Config | env",
	"### 3. Host",
	"",
	"## Coverage",
	"",
	"### Command line",
	"",
	"## Later",
	"",
	"### 9. Signal",
].join("\n");

const ticket = (id: string, title: string, status: string, updated = "2026-10-17T00:00:00.000Z"): Ticket => ({
	id,
	title,
	status,
	path: `spec/features/${id}/ticket.md`,
	updated,
});

test("a section without numbered entries is left out", () => {
	const sections = parseRoadmap(roadmap);
	assert.deepEqual(
		sections.map((section) => [section.title, section.entries.map((entry) => entry.number)]),
		[
			["Core", [1, 2, 3]],
			["Later", [9]],
		],
	);
});

test("a duplicate entry number fails, naming both lines", () => {
	assert.throws(() => parseRoadmap(`${roadmap}\n### 2. Again`), /entry 2 is used twice, at lines 6 and 16/);
});

test("a roadmap without numbered entries fails", () => {
	assert.throws(() => parseRoadmap("# Roadmap\n\n## Core\n\n### Rules\n"), /no numbered entry/);
});

test("an entry before any section fails", () => {
	assert.throws(() => parseRoadmap("# Roadmap\n### 1. Rules\n## Core\n"), /roadmap\.md:2: entry 1 is under no section/);
});

test("a merged ticket wins over a dropped and an open one", () => {
	const board = [
		ticket("AR0001", "Roadmap 1: first try", "dropped"),
		ticket("AR0002", "Roadmap 1: rules", "merged", "2026-10-01T00:00:00.000Z"),
		ticket("AR0003", "Roadmap 1: follow-up", "planning"),
	];
	assert.equal(joinBoard(parseRoadmap(roadmap), board).get(1)?.id, "AR0002");
});

test("without a merged ticket the most recently updated open one stands for the entry", () => {
	const board = [
		ticket("AR0001", "Roadmap 3: host", "planned", "2026-10-17T10:00:00.000Z"),
		ticket("AR0002", "Roadmap 3: host again", "in-progress", "2026-10-17T11:00:00.000Z"),
		ticket("AR0003", "Roadmap 3: older", "planning", "2026-10-16T11:00:00.000Z"),
	];
	assert.equal(joinBoard(parseRoadmap(roadmap), board).get(3)?.id, "AR0002");
});

test("an entry with only a dropped ticket, or none, is not started", () => {
	const page = roadmapPage(parseRoadmap(roadmap), [ticket("AR0001", "Roadmap 1: rules", "dropped")]);
	assert.match(page, /^\| 1 \| Rules \| not started \|  \|$/m);
	assert.match(page, /^\| 3 \| Host \| not started \|  \|$/m);
});

test("the page counts built entries per section and lists the other open tickets", () => {
	const board = [
		ticket("AR0001", "Roadmap 1: rules", "merged"),
		ticket("AR0002", "Roadmap 2: config", "in-progress"),
		ticket("AR0003", "A bug | with a pipe", "planning"),
		ticket("AR0004", "Merged work", "merged"),
		ticket("AR0005", "Dropped work", "dropped"),
	];
	const page = roadmapPage(parseRoadmap(roadmap), board);
	assert.match(page, /^## Core: 1 of 3 built$/m);
	assert.match(page, /^## Later: 0 of 1 built$/m);
	assert.match(page, /^\| 1 \| Rules \| built \| \[AR0001\]\(https:\/\/github\.com\/kacperadler\/arthur\/blob\/main\/spec\/features\/AR0001\/ticket\.md\) \|$/m);
	assert.match(page, /^\| 2 \| Config \\\| env \| in-progress \| \[AR0002\]/m);
	assert.match(page, /^\| \[AR0003\]\([^)]+\) \| A bug \\\| with a pipe \| planning \|$/m);
	assert.doesNotMatch(page, /AR0004|AR0005/);
	assert.doesNotMatch(page, /Coverage/);
});

test("a Roadmap ticket whose entry is not in the roadmap fails, naming the ticket", () => {
	assert.throws(
		() => joinBoard(parseRoadmap(roadmap), [ticket("AR0099", "Roadmap 99: nowhere", "planned")]),
		/AR0099 \(Roadmap 99: nowhere\) names entry 99/,
	);
});

test("a board that is not an array of tickets with id, title, status and path fails", () => {
	assert.throws(() => parseBoard("{}"), /not an array of tickets/);
	assert.throws(() => parseBoard('[{"id":"AR0001","title":"x","status":"planned"}]'), /ticket 0 has no string path/);
	assert.throws(() => parseBoard("[null]"), /ticket 0 has no string id/);
	assert.equal(parseBoard('[{"id":"AR0001","title":"x","status":"planned","path":"p"}]').length, 1);
});
