// ABOUTME: Tests for the writer module functions
// ABOUTME: Covers path generation and file writing with overwrite protection

import { expect, test } from "bun:test";
import { readFile, rmdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { outputPath, write } from "../writer.js";

test("outputPath generates correct file paths", () => {
	expect(outputPath("macos-15", "./output")).toBe(
		join("./output", "cis-benchmark-macos15.yml"),
	);
	expect(outputPath("windows-11", "/tmp")).toBe(
		join("/tmp", "cis-benchmark-windows11.yml"),
	);
	expect(outputPath("ubuntu", "./test")).toBe(
		join("./test", "cis-benchmark-ubuntu.yml"),
	);
});

test("outputPath generates correct file paths with format suffix", () => {
	expect(outputPath("macos-15", "./output", "gitops")).toBe(
		join("./output", "cis-benchmark-macos15-gitops.yml"),
	);
	expect(outputPath("windows-11", "/tmp", "fleetctl")).toBe(
		join("/tmp", "cis-benchmark-windows11-fleetctl.yml"),
	);
	expect(outputPath("ubuntu", "./test", "custom")).toBe(
		join("./test", "cis-benchmark-ubuntu-custom.yml"),
	);
});

test("outputPath rejects dangerous folder names", () => {
	expect(() => outputPath("../etc", "./out")).toThrow("Invalid folder name");
	expect(() => outputPath("bad/dir", "./out")).toThrow("Invalid folder name");
	expect(() => outputPath("bad\\dir", "./out")).toThrow("Invalid folder name");
	expect(() => outputPath("bad\0dir", "./out")).toThrow("Invalid folder name");
});

test("write creates file with content", async () => {
	const testDir = "./test-write";
	const testFile = join(testDir, "test.yml");
	const content = "test: content\n";

	try {
		await write(content, testFile);

		const written = await readFile(testFile, "utf-8");
		expect(written).toBe(content);
	} finally {
		// Cleanup
		try {
			await unlink(testFile);
			await rmdir(testDir);
		} catch {
			// Ignore cleanup errors
		}
	}
});

test("write throws error when file exists and overwrite is false", async () => {
	const testDir = "./test-overwrite";
	const testFile = join(testDir, "exists.yml");

	try {
		// Create initial file
		await write("initial", testFile);

		// Try to write again without overwrite
		expect(write("new content", testFile, false)).rejects.toThrow(
			"File already exists",
		);
	} finally {
		// Cleanup
		try {
			await unlink(testFile);
			await rmdir(testDir);
		} catch {
			// Ignore cleanup errors
		}
	}
});

test("write overwrites when overwrite is true", async () => {
	const testDir = "./test-overwrite-true";
	const testFile = join(testDir, "overwrite.yml");

	try {
		// Create initial file
		await write("initial", testFile);

		// Overwrite with new content
		await write("new content", testFile, true);

		const written = await readFile(testFile, "utf-8");
		expect(written).toBe("new content");
	} finally {
		// Cleanup
		try {
			await unlink(testFile);
			await rmdir(testDir);
		} catch {
			// Ignore cleanup errors
		}
	}
});
