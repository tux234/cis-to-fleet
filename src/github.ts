// ABOUTME: GitHub API client for fetching CIS benchmark data from Fleet repository
// ABOUTME: Provides async methods to list folders and fetch YAML content

/**
 * Configuration options for GitHub API client.
 */
export interface GitHubClientOptions {
	timeout?: number;
	maxRetries?: number;
	userAgent?: string;
}

/**
 * GitHub API client for fetching CIS benchmark data with resilience features.
 */
export class GitHubClient {
	private readonly baseUrl: string = "https://api.github.com";
	private readonly repoOwner: string = "fleetdm";
	private readonly repoName: string = "fleet";
	private readonly timeout: number;
	private readonly maxRetries: number;
	private readonly userAgent: string;

	constructor(options: GitHubClientOptions = {}) {
		this.timeout = options.timeout ?? 30000; // 30 seconds default
		this.maxRetries = options.maxRetries ?? 3;
		this.userAgent = options.userAgent ?? "cis-to-fleet/0.1.0";
	}

	/**
	 * Make a fetch request with timeout, retry logic, and proper error handling.
	 *
	 * @param url The URL to fetch
	 * @returns Promise resolving to the Response object
	 * @throws Error if all retries fail or non-retryable error occurs
	 */
	private async fetchWithRetry(url: string): Promise<Response> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				// Create AbortController for timeout
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), this.timeout);

				const response = await fetch(url, {
					signal: controller.signal,
					headers: {
						"User-Agent": this.userAgent,
					},
				});

				clearTimeout(timeoutId);

				// Handle rate limiting - wait and retry
				if (response.status === 429 || response.status === 403) {
					if (attempt === this.maxRetries) {
						throw new Error(
							`GitHub API rate limited: ${response.status} ${response.statusText}`,
						);
					}

					// Extract retry-after header or use exponential backoff
					const retryAfter = response.headers.get("retry-after");
					const delay = retryAfter
						? Number.parseInt(retryAfter) * 1000
						: this.getExponentialBackoffDelay(attempt);

					await this.sleep(delay);
					continue;
				}

				// Handle server errors with retry
				if (response.status >= 500) {
					if (attempt === this.maxRetries) {
						throw new Error(
							`GitHub API server error: ${response.status} ${response.statusText}`,
						);
					}

					await this.sleep(this.getExponentialBackoffDelay(attempt));
					continue;
				}

				// Return successful or client error responses (4xx except rate limiting)
				return response;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error("Unknown error");

				// Don't retry on abort (timeout) or network errors on final attempt
				if (attempt === this.maxRetries) {
					if (lastError.name === "AbortError") {
						throw new Error(
							`GitHub API request timed out after ${this.timeout}ms`,
						);
					}
					throw new Error(`GitHub API request failed: ${lastError.message}`);
				}

				// Wait before retry for network errors
				await this.sleep(this.getExponentialBackoffDelay(attempt));
			}
		}

		// Should never reach here, but TypeScript requires it
		throw lastError || new Error("All retry attempts failed");
	}

	/**
	 * Calculate exponential backoff delay with jitter.
	 *
	 * @param attempt The current attempt number (0-based)
	 * @returns Delay in milliseconds
	 */
	private getExponentialBackoffDelay(attempt: number): number {
		// Base delay: 1s, 2s, 4s for attempts 0, 1, 2
		const baseDelay = Math.pow(2, attempt) * 1000;
		// Add jitter (±25%)
		const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
		return Math.max(100, baseDelay + jitter); // Minimum 100ms
	}

	/**
	 * Sleep for the specified number of milliseconds.
	 *
	 * @param ms Milliseconds to sleep
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * List all directories under ee/cis/ in the Fleet repository.
	 *
	 * @returns Promise resolving to list of folder names sorted alphabetically
	 * @throws Error if the API request fails or returns unexpected data
	 */
	async listFolders(): Promise<string[]> {
		const url = `${this.baseUrl}/repos/${this.repoOwner}/${this.repoName}/contents/ee/cis`;

		try {
			const response = await this.fetchWithRetry(url);

			if (!response.ok) {
				throw new Error(
					`GitHub API request failed: ${response.status} ${response.statusText}`,
				);
			}

			const data = (await response.json()) as Array<{
				name: string;
				type: string;
			}>;

			// Filter for directories only and extract names
			const folderNames = data
				.filter((item) => item.type === "dir")
				.map((item) => item.name)
				.sort();

			return folderNames;
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Failed to fetch folder list: ${error.message}`);
			}
			throw new Error("Failed to fetch folder list: Unknown error");
		}
	}

	/**
	 * Fetch the cis-policy-queries.yml file for a specific folder.
	 *
	 * @param folder The folder name under ee/cis/ to fetch YAML from
	 * @returns Promise resolving to the raw YAML content as a string
	 * @throws Error if the YAML file is not found (404) or other errors occur
	 */
	async fetchYaml(folder: string): Promise<string> {
		const url = `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/refs/heads/main/ee/cis/${folder}/cis-policy-queries.yml`;

		try {
			const response = await this.fetchWithRetry(url);

			if (response.status === 404) {
				throw new Error(`YAML file not found for folder: ${folder}`);
			}

			if (!response.ok) {
				throw new Error(
					`Failed to fetch YAML: ${response.status} ${response.statusText}`,
				);
			}

			return await response.text();
		} catch (error) {
			if (error instanceof Error) {
				throw error; // Re-throw our custom errors
			}
			throw new Error(`Failed to fetch YAML for ${folder}: Unknown error`);
		}
	}
}

/**
 * Synchronous wrapper for listFolders() using top-level await.
 *
 * @returns Promise resolving to list of folder names sorted alphabetically
 */
export async function listFoldersSync(): Promise<string[]> {
	const client = new GitHubClient();
	return await client.listFolders();
}

/**
 * Synchronous wrapper for fetchYaml() using top-level await.
 *
 * @param folder The folder name under ee/cis/ to fetch YAML from
 * @returns Promise resolving to the raw YAML content as a string
 */
export async function fetchYamlSync(folder: string): Promise<string> {
	const client = new GitHubClient();
	return await client.fetchYaml(folder);
}
