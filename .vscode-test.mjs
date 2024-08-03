import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	workspaceFolder: "./test/fixture",
	installExtensions: [
		"ms-python.python"
	],
});