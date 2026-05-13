import type {
	CronJobSchedule,
	CronScheduleDayOfWeek,
} from "../../../cli/src/core/types";

const SCHEDULER_MIN_SLEEP_MS = 250;
const SCHEDULER_MAX_SLEEP_MS = 60000;

export function computeNextCronRunAt(
	schedule: CronJobSchedule,
	after: Date,
): Date {
	let candidate = alignToMinute(after).getTime() + 60000;
	while (true) {
		const current = new Date(candidate);
		if (matchesCronSchedule(schedule, current)) {
			return current;
		}
		candidate += 60000;
	}
}

export function matchesCronSchedule(
	schedule: CronJobSchedule,
	candidate: Date,
): boolean {
	if (schedule.frequency === "minute") {
		const every = schedule.every ?? 1;
		return candidate.getMinutes() % every === 0;
	}
	if (schedule.frequency === "hourly") {
		const every = schedule.every ?? 1;
		const minute = schedule.minute ?? 0;
		return (
			candidate.getMinutes() === minute && candidate.getHours() % every === 0
		);
	}
	if (schedule.frequency === "daily") {
		const { hour, minute } = parseTime(schedule.time);
		return candidate.getHours() === hour && candidate.getMinutes() === minute;
	}
	const { hour, minute } = parseTime(schedule.time);
	return (
		candidate.getDay() === toJsDayOfWeek(schedule.dayOfWeek) &&
		candidate.getHours() === hour &&
		candidate.getMinutes() === minute
	);
}

export function computeSchedulerSleepMs(
	nextRunAtByJobId: Map<string, number>,
	nowMs: number,
): number {
	const nextAt = Math.min(...nextRunAtByJobId.values());
	const untilNext = nextAt - nowMs;
	if (!Number.isFinite(untilNext) || untilNext <= SCHEDULER_MIN_SLEEP_MS) {
		return SCHEDULER_MIN_SLEEP_MS;
	}
	return Math.min(SCHEDULER_MAX_SLEEP_MS, untilNext);
}

function alignToMinute(input: Date): Date {
	const rounded = new Date(input.getTime());
	rounded.setSeconds(0, 0);
	return rounded;
}

function parseTime(time: string): { hour: number; minute: number } {
	const [hourRaw, minuteRaw] = time.split(":");
	return {
		hour: Number(hourRaw),
		minute: Number(minuteRaw),
	};
}

function toJsDayOfWeek(day: CronScheduleDayOfWeek): number {
	const map: Record<CronScheduleDayOfWeek, number> = {
		sun: 0,
		mon: 1,
		tue: 2,
		wed: 3,
		thu: 4,
		fri: 5,
		sat: 6,
	};
	return map[day];
}
