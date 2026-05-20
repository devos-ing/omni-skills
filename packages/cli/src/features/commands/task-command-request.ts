export async function resolveTaskCreateRequest(options: {
	request?: string;
	askQuestion(question: string): Promise<string>;
	readStdin(): Promise<string>;
}): Promise<string> {
	let request = options.request;
	if (request === "-") {
		request = await options.readStdin();
	}
	if (!request) {
		request = await options.askQuestion("Enter task request");
	}
	const trimmedRequest = request.trim();
	if (!trimmedRequest) {
		throw new Error("task create requires a non-empty request");
	}
	return trimmedRequest;
}
