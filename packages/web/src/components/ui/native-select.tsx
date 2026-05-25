import * as React from "react";

import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<
	HTMLSelectElement,
	React.ComponentProps<"select">
>(({ className, children, ...props }, ref) => (
	<select
		className={cn(
			"flex h-10 w-full rounded-md border border-input bg-[#141519] px-3 py-2 text-sm text-zinc-100 outline-none transition focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
			className,
		)}
		ref={ref}
		{...props}
	>
		{children}
	</select>
));
NativeSelect.displayName = "NativeSelect";

const NativeSelectOption = React.forwardRef<
	HTMLOptionElement,
	React.ComponentProps<"option">
>((props, ref) => <option ref={ref} {...props} />);
NativeSelectOption.displayName = "NativeSelectOption";

const NativeSelectOptGroup = React.forwardRef<
	HTMLOptGroupElement,
	React.ComponentProps<"optgroup">
>((props, ref) => <optgroup ref={ref} {...props} />);
NativeSelectOptGroup.displayName = "NativeSelectOptGroup";

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
