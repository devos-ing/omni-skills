import type { DevosPluginPreset, DevosPluginTemplate } from "./scaffold.types";

export interface TemplateInput {
	pluginId: string;
	displayName: string;
	description: string;
	author: string;
	template: DevosPluginTemplate;
	preset?: DevosPluginPreset;
}
