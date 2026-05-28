"use client";

import {
	type ChangeEvent,
	type KeyboardEvent,
	type ReactElement,
	useLayoutEffect,
	useRef,
} from "react";

import { Textarea } from "@/components/ui/textarea";

const MAX_VISIBLE_ROWS = 5;
const DEFAULT_NORMAL_LINE_HEIGHT_RATIO = 1.2;

interface ChatComposerTextareaProps {
	activeCommandId: string | undefined;
	className: string;
	disabled: boolean;
	draft: string;
	menuId: string;
	placeholder: string;
	showCommands: boolean;
	onBlur: () => void;
	onChange: (value: string) => void;
	onFocus: () => void;
	onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatComposerTextarea({
	activeCommandId,
	className,
	disabled,
	draft,
	menuId,
	placeholder,
	showCommands,
	onBlur,
	onChange,
	onFocus,
	onKeyDown,
}: ChatComposerTextareaProps): ReactElement {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useLayoutEffect(() => {
		resizeTextarea(textareaRef.current);
	});

	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea || typeof ResizeObserver === "undefined") {
			return;
		}

		let width = textarea.clientWidth;
		const observer = new ResizeObserver(() => {
			if (textarea.clientWidth === width) {
				return;
			}
			width = textarea.clientWidth;
			resizeTextarea(textarea);
		});

		observer.observe(textarea);
		return () => observer.disconnect();
	}, []);

	function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
		resizeTextarea(event.currentTarget);
		onChange(event.currentTarget.value);
	}

	return (
		<Textarea
			aria-activedescendant={showCommands ? activeCommandId : undefined}
			aria-controls={showCommands ? menuId : undefined}
			aria-expanded={showCommands}
			aria-haspopup="menu"
			className={className}
			disabled={disabled}
			onBlur={onBlur}
			onChange={handleChange}
			onFocus={onFocus}
			onKeyDown={onKeyDown}
			placeholder={placeholder}
			ref={textareaRef}
			rows={1}
			value={draft}
		/>
	);
}

function resizeTextarea(textarea: HTMLTextAreaElement | null): void {
	if (!textarea) {
		return;
	}

	textarea.style.height = "auto";
	const maxHeight = getMaxVisibleHeight(textarea);
	const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
	textarea.style.height = `${nextHeight}px`;
	textarea.style.overflowY =
		textarea.scrollHeight > maxHeight ? "auto" : "hidden";
}

function getMaxVisibleHeight(textarea: HTMLTextAreaElement): number {
	const style = window.getComputedStyle(textarea);
	const lineHeight = getLineHeight(style);
	const verticalPadding =
		getPixelValue(style.paddingTop) + getPixelValue(style.paddingBottom);
	const verticalBorder =
		getPixelValue(style.borderTopWidth) +
		getPixelValue(style.borderBottomWidth);

	return lineHeight * MAX_VISIBLE_ROWS + verticalPadding + verticalBorder;
}

function getLineHeight(style: CSSStyleDeclaration): number {
	if (style.lineHeight !== "normal") {
		return getPixelValue(style.lineHeight);
	}

	return getPixelValue(style.fontSize) * DEFAULT_NORMAL_LINE_HEIGHT_RATIO;
}

function getPixelValue(value: string): number {
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
