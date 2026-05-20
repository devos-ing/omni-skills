import { defineConfig } from "vite";

export default defineConfig({
	build: {
		lib: {
			entry: "./src/index.ts",
			formats: ["es"],
			fileName: "index",
		},
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
		rollupOptions: {
			external: [
				/^node:/,
				/^devos\//,
				"devos-db",
				"bun",
				"express",
				"express-openapi-validator",
				"swagger-ui-express",
				"zod",
			],
		},
	},
});
