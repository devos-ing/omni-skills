export function formatWaitDurationLabel(
	startedAt: string,
	now: number,
): string {
	const startedTime = new Date(startedAt).getTime();
	const seconds = Number.isFinite(startedTime)
		? Math.max(1, Math.floor((now - startedTime) / 1000))
		: 1;
	const unit = seconds === 1 ? "second" : "seconds";
	return `Waiting for ${seconds} ${unit}`;
}
