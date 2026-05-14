declare module "resend" {
	export class Resend {
		constructor(apiKey: string);
		emails: {
			send(payload: {
				from: string;
				to: string[];
				subject: string;
				text: string;
			}): Promise<{ error?: { message?: string } }>;
		};
	}
}
