// ABOUTME: File writing utilities for CIS benchmark output
// ABOUTME: Handles path generation and safe file writing with overwrite protection

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Generate output file path for a given folder name.
 *
 * @param folder The original folder name (e.g., 'macos-15', 'windows-11')
 * @param outDir The output directory path
 * @returns Path string for the output file with hyphens stripped from folder name
 *
 * @example
 * ```typescript
 * outputPath('macos-15', './output') // returns './output/cis-benchmark-macos15.yml'
 * ```
 */
export function outputPath(folder: string, outDir: string): string {
	validatePath(folder);
	const cleanFolder = folder.replace(/-/g, "");
	const filename = `cis-benchmark-${cleanFolder}.yml`;
	return join(outDir, filename);
}

function validatePath(folder: string): void {
	const dangerous = ["..", "/", "\\", "\0", "\x00"];
	if (dangerous.some((char) => folder.includes(char))) {
		throw new Error(
			`Invalid folder name contains dangerous characters: ${folder}`,
		);
	}
}

/**
 * Check if a file exists.
 *
 * @param path The file path to check
 * @returns Promise resolving to true if file exists, false otherwise
 */
async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Write text content to a file.
 *
 * @param text The text content to write
 * @param path The file path to write to
 * @param overwrite If true, overwrite existing files. If false, throw error if file exists
 * @throws Error if the file exists and overwrite is false
 * @throws Error if there are permission or other I/O errors
 */
export async function write(
	text: string,
	path: string,
	overwrite = false,
): Promise<void> {
	try {
		// Ensure parent directory exists
		const parentDir = dirname(path);
		await mkdir(parentDir, { recursive: true });

		// Check if file exists and overwrite is not allowed
		if (!overwrite && (await fileExists(path))) {
			throw new Error(`File already exists: ${path}`);
		}

		// Write the content
		await writeFile(path, text, "utf-8");
	} catch (error) {
		if (error instanceof Error) {
			throw error; // Re-throw our custom errors
		}
		throw new Error(`Failed to write file ${path}: Unknown error`);
	}
}
