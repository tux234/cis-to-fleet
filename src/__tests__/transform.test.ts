// ABOUTME: Tests for the transform module functions
// ABOUTME: Covers YAML parsing, sanitization, filtering, and output formatting

import { expect, test } from "bun:test";
import {
	filterByLevel,
	rawYamlToList,
	sanitize,
	sanitizeAll,
	toYamlChunks,
	toYamlGitOps,
	toYamlFleetctlChunks,
} from "../transform.js";

const samplePolicy = {
	name: "Test Policy",
	platform: "darwin",
	description: "A test policy",
	resolution: "Fix it",
	query: "SELECT 1",
	tags: "CIS_Level1,security",
	extraField: "should be removed",
};

test("sanitize removes extra fields and keeps allowed ones", () => {
	const result = sanitize(samplePolicy);

	expect(result).toEqual({
		name: "Test Policy",
		platform: "darwin",
		description: "A test policy",
		resolution: "Fix it",
		query: "SELECT 1",
	});

	expect(result).not.toHaveProperty("tags");
	expect(result).not.toHaveProperty("extraField");
});

test("sanitizeAll processes array of policies", () => {
	const policies = [
		samplePolicy,
		{ name: "Policy 2", query: "SELECT 2", extra: "remove" },
	];
	const result = sanitizeAll(policies);

	expect(result).toHaveLength(2);
	expect(result[0]).toEqual({
		name: "Test Policy",
		platform: "darwin",
		description: "A test policy",
		resolution: "Fix it",
		query: "SELECT 1",
	});
	expect(result[1]).toEqual({
		name: "Policy 2",
		query: "SELECT 2",
	});
});

test("filterByLevel filters policies by CIS level", () => {
	const policies = [
		{ name: "Level 1 Policy", tags: "CIS_Level1" },
		{ name: "Level 2 Policy", tags: "CIS_Level2" },
		{ name: "Both Levels", tags: "CIS_Level1,CIS_Level2" },
		{ name: "No Level", tags: "other" },
	];

	const level1 = filterByLevel(policies, "1");
	expect(level1).toHaveLength(2);
	expect(level1.map((p) => p.name)).toEqual(["Level 1 Policy", "Both Levels"]);

	const level2 = filterByLevel(policies, "2");
	expect(level2).toHaveLength(2);
	expect(level2.map((p) => p.name)).toEqual(["Level 2 Policy", "Both Levels"]);
});

test("filterByLevel throws error for invalid level", () => {
	expect(() => filterByLevel([], "3")).toThrow("Invalid level");
});

test("toYamlGitOps generates proper YAML output", () => {
	const policies = [{ name: "Test", query: "SELECT 1" }];
	const yaml = toYamlGitOps(policies);

	expect(yaml).toContain("- name: Test");
	expect(yaml).toContain("  query: SELECT 1");
});

test("toYamlChunks generates individual YAML files", () => {
	const policies = [
		{ name: "Policy One", query: "SELECT 1" },
		{ name: "Policy Two", query: "SELECT 2" },
	];

	const chunks = toYamlChunks(policies);

	expect(Object.keys(chunks)).toHaveLength(2);
	expect(chunks.Policy_One).toContain("name: Policy One");
	expect(chunks.Policy_Two).toContain("name: Policy Two");

	// Should include critical: false
	expect(chunks.Policy_One).toContain("critical: false");
});

test("toYamlChunks rejects policy names with null bytes", () => {
	const policies = [{ name: "bad\0name", query: "SELECT 1" }];
	expect(() => toYamlChunks(policies)).toThrow("Invalid policy name");
});

test("rawYamlToList handles basic YAML array", () => {
	const yaml = `
- name: Policy 1
  query: SELECT 1
- name: Policy 2  
  query: SELECT 2
`;

	const result = rawYamlToList(yaml);
	expect(result).toHaveLength(2);
	expect(result[0].name).toBe("Policy 1");
	expect(result[1].name).toBe("Policy 2");
});

test("rawYamlToList handles Kubernetes-style documents", () => {
	const yaml = `
kind: policy
spec:
  name: Test Policy
  query: SELECT 1
---
kind: policy  
spec:
  name: Another Policy
  query: SELECT 2
`;

	const result = rawYamlToList(yaml);
	expect(result).toHaveLength(2);
	expect(result[0].name).toBe("Test Policy");
	expect(result[1].name).toBe("Another Policy");
});

test("rawYamlToList throws error for empty YAML", () => {
	expect(() => rawYamlToList("")).toThrow("No valid policies found");
});

// ========================================
// YAML Type Safety and Validation Tests
// ========================================

test("rawYamlToList validates policy objects correctly", () => {
	const validYaml = `
name: Valid Policy
query: SELECT 1
description: A valid policy
`;

	const policies = rawYamlToList(validYaml);
	expect(policies).toHaveLength(1);
	expect(policies[0].name).toBe("Valid Policy");
	expect(policies[0].query).toBe("SELECT 1");
});

test("rawYamlToList rejects invalid policy with wrong field types", () => {
	const invalidYaml = `
name: 123  # Should be string, not number
query: SELECT 1
`;

	expect(() => rawYamlToList(invalidYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (single policy): expected object with 'name' or 'query' field, got object",
	);
});

test("rawYamlToList rejects policy with no name or query", () => {
	const invalidYaml = `
platform: darwin
description: Missing name and query
`;

	expect(() => rawYamlToList(invalidYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (single policy): expected object with 'name' or 'query' field, got object",
	);
});

test("rawYamlToList validates array of policies", () => {
	const validYaml = `
- name: Policy One
  query: SELECT 1
- name: Policy Two
  query: SELECT 2
`;

	const policies = rawYamlToList(validYaml);
	expect(policies).toHaveLength(2);
	expect(policies[0].name).toBe("Policy One");
	expect(policies[1].name).toBe("Policy Two");
});

test("rawYamlToList rejects array with invalid policy item", () => {
	const invalidYaml = `
- name: Valid Policy
  query: SELECT 1
- platform: darwin  # Missing name and query
  description: Invalid policy
`;

	expect(() => rawYamlToList(invalidYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (direct array)[1]: expected object with 'name' or 'query' field, got object at index 1",
	);
});

test("rawYamlToList validates Kubernetes-style policy documents", () => {
	const kubernetesYaml = `
kind: policy
metadata:
  name: test-policy
spec:
  name: Kubernetes Policy
  query: SELECT 1
  platform: darwin
`;

	const policies = rawYamlToList(kubernetesYaml);
	expect(policies).toHaveLength(1);
	expect(policies[0].name).toBe("Kubernetes Policy");
	expect(policies[0].platform).toBe("darwin");
});

test("rawYamlToList rejects Kubernetes policy with invalid spec", () => {
	const invalidKubernetesYaml = `
kind: policy
spec:
  platform: darwin  # Missing name and query
  description: Invalid spec
`;

	expect(() => rawYamlToList(invalidKubernetesYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (Kubernetes policy spec): expected object with 'name' or 'query' field, got object",
	);
});

test("rawYamlToList validates wrapped policies format", () => {
	const wrappedYaml = `
policies:
  - name: Wrapped Policy One
    query: SELECT 1
  - name: Wrapped Policy Two
    query: SELECT 2
`;

	const policies = rawYamlToList(wrappedYaml);
	expect(policies).toHaveLength(2);
	expect(policies[0].name).toBe("Wrapped Policy One");
	expect(policies[1].name).toBe("Wrapped Policy Two");
});

test("rawYamlToList rejects wrapped format with invalid policy", () => {
	const invalidWrappedYaml = `
policies:
  - name: Valid Policy
    query: SELECT 1
  - description: No name or query  # Invalid policy
`;

	expect(() => rawYamlToList(invalidWrappedYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (wrapped policies array)[1]: expected object with 'name' or 'query' field, got object at index 1",
	);
});

test("rawYamlToList rejects non-object data", () => {
	const invalidYaml = `
- "just a string"
- 42
- true
`;

	expect(() => rawYamlToList(invalidYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (direct array)[0]: expected object with 'name' or 'query' field, got string at index 0",
	);
});

test("rawYamlToList rejects null values", () => {
	const invalidYaml = `
- name: Valid Policy
  query: SELECT 1
- null
`;

	expect(() => rawYamlToList(invalidYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (direct array)[1]: expected object with 'name' or 'query' field, got null at index 1",
	);
});

test("rawYamlToList validates tags field type when present", () => {
	const validYaml = `
name: Policy with tags
query: SELECT 1
tags: CIS_Level1,security
`;

	const policies = rawYamlToList(validYaml);
	expect(policies[0].tags).toBe("CIS_Level1,security");
});

test("rawYamlToList handles null values in policy fields", () => {
	const yamlWithNulls = `
name: Policy with null description
query: SELECT 1
description: null
resolution: Fix the issue
`;

	const policies = rawYamlToList(yamlWithNulls);
	expect(policies[0].name).toBe("Policy with null description");
	expect(policies[0].query).toBe("SELECT 1");
	expect(policies[0].description).toBe(null);
	expect(policies[0].resolution).toBe("Fix the issue");
});

test("sanitize filters out null values", () => {
	const policyWithNulls = {
		name: "Test Policy",
		platform: null,
		description: "Valid description",
		resolution: null,
		query: "SELECT 1",
	};

	const result = sanitize(policyWithNulls);

	expect(result).toEqual({
		name: "Test Policy",
		description: "Valid description",
		query: "SELECT 1",
	});

	// Should not have null fields
	expect(result).not.toHaveProperty("platform");
	expect(result).not.toHaveProperty("resolution");
});

test("rawYamlToList rejects invalid tags field type", () => {
	const invalidYaml = `
name: Policy with invalid tags
query: SELECT 1
tags:
  - CIS_Level1  # Should be string, not array
  - security
`;

	expect(() => rawYamlToList(invalidYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (single policy): expected object with 'name' or 'query' field, got object",
	);
});

test("rawYamlToList handles multiple YAML documents with validation", () => {
	const multiDocYaml = `
name: First Policy
query: SELECT 1
---
name: Second Policy  
query: SELECT 2
---
- name: Third Policy
  query: SELECT 3
- name: Fourth Policy
  query: SELECT 4
`;

	const policies = rawYamlToList(multiDocYaml);
	expect(policies).toHaveLength(4);
	expect(policies[0].name).toBe("First Policy");
	expect(policies[1].name).toBe("Second Policy");
	expect(policies[2].name).toBe("Third Policy");
	expect(policies[3].name).toBe("Fourth Policy");
});

test("rawYamlToList provides context for validation errors in multiple documents", () => {
	const multiDocWithError = `
name: First Policy
query: SELECT 1
---
platform: darwin  # Invalid - no name or query
description: Invalid policy
`;

	expect(() => rawYamlToList(multiDocWithError)).toThrow(
		"Validation failed for Invalid policy data in document 1 (single policy): expected object with 'name' or 'query' field, got object",
	);
});

test("rawYamlToList throws clear error when no valid policies found", () => {
	const emptyYaml = `
metadata:
  version: 1.0
config:
  setting: value
`;

	expect(() => rawYamlToList(emptyYaml)).toThrow(
		"Validation failed for Invalid policy data in document 0 (single policy): expected object with 'name' or 'query' field, got object",
	);
});

// ========================================
// GitOps Format Tests
// ========================================

test("toYamlGitOps generates GitOps-compatible YAML array", () => {
	const policies = [
		{
			name: "Test Policy One",
			platform: "darwin",
			description: "First test policy",
			resolution: "Fix issue one",
			query: "SELECT 1",
		},
		{
			name: "Test Policy Two",
			platform: "linux",
			description: "Second test policy",
			resolution: "Fix issue two",
			query: "SELECT 2",
		},
	];

	const yaml = toYamlGitOps(policies);

	// Should be a YAML array format
	expect(yaml).toContain("- name: Test Policy One");
	expect(yaml).toContain("  platform: darwin");
	expect(yaml).toContain("  description: First test policy");
	expect(yaml).toContain("  resolution: Fix issue one");
	expect(yaml).toContain("  query: SELECT 1");

	expect(yaml).toContain("- name: Test Policy Two");
	expect(yaml).toContain("  platform: linux");

	// Should NOT contain the critical field (GitOps format doesn't include it)
	expect(yaml).not.toContain("critical:");
});

test("toYamlGitOps handles policies with missing fields", () => {
	const policies = [
		{
			name: "Minimal Policy",
			query: "SELECT 1",
		},
	];

	const yaml = toYamlGitOps(policies);

	expect(yaml).toContain("- name: Minimal Policy");
	expect(yaml).toContain("  query: SELECT 1");
	expect(yaml).not.toContain("platform:");
	expect(yaml).not.toContain("description:");
	expect(yaml).not.toContain("resolution:");
});

test("toYamlGitOps maintains proper field ordering", () => {
	const policies = [
		{
			query: "SELECT 1", // Intentionally out of order
			resolution: "Fix it",
			name: "Test Policy",
			description: "A test",
			platform: "darwin",
		},
	];

	const yaml = toYamlGitOps(policies);
	const lines = yaml.split('\n').filter(line => line.trim());
	
	// Check that fields appear in the expected order
	const nameIndex = lines.findIndex(line => line.includes('name: Test Policy'));
	const platformIndex = lines.findIndex(line => line.includes('platform: darwin'));
	const descriptionIndex = lines.findIndex(line => line.includes('description: A test'));
	const resolutionIndex = lines.findIndex(line => line.includes('resolution: Fix it'));
	const queryIndex = lines.findIndex(line => line.includes('query: SELECT 1'));

	expect(nameIndex).toBeLessThan(platformIndex);
	expect(platformIndex).toBeLessThan(descriptionIndex);
	expect(descriptionIndex).toBeLessThan(resolutionIndex);
	expect(resolutionIndex).toBeLessThan(queryIndex);
});

// ========================================
// Fleetctl Format Tests
// ========================================

test("toYamlFleetctlChunks generates individual fleetctl-ready files", () => {
	const policies = [
		{
			name: "Policy One",
			platform: "darwin",
			description: "First policy",
			resolution: "Fix one",
			query: "SELECT 1",
		},
		{
			name: "Policy Two",
			platform: "linux",
			description: "Second policy",
			resolution: "Fix two",
			query: "SELECT 2",
		},
	];

	const chunks = toYamlFleetctlChunks(policies);

	expect(Object.keys(chunks)).toHaveLength(2);
	expect(chunks).toHaveProperty("Policy_One");
	expect(chunks).toHaveProperty("Policy_Two");

	// Check Policy_One content
	expect(chunks.Policy_One).toContain("name: Policy One");
	expect(chunks.Policy_One).toContain("query: SELECT 1");
	expect(chunks.Policy_One).toContain("critical: false");
	expect(chunks.Policy_One).toContain("description: First policy");
	expect(chunks.Policy_One).toContain("resolution: Fix one");
	expect(chunks.Policy_One).toContain("platform: darwin");

	// Should NOT be wrapped in array format (no leading dash)
	expect(chunks.Policy_One).not.toContain("- name:");
});

test("toYamlFleetctlChunks maintains proper field ordering for Fleet", () => {
	const policies = [
		{
			platform: "darwin", // Intentionally out of order
			resolution: "Fix it",
			description: "A test",
			query: "SELECT 1",
			name: "Test Policy",
		},
	];

	const chunks = toYamlFleetctlChunks(policies);
	const yaml = chunks.Test_Policy;
	const lines = yaml.split('\n').filter(line => line.trim());
	
	// Check that fields appear in Fleet-preferred order: name, query, critical, description, resolution, platform
	const nameIndex = lines.findIndex(line => line.includes('name:'));
	const queryIndex = lines.findIndex(line => line.includes('query:'));
	const criticalIndex = lines.findIndex(line => line.includes('critical:'));
	const descriptionIndex = lines.findIndex(line => line.includes('description:'));
	const resolutionIndex = lines.findIndex(line => line.includes('resolution:'));
	const platformIndex = lines.findIndex(line => line.includes('platform:'));

	expect(nameIndex).toBeLessThan(queryIndex);
	expect(queryIndex).toBeLessThan(criticalIndex);
	expect(criticalIndex).toBeLessThan(descriptionIndex);
	expect(descriptionIndex).toBeLessThan(resolutionIndex);
	expect(resolutionIndex).toBeLessThan(platformIndex);
});

test("toYamlFleetctlChunks creates safe filenames from policy names", () => {
	const policies = [
		{ name: "Policy with spaces", query: "SELECT 1" },
		{ name: "Policy/with\\slashes", query: "SELECT 2" },
		{ name: "Policy-with-special@chars!", query: "SELECT 3" },
	];

	const chunks = toYamlFleetctlChunks(policies);

	expect(chunks).toHaveProperty("Policy_with_spaces");
	expect(chunks).toHaveProperty("Policy_with_slashes");
	expect(chunks).toHaveProperty("Policy-with-specialchars");
});

test("toYamlFleetctlChunks handles unknown policy names", () => {
	const policies = [
		{ query: "SELECT 1" }, // No name
		{ name: "", query: "SELECT 2" }, // Empty name
		{ name: "!!!@@@", query: "SELECT 3" }, // Name becomes empty after sanitization
	];

	const chunks = toYamlFleetctlChunks(policies);

	expect(Object.keys(chunks)).toHaveLength(3); // All should get unique keys
	
	// All policies with missing/empty names become "unknown_policy" with unique suffixes
	expect(chunks).toHaveProperty("unknown_policy");
	expect(chunks).toHaveProperty("unknown_policy_1");
	expect(chunks).toHaveProperty("unknown_policy_2");
});

test("toYamlFleetctlChunks rejects policy names with null bytes", () => {
	const policies = [{ name: "bad\0name", query: "SELECT 1" }];
	expect(() => toYamlFleetctlChunks(policies)).toThrow("Invalid policy name contains null bytes");
});

test("toYamlFleetctlChunks always includes critical field set to false", () => {
	const policies = [
		{ name: "Test Policy", query: "SELECT 1" },
	];

	const chunks = toYamlFleetctlChunks(policies);
	expect(chunks.Test_Policy).toContain("critical: false");
});
