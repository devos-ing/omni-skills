"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Command = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
	<CommandPrimitive
		ref={ref}
		className={cn(
			"flex h-full w-full flex-col overflow-hidden rounded-md bg-[#15161a] text-zinc-100",
			className,
		)}
		{...props}
	/>
));
Command.displayName = CommandPrimitive.displayName;

const CommandInput = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Input>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
	<div
		className="flex min-w-0 flex-1 items-center gap-3 px-4"
		cmdk-input-wrapper=""
	>
		<Search className="h-4 w-4 shrink-0 text-zinc-500" />
		<CommandPrimitive.Input
			ref={ref}
			className={cn(
				"flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	</div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.List
		ref={ref}
		className={cn(
			"max-h-[min(34rem,calc(100dvh-7rem))] overflow-y-auto p-2",
			className,
		)}
		{...props}
	/>
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Empty>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Empty
		ref={ref}
		className={cn("px-3 py-10 text-center text-sm text-zinc-500", className)}
		{...props}
	/>
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Group>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Group
		ref={ref}
		className={cn(
			"py-2 text-zinc-100 [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-zinc-500",
			className,
		)}
		{...props}
	/>
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandItem = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
	<CommandPrimitive.Item
		ref={ref}
		className={cn(
			"relative flex min-h-12 cursor-default select-none items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-300 outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-zinc-800 data-[selected=true]:text-zinc-100 data-[disabled=true]:opacity-50",
			className,
		)}
		{...props}
	/>
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
};
