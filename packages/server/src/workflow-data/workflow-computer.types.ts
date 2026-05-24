export interface WorkflowComputerRegistration {
	id: string;
	name: string;
	hostname: string;
	platform: string;
	arch: string;
	cwd: string;
	startedAt: string;
	processId?: number;
	user?: string;
}

export interface RegisteredWorkflowComputer
	extends WorkflowComputerRegistration {
	workerId: string;
	status: "online" | "offline";
	connectedAt: string;
	lastSeenAt: string;
	disconnectedAt?: string;
}
