// ABOUTME: Test GitHub API client retry logic, timeout handling, and error scenarios
// ABOUTME: Includes mocked network failures, rate limiting, and timeout scenarios

import { expect, test, beforeEach, afterEach, mock } from "bun:test";
import { GitHubClient } from "../github.js";

// Mock global fetch
const mockFetch = mock();
beforeEach(() => {
	global.fetch = mockFetch;
});

afterEach(() => {
	mockFetch.mockClear();
});

test("GitHubClient constructor sets default options", () => {
	const client = new GitHubClient();
	// We can't directly test private properties, but we can test behavior
	expect(client).toBeInstanceOf(GitHubClient);
});

test("GitHubClient constructor accepts custom options", () => {
	const client = new GitHubClient({
		timeout: 5000,
		maxRetries: 1,
		userAgent: "test-agent/1.0.0",
	});
	expect(client).toBeInstanceOf(GitHubClient);
});

test("listFolders successfully fetches and filters directories", async () => {
	const mockResponse = {
		ok: true,
		status: 200,
		json: async () => [
			{ name: "macos-13", type: "dir" },
			{ name: "macos-14", type: "dir" },
			{ name: "README.md", type: "file" },
			{ name: "ubuntu-20", type: "dir" },
		],
	};

	mockFetch.mockResolvedValueOnce(mockResponse);

	const client = new GitHubClient();
	const folders = await client.listFolders();

	expect(folders).toEqual(["macos-13", "macos-14", "ubuntu-20"]);
	expect(mockFetch).toHaveBeenCalledTimes(1);
	expect(mockFetch).toHaveBeenCalledWith(
		"https://api.github.com/repos/fleetdm/fleet/contents/ee/cis",
		expect.objectContaining({
			headers: {
				"User-Agent": "cis-to-fleet/0.1.0",
			},
		}),
	);
});

test("fetchYaml successfully fetches YAML content", async () => {
	const mockYamlContent = "name: Test Policy\nquery: SELECT 1";
	const mockResponse = {
		ok: true,
		status: 200,
		text: async () => mockYamlContent,
	};

	mockFetch.mockResolvedValueOnce(mockResponse);

	const client = new GitHubClient();
	const yaml = await client.fetchYaml("macos-13");

	expect(yaml).toBe(mockYamlContent);
	expect(mockFetch).toHaveBeenCalledTimes(1);
	expect(mockFetch).toHaveBeenCalledWith(
		"https://raw.githubusercontent.com/fleetdm/fleet/refs/heads/main/ee/cis/macos-13/cis-policy-queries.yml",
		expect.objectContaining({
			headers: {
				"User-Agent": "cis-to-fleet/0.1.0",
			},
		}),
	);
});

test("fetchYaml handles 404 errors specifically", async () => {
	const mockResponse = {
		ok: false,
		status: 404,
		statusText: "Not Found",
	};

	mockFetch.mockResolvedValueOnce(mockResponse);

	const client = new GitHubClient();
	await expect(client.fetchYaml("nonexistent")).rejects.toThrow(
		"YAML file not found for folder: nonexistent",
	);
});

test("retries on server errors (5xx)", async () => {
	const serverErrorResponse = {
		ok: false,
		status: 500,
		statusText: "Internal Server Error",
	};

	const successResponse = {
		ok: true,
		status: 200,
		json: async () => [{ name: "macos-13", type: "dir" }],
	};

	// First call fails with 500, second succeeds
	mockFetch
		.mockResolvedValueOnce(serverErrorResponse)
		.mockResolvedValueOnce(successResponse);

	const client = new GitHubClient({ maxRetries: 1 });
	const folders = await client.listFolders();

	expect(folders).toEqual(["macos-13"]);
	expect(mockFetch).toHaveBeenCalledTimes(2);
});

test("retries on rate limiting (429)", async () => {
	const rateLimitResponse = {
		ok: false,
		status: 429,
		statusText: "Too Many Requests",
		headers: new Map([["retry-after", "1"]]),
	};

	const successResponse = {
		ok: true,
		status: 200,
		json: async () => [{ name: "macos-13", type: "dir" }],
	};

	// First call rate limited, second succeeds
	mockFetch
		.mockResolvedValueOnce(rateLimitResponse)
		.mockResolvedValueOnce(successResponse);

	const client = new GitHubClient({ maxRetries: 1 });
	const folders = await client.listFolders();

	expect(folders).toEqual(["macos-13"]);
	expect(mockFetch).toHaveBeenCalledTimes(2);
});

test("fails after max retries on server errors", async () => {
	const serverErrorResponse = {
		ok: false,
		status: 500,
		statusText: "Internal Server Error",
	};

	mockFetch.mockResolvedValue(serverErrorResponse);

	const client = new GitHubClient({ maxRetries: 2 });
	await expect(client.listFolders()).rejects.toThrow(
		"GitHub API server error: 500 Internal Server Error",
	);

	// Should retry maxRetries + 1 times (initial + retries)
	expect(mockFetch).toHaveBeenCalledTimes(3);
});

test("fails after max retries on rate limiting", async () => {
	const rateLimitResponse = {
		ok: false,
		status: 429,
		statusText: "Too Many Requests",
		headers: new Map([["retry-after", "1"]]),
	};

	mockFetch.mockResolvedValue(rateLimitResponse);

	const client = new GitHubClient({ maxRetries: 2 });
	await expect(client.listFolders()).rejects.toThrow(
		"GitHub API rate limited: 429 Too Many Requests",
	);

	// Should retry maxRetries + 1 times (initial + retries)
	expect(mockFetch).toHaveBeenCalledTimes(3);
});

test("handles network errors with retry", async () => {
	const networkError = new Error("Network error");
	const successResponse = {
		ok: true,
		status: 200,
		json: async () => [{ name: "macos-13", type: "dir" }],
	};

	// First call throws network error, second succeeds
	mockFetch
		.mockRejectedValueOnce(networkError)
		.mockResolvedValueOnce(successResponse);

	const client = new GitHubClient({ maxRetries: 1 });
	const folders = await client.listFolders();

	expect(folders).toEqual(["macos-13"]);
	expect(mockFetch).toHaveBeenCalledTimes(2);
});

test("fails after max retries on network errors", async () => {
	const networkError = new Error("Network error");
	mockFetch.mockRejectedValue(networkError);

	const client = new GitHubClient({ maxRetries: 2 });
	await expect(client.listFolders()).rejects.toThrow(
		"Failed to fetch folder list: GitHub API request failed: Network error",
	);

	// Should retry maxRetries + 1 times (initial + retries)
	expect(mockFetch).toHaveBeenCalledTimes(3);
});

test("handles timeout errors", async () => {
	// Mock AbortError for timeout
	const timeoutError = new Error("The operation was aborted");
	timeoutError.name = "AbortError";
	mockFetch.mockRejectedValue(timeoutError);

	const client = new GitHubClient({ maxRetries: 2, timeout: 100 });
	await expect(client.listFolders()).rejects.toThrow(
		"Failed to fetch folder list: GitHub API request timed out after 100ms",
	);
});

test("does not retry on client errors (4xx except rate limiting)", async () => {
	const clientErrorResponse = {
		ok: false,
		status: 400,
		statusText: "Bad Request",
	};

	mockFetch.mockResolvedValue(clientErrorResponse);

	const client = new GitHubClient({ maxRetries: 2 });
	await expect(client.listFolders()).rejects.toThrow(
		"Failed to fetch folder list: GitHub API request failed: 400 Bad Request",
	);

	// Should only make one request (no retries for client errors)
	expect(mockFetch).toHaveBeenCalledTimes(1);
});

test("uses custom User-Agent header", async () => {
	const mockResponse = {
		ok: true,
		status: 200,
		json: async () => [{ name: "test", type: "dir" }],
	};

	mockFetch.mockResolvedValue(mockResponse);

	const client = new GitHubClient({ userAgent: "custom-agent/2.0.0" });
	await client.listFolders();

	expect(mockFetch).toHaveBeenCalledWith(
		expect.any(String),
		expect.objectContaining({
			headers: {
				"User-Agent": "custom-agent/2.0.0",
			},
		}),
	);
});

test("handles rate limiting without retry-after header", async () => {
	const rateLimitResponse = {
		ok: false,
		status: 429,
		statusText: "Too Many Requests",
		headers: new Map(), // No retry-after header
	};

	const successResponse = {
		ok: true,
		status: 200,
		json: async () => [{ name: "macos-13", type: "dir" }],
	};

	mockFetch
		.mockResolvedValueOnce(rateLimitResponse)
		.mockResolvedValueOnce(successResponse);

	const client = new GitHubClient({ maxRetries: 1 });
	const folders = await client.listFolders();

	expect(folders).toEqual(["macos-13"]);
	expect(mockFetch).toHaveBeenCalledTimes(2);
});