import assert from "node:assert/strict";
import { test } from "node:test";

test("fails on purpose, to show its annotation", () => assert.deepEqual({ a: 1 }, { a: 2 }));
