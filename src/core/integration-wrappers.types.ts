import type { commentOnPr, squashMergePullRequest } from "../services/github";
import type {
	sendHumanReviewRequiredEmail,
	sendTaskOutcomeEmail,
} from "../services/notifications";

export interface IntegrationWrapperDeps {
	commentOnPr?: typeof commentOnPr;
	squashMergePullRequest?: typeof squashMergePullRequest;
	sendTaskOutcomeEmail?: typeof sendTaskOutcomeEmail;
	sendHumanReviewRequiredEmail?: typeof sendHumanReviewRequiredEmail;
}
