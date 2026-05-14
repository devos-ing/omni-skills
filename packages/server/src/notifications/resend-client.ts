import type {
	NotificationEmailPayload,
	ResendClient,
} from "./notifications.types";

interface ResendSdkShape {
	emails: {
		send(
			payload: NotificationEmailPayload,
		): Promise<{ error?: { message?: string } }>;
	};
}

export function createResendClient(resendApiKey: string): ResendClient {
	return {
		sendEmail: async (payload: NotificationEmailPayload) => {
			const module = (await import("resend")) as {
				Resend: new (apiKey: string) => ResendSdkShape;
			};
			const sdk = new module.Resend(resendApiKey);
			const response = await sdk.emails.send(payload);
			if (response.error) {
				throw new Error(response.error.message ?? "Resend send failed");
			}
		},
	};
}
