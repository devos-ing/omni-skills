"use client";

import type { ReactElement } from "react";

import { IssuesBoard } from "@/components/issues-board/issues-board";
import { useOperatorIssueActions } from "@/components/web-shell/operator-issue-actions-context";

export default function IssuesPage(): ReactElement {
	const { createIssueRequest } = useOperatorIssueActions();

	return <IssuesBoard createIssueRequest={createIssueRequest} />;
}
