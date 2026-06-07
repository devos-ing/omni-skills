import type {
	ChatMissionDeliveryItem,
	ChatMissionPhase,
	ChatMissionPhaseStatus,
} from "./types/chat-mission-progress.types";

export function createMissionDeliveryItems({
	linkedPr,
	phases,
}: {
	linkedPr: string | null;
	phases: ChatMissionPhase[];
}): ChatMissionDeliveryItem[] {
	const items: ChatMissionDeliveryItem[] = [];
	const testing = phases.find((phase) => phase.id === "testing");
	const testingItem = createTestingDeliveryItem(testing?.status);
	if (testingItem) {
		items.push(testingItem);
	}
	const prUrl = linkedPr?.trim();
	if (prUrl) {
		items.push({
			href: prUrl,
			id: "pullRequest",
			label: "Pull request",
			tone: "success",
			value: formatPullRequestValue(prUrl),
		});
	}
	return items;
}

function createTestingDeliveryItem(
	status: ChatMissionPhaseStatus | undefined,
): ChatMissionDeliveryItem | null {
	if (!status || status === "pending") return null;
	if (status === "success") {
		return { id: "testing", label: "Testing", tone: status, value: "Passed" };
	}
	if (status === "failed") {
		return { id: "testing", label: "Testing", tone: status, value: "Failed" };
	}
	if (status === "warning") {
		return {
			id: "testing",
			label: "Testing",
			tone: status,
			value: "Needs attention",
		};
	}
	return { id: "testing", label: "Testing", tone: status, value: "Running" };
}

function formatPullRequestValue(prUrl: string): string {
	const match = prUrl.match(/\/pull\/(\d+)(?:\D*)?$/);
	return match ? `PR #${match[1]}` : "Open PR";
}
