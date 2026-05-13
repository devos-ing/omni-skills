import { describe, expect, it } from "bun:test";
import { computeNextCronRunAt, matchesCronSchedule } from "../src/cron";

describe("computeNextCronRunAt", () => {
	it("computes minute schedules", () => {
		const next = computeNextCronRunAt(
			{ frequency: "minute", every: 5 },
			new Date(2026, 4, 7, 10, 2, 35),
		);
		expect(next.getMinutes()).toBe(5);
		expect(next.getSeconds()).toBe(0);
	});

	it("computes hourly schedules", () => {
		const next = computeNextCronRunAt(
			{ frequency: "hourly", every: 2, minute: 15 },
			new Date(2026, 4, 7, 10, 20, 0),
		);
		expect(next.getHours()).toBe(12);
		expect(next.getMinutes()).toBe(15);
	});

	it("computes daily schedules", () => {
		const next = computeNextCronRunAt(
			{ frequency: "daily", time: "09:30" },
			new Date(2026, 4, 7, 9, 40, 0),
		);
		expect(next.getDate()).toBe(8);
		expect(next.getHours()).toBe(9);
		expect(next.getMinutes()).toBe(30);
	});

	it("computes weekly schedules", () => {
		const next = computeNextCronRunAt(
			{ frequency: "weekly", dayOfWeek: "mon", time: "08:00" },
			new Date(2026, 4, 7, 9, 0, 0),
		);
		expect(next.getDay()).toBe(1);
		expect(next.getHours()).toBe(8);
		expect(next.getMinutes()).toBe(0);
	});
});

describe("matchesCronSchedule", () => {
	it("matches minute/hourly/daily/weekly schedules", () => {
		expect(
			matchesCronSchedule(
				{ frequency: "minute", every: 10 },
				new Date(2026, 4, 7, 10, 20, 0),
			),
		).toBe(true);
		expect(
			matchesCronSchedule(
				{ frequency: "hourly", every: 2, minute: 15 },
				new Date(2026, 4, 7, 12, 15, 0),
			),
		).toBe(true);
		expect(
			matchesCronSchedule(
				{ frequency: "daily", time: "09:30" },
				new Date(2026, 4, 7, 9, 30, 0),
			),
		).toBe(true);
		expect(
			matchesCronSchedule(
				{ frequency: "weekly", dayOfWeek: "thu", time: "10:00" },
				new Date(2026, 4, 7, 10, 0, 0),
			),
		).toBe(true);
	});
});
