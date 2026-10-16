import assert from "node:assert/strict";
import { test } from "node:test";
import { type Clock, clock, type Day } from "../src/clock.ts";
import type { QuietHours } from "../src/config.ts";

// A clock in `timeZone` standing at `at` (an ISO time with its offset), moved by `set`.
function at(timeZone: string, start: string, quietHours?: QuietHours): Clock & { set(time: string): void } {
	let now = new Date(start);
	return { ...clock(timeZone, quietHours, () => now), set: (time) => void (now = new Date(time)) };
}

// `next` again and again, as a timer that sets itself at each slot does: the instants it fires at, in UTC.
function fires(time: Clock & { set(time: string): void }, slot: string, count: number, days?: readonly Day[]): string[] {
	const seen: string[] = [];
	for (let index = 0; index < count; index++) {
		const next = time.next(slot, days).toISOString();
		seen.push(next);
		time.set(next);
	}
	return seen;
}

const iso = (time: string) => new Date(time).toISOString();

test("now is the given instant, and local shows it on the wall clock of the zone, summer and winter", () => {
	const warsaw = at("Europe/Warsaw", "2026-07-01T10:15:00Z");
	assert.equal(warsaw.now().toISOString(), "2026-07-01T10:15:00.000Z");
	assert.equal(warsaw.timeZone, "Europe/Warsaw");
	assert.deepEqual(warsaw.local(), { date: "2026-07-01", time: "12:15", day: "wed" });
	assert.deepEqual(warsaw.local(new Date("2026-01-15T23:30:00Z")), { date: "2026-01-16", time: "00:30", day: "fri" });
	// Kolkata keeps +05:30 all year.
	const kolkata = at("Asia/Kolkata", "2026-07-01T20:00:00Z");
	assert.deepEqual(kolkata.local(), { date: "2026-07-02", time: "01:30", day: "thu" });
	assert.deepEqual(kolkata.local(new Date("2026-01-01T20:00:00Z")), { date: "2026-01-02", time: "01:30", day: "fri" });
});

test("quiet hours across midnight: quiet from 22:00, not quiet again at 07:30, in summer and winter time", () => {
	const time = at("Europe/Warsaw", "2026-07-01T12:00:00+02:00", { from: "22:00", to: "07:30" });
	assert.equal(time.isQuiet(), false);
	const quiet = (local: string) => time.isQuiet(new Date(local));
	assert.equal(quiet("2026-07-01T21:59:00+02:00"), false);
	assert.equal(quiet("2026-07-01T22:00:00+02:00"), true);
	assert.equal(quiet("2026-07-02T00:00:00+02:00"), true);
	assert.equal(quiet("2026-07-02T07:29:59+02:00"), true);
	assert.equal(quiet("2026-07-02T07:30:00+02:00"), false);
	assert.equal(quiet("2026-01-15T21:59:00+01:00"), false);
	assert.equal(quiet("2026-01-15T22:00:00+01:00"), true);
	assert.equal(quiet("2026-01-16T07:30:00+01:00"), false);
	time.set("2026-07-01T23:00:00+02:00");
	assert.equal(time.isQuiet(), true, "isQuiet without an instant asks now");
});

test("quiet hours within a day, in a zone without daylight saving", () => {
	const time = at("Asia/Kolkata", "2026-07-01T12:00:00+05:30", { from: "12:00", to: "14:00" });
	const quiet = (local: string) => time.isQuiet(new Date(local));
	assert.equal(quiet("2026-07-01T11:59:00+05:30"), false);
	assert.equal(quiet("2026-07-01T12:00:00+05:30"), true);
	assert.equal(quiet("2026-07-01T13:59:00+05:30"), true);
	assert.equal(quiet("2026-07-01T14:00:00+05:30"), false);
	assert.equal(quiet("2026-07-01T23:00:00+05:30"), false);
});

test("from equal to to, or no quiet hours, is never quiet", () => {
	for (const local of ["2026-07-01T06:59:00+02:00", "2026-07-01T07:00:00+02:00", "2026-07-01T19:00:00+02:00"]) {
		assert.equal(at("Europe/Warsaw", local, { from: "07:00", to: "07:00" }).isQuiet(), false, local);
		assert.equal(at("Europe/Warsaw", local).isQuiet(), false, local);
	}
});

test("next is the first slot strictly after now: later today, else tomorrow; at the slot's very minute, the next one", () => {
	const time = at("Europe/Warsaw", "2026-07-01T10:00:00+02:00");
	assert.equal(time.next("12:00").toISOString(), iso("2026-07-01T12:00:00+02:00"));
	assert.equal(time.next("08:00").toISOString(), iso("2026-07-02T08:00:00+02:00"));
	assert.equal(time.next("00:00").toISOString(), iso("2026-07-02T00:00:00+02:00"));
	time.set("2026-07-01T07:59:59.999+02:00");
	assert.equal(time.next("08:00").toISOString(), iso("2026-07-01T08:00:00+02:00"));
	time.set("2026-07-01T08:00:00+02:00");
	assert.equal(time.next("08:00").toISOString(), iso("2026-07-02T08:00:00+02:00"));
	time.set("2026-07-01T08:00:30+02:00");
	assert.equal(time.next("08:00").toISOString(), iso("2026-07-02T08:00:00+02:00"));
	const kolkata = at("Asia/Kolkata", "2026-07-01T23:59:59+05:30");
	assert.deepEqual(fires(kolkata, "00:00", 2), [iso("2026-07-02T00:00:00+05:30"), iso("2026-07-03T00:00:00+05:30")]);
});

test("next with a day list of one day: that day only, a week on when today's slot has passed", () => {
	// 2026-07-01 is a Wednesday.
	const time = at("Europe/Warsaw", "2026-07-01T10:00:00+02:00");
	assert.equal(time.next("09:00", ["mon"]).toISOString(), iso("2026-07-06T09:00:00+02:00"));
	assert.equal(time.next("12:00", ["wed"]).toISOString(), iso("2026-07-01T12:00:00+02:00"));
	assert.equal(time.next("08:00", ["wed"]).toISOString(), iso("2026-07-08T08:00:00+02:00"));
	assert.equal(time.next("10:00", ["wed"]).toISOString(), iso("2026-07-08T10:00:00+02:00"));
	assert.deepEqual(fires(time, "03:00", 3, ["tue", "fri"]), [
		iso("2026-07-03T03:00:00+02:00"),
		iso("2026-07-07T03:00:00+02:00"),
		iso("2026-07-10T03:00:00+02:00"),
	]);
	const kolkata = at("Asia/Kolkata", "2026-07-01T10:00:00+05:30");
	assert.equal(kolkata.next("09:00", ["sun"]).toISOString(), iso("2026-07-05T09:00:00+05:30"));
});

test("the spring gap: 02:30 does not exist on 2026-03-29 in Warsaw, so it fires at 03:00, then at 02:30 again", () => {
	const time = at("Europe/Warsaw", "2026-03-28T12:00:00+01:00");
	assert.deepEqual(fires(time, "02:30", 3), [
		iso("2026-03-29T03:00:00+02:00"),
		iso("2026-03-30T02:30:00+02:00"),
		iso("2026-03-31T02:30:00+02:00"),
	]);
	time.set("2026-03-29T01:59:00+01:00");
	assert.equal(time.next("02:00").toISOString(), iso("2026-03-29T03:00:00+02:00"));
	assert.equal(time.next("03:00").toISOString(), iso("2026-03-29T03:00:00+02:00"));
	assert.equal(time.next("02:59").toISOString(), iso("2026-03-29T03:00:00+02:00"));
	assert.equal(time.next("01:59").toISOString(), iso("2026-03-30T01:59:00+02:00"));
});

test("the autumn repeat: 02:30 shows twice on 2026-10-25 in Warsaw and fires once, at its first pass", () => {
	const time = at("Europe/Warsaw", "2026-10-24T12:00:00+02:00");
	assert.deepEqual(fires(time, "02:30", 3), [
		iso("2026-10-25T02:30:00+02:00"),
		iso("2026-10-26T02:30:00+01:00"),
		iso("2026-10-27T02:30:00+01:00"),
	]);
	time.set("2026-10-25T02:10:00+01:00");
	assert.equal(time.next("02:30").toISOString(), iso("2026-10-26T02:30:00+01:00"), "the second pass of the hour does not fire");
	assert.deepEqual(time.local(new Date("2026-10-25T02:30:00+01:00")), { date: "2026-10-25", time: "02:30", day: "sun" });
});

test("a time that is not HH:MM, an unknown day and an empty day list are refused, naming the value", () => {
	const time = at("UTC", "2026-07-01T10:00:00Z");
	const expected = (got: string) => ({ message: `clock.next: expected a time "HH:MM" from 00:00 to 23:59, got ${got}` });
	assert.throws(() => time.next("7:30"), expected('"7:30"'));
	assert.throws(() => time.next("24:00"), expected('"24:00"'));
	assert.throws(() => time.next("08:60"), expected('"08:60"'));
	assert.throws(() => time.next("08:00", []), { message: "clock.next: an empty day list never comes; leave days out for every day" });
	assert.throws(() => time.next("08:00", ["monday" as Day]), {
		message: 'clock.next: unknown day "monday"; expected mon, tue, wed, thu, fri, sat or sun',
	});
	assert.throws(() => clock("UTC", { from: "25:00", to: "07:00" }), {
		message: 'quietHours.from: expected a time "HH:MM" from 00:00 to 23:59, got "25:00"',
	});
	assert.throws(() => clock("UTC", { from: "22:00", to: "" }), {
		message: 'quietHours.to: expected a time "HH:MM" from 00:00 to 23:59, got ""',
	});
});
