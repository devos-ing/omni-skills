import { describe, expect, it } from "bun:test";

import { buildChatRoomHeaderTabs } from "../src/components/chat-room/chat-room-header-tabs";

describe("chat room header tabs", () => {
	it("shows Messages and Action when the session has no task details", () => {
		expect(
			buildChatRoomHeaderTabs({
				activeTab: "messages",
				hasTaskDetails: false,
			}),
		).toEqual([
			{
				key: "messages",
				label: "Messages",
				isActive: true,
			},
			{
				key: "action",
				label: "Action",
				isActive: false,
			},
		]);
	});

	it("shows Task details and Action when the session has a task", () => {
		expect(
			buildChatRoomHeaderTabs({
				activeTab: "messages",
				hasTaskDetails: true,
			}),
		).toEqual([
			{
				key: "messages",
				label: "Messages",
				isActive: true,
			},
			{
				key: "taskDetails",
				label: "Task details",
				isActive: false,
			},
			{
				key: "action",
				label: "Action",
				isActive: false,
			},
		]);
	});

	it("marks Task details active while the task panel is open", () => {
		expect(
			buildChatRoomHeaderTabs({
				activeTab: "taskDetails",
				hasTaskDetails: true,
			}),
		).toEqual([
			{
				key: "messages",
				label: "Messages",
				isActive: false,
			},
			{
				key: "taskDetails",
				label: "Task details",
				isActive: true,
			},
			{
				key: "action",
				label: "Action",
				isActive: false,
			},
		]);
	});

	it("marks Action active while the action tab is open", () => {
		expect(
			buildChatRoomHeaderTabs({
				activeTab: "action",
				hasTaskDetails: true,
			}),
		).toEqual([
			{
				key: "messages",
				label: "Messages",
				isActive: false,
			},
			{
				key: "taskDetails",
				label: "Task details",
				isActive: false,
			},
			{
				key: "action",
				label: "Action",
				isActive: true,
			},
		]);
	});
});
