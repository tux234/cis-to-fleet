// ABOUTME: Transform CIS benchmark YAML data for Fleet compatibility
// ABOUTME: Handles parsing, filtering, and sanitizing policy data with proper YAML formatting

import * as yaml from "yaml";

const ALLOWED_KEYS = [
	"name",
	"platform",
	"description",
	"resolution",
	"query",
] as const;

export type PolicyItem = {
	name?: string;
	platform?: string;
	description?: string;
	resolution?: string;
	query?: string;
	tags?: string;
	[key: string]: unknown;
};

export type SanitizedPolicyItem = {
	name?: string;
	platform?: string;
	description?: string;
	resolution?: string;
	query?: string;
};

/**
 * Parse raw YAML string into a list of dictionaries.
 *
 * Handles multiple YAML documents and extracts policy specs.
 *
 * @param yamlStr Raw YAML content as a string
 * @returns List of dictionaries parsed from the YAML
 * @throws Error if YAML parsing fails or format is unexpected
 */
export function rawYamlToList(yamlStr: string): PolicyItem[] {
	try {
		// Parse all YAML documents
		const documents = yaml.parseAllDocuments(yamlStr);

		const policies: PolicyItem[] = [];

		for (const doc of documents) {
			const data = doc.toJS();

			if (data && typeof data === "object") {
				// Handle Kubernetes-style documents
				if ("kind" in data && data.kind === "policy" && "spec" in data) {
					policies.push(data.spec as PolicyItem);
				}
				// Handle direct list format
				else if (Array.isArray(data)) {
					policies.push(...data);
				}
				// Handle wrapped format
				else if ("policies" in data && Array.isArray(data.policies)) {
					policies.push(...data.policies);
				}
				// Handle single policy object
				else if ("name" in data || "query" in data) {
					policies.push(data as PolicyItem);
				}
			}
		}

		if (policies.length === 0) {
			throw new Error("No policies found in YAML documents");
		}

		return policies;
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to parse YAML: ${error.message}`);
		}
		throw new Error("Failed to parse YAML: Unknown error");
	}
}

/**
 * Sanitize a single policy item by keeping only allowed keys in order.
 *
 * @param item Dictionary representing a single policy item
 * @returns Dictionary with only the allowed keys in the specified order
 */
export function sanitize(item: PolicyItem): SanitizedPolicyItem {
	const sanitized: SanitizedPolicyItem = {};

	for (const key of ALLOWED_KEYS) {
		if (key in item && item[key] !== undefined) {
			const value = item[key];
			if (typeof value === "string") {
				sanitized[key] = value;
			}
		}
	}

	return sanitized;
}

/**
 * Sanitize all policy items in a list.
 *
 * @param items List of policy item dictionaries
 * @returns List of sanitized policy items
 */
export function sanitizeAll(items: PolicyItem[]): SanitizedPolicyItem[] {
	return items.map(sanitize);
}

/**
 * Filter policy items by CIS level.
 *
 * @param items List of policy item dictionaries
 * @param level CIS level to filter by ("1" or "2")
 * @returns List of policy items matching the specified level
 */
export function filterByLevel(
	items: PolicyItem[],
	level: string,
): PolicyItem[] {
	if (level !== "1" && level !== "2") {
		throw new Error(`Invalid level '${level}'. Must be '1' or '2'.`);
	}

	const levelTag = `CIS_Level${level}`;
	const levelTagAlt = `CIS_LEVEL${level}`; // Handle alternative capitalization

	const filteredItems: PolicyItem[] = [];

	for (const item of items) {
		const tags = item.tags || "";
		if (typeof tags === "string") {
			// Split comma-separated tags and check for level
			const tagList = tags.split(",").map((tag) => tag.trim());
			if (tagList.includes(levelTag) || tagList.includes(levelTagAlt)) {
				filteredItems.push(item);
			}
		}
	}

	return filteredItems;
}

/**
 * Convert list of policy items to YAML string format (array format).
 *
 * @param items List of policy item dictionaries
 * @returns YAML string representation with proper formatting
 */
export function toYaml(items: SanitizedPolicyItem[]): string {
	const options: yaml.ToStringOptions = {
		indent: 2,
		lineWidth: 0, // Prevent line wrapping
		minContentWidth: 0,
		doubleQuotedAsJSON: false,
		doubleQuotedMinMultiLineLength: 40,
		singleQuote: false,
	};

	return yaml.stringify(items, options);
}

/**
 * Convert list of policy items to individual YAML chunks.
 *
 * @param items List of policy item dictionaries
 * @returns Dictionary mapping policy names to individual YAML strings
 */
export function toYamlChunks(
	items: SanitizedPolicyItem[],
): Record<string, string> {
	const options: yaml.ToStringOptions = {
		indent: 2,
		lineWidth: 0, // Prevent line wrapping
		minContentWidth: 0,
		doubleQuotedAsJSON: false,
		doubleQuotedMinMultiLineLength: 40,
		singleQuote: false,
	};

	const chunks: Record<string, string> = {};

	for (const item of items) {
		// Create a safe filename from the policy name
		const policyName = item.name || "unknown";
		if (policyName.includes("\0") || policyName.includes("\x00")) {
			throw new Error("Invalid policy name contains null bytes");
		}
		let safeName = policyName
			.replace(/\s+/g, "_")
			.replace(/[/\\]/g, "_")
			.replace(/[^\w\-_]/g, "");

		// Ensure the name is not empty
		if (!safeName) {
			safeName = "unknown_policy";
		}

		// Reorder fields to match Fleet format: name, query, critical, description, resolution, platform
		const orderedItem: Record<string, unknown> = {};

		if (item.name !== undefined) {
			orderedItem.name = item.name;
		}
		if (item.query !== undefined) {
			orderedItem.query = item.query;
		}

		// Add critical field (default to false for CIS policies)
		orderedItem.critical = false;

		if (item.description !== undefined) {
			orderedItem.description = item.description;
		}
		if (item.resolution !== undefined) {
			orderedItem.resolution = item.resolution;
		}
		if (item.platform !== undefined) {
			orderedItem.platform = item.platform;
		}

		// Generate individual YAML for this policy wrapped in array format
		chunks[safeName] = yaml.stringify([orderedItem], options);
	}

	return chunks;
}
