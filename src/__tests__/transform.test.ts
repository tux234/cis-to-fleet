// ABOUTME: Tests for the transform module functions
// ABOUTME: Covers YAML parsing, sanitization, filtering, and output formatting

import { test, expect } from 'bun:test';
import { rawYamlToList, sanitize, sanitizeAll, filterByLevel, toYaml, toYamlChunks } from '../transform.js';

const samplePolicy = {
  name: 'Test Policy',
  platform: 'darwin',
  description: 'A test policy',
  resolution: 'Fix it',
  query: 'SELECT 1',
  tags: 'CIS_Level1,security',
  extraField: 'should be removed'
};

test('sanitize removes extra fields and keeps allowed ones', () => {
  const result = sanitize(samplePolicy);
  
  expect(result).toEqual({
    name: 'Test Policy',
    platform: 'darwin', 
    description: 'A test policy',
    resolution: 'Fix it',
    query: 'SELECT 1'
  });
  
  expect(result).not.toHaveProperty('tags');
  expect(result).not.toHaveProperty('extraField');
});

test('sanitizeAll processes array of policies', () => {
  const policies = [samplePolicy, { name: 'Policy 2', query: 'SELECT 2', extra: 'remove' }];
  const result = sanitizeAll(policies);
  
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({
    name: 'Test Policy',
    platform: 'darwin',
    description: 'A test policy', 
    resolution: 'Fix it',
    query: 'SELECT 1'
  });
  expect(result[1]).toEqual({
    name: 'Policy 2',
    query: 'SELECT 2'
  });
});

test('filterByLevel filters policies by CIS level', () => {
  const policies = [
    { name: 'Level 1 Policy', tags: 'CIS_Level1' },
    { name: 'Level 2 Policy', tags: 'CIS_Level2' },
    { name: 'Both Levels', tags: 'CIS_Level1,CIS_Level2' },
    { name: 'No Level', tags: 'other' }
  ];
  
  const level1 = filterByLevel(policies, '1');
  expect(level1).toHaveLength(2);
  expect(level1.map(p => p.name)).toEqual(['Level 1 Policy', 'Both Levels']);
  
  const level2 = filterByLevel(policies, '2');
  expect(level2).toHaveLength(2);
  expect(level2.map(p => p.name)).toEqual(['Level 2 Policy', 'Both Levels']);
});

test('filterByLevel throws error for invalid level', () => {
  expect(() => filterByLevel([], '3')).toThrow('Invalid level');
});

test('toYaml generates proper YAML output', () => {
  const policies = [{ name: 'Test', query: 'SELECT 1' }];
  const yaml = toYaml(policies);
  
  expect(yaml).toContain('- name: Test');
  expect(yaml).toContain('  query: SELECT 1');
});

test('toYamlChunks generates individual YAML files', () => {
  const policies = [
    { name: 'Policy One', query: 'SELECT 1' },
    { name: 'Policy Two', query: 'SELECT 2' }
  ];
  
  const chunks = toYamlChunks(policies);
  
  expect(Object.keys(chunks)).toHaveLength(2);
  expect(chunks['Policy_One']).toContain('name: Policy One');
  expect(chunks['Policy_Two']).toContain('name: Policy Two');
  
  // Should include critical: false
  expect(chunks['Policy_One']).toContain('critical: false');
});

test('rawYamlToList handles basic YAML array', () => {
  const yaml = `
- name: Policy 1
  query: SELECT 1
- name: Policy 2  
  query: SELECT 2
`;
  
  const result = rawYamlToList(yaml);
  expect(result).toHaveLength(2);
  expect(result[0].name).toBe('Policy 1');
  expect(result[1].name).toBe('Policy 2');
});

test('rawYamlToList handles Kubernetes-style documents', () => {
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
  expect(result[0].name).toBe('Test Policy');
  expect(result[1].name).toBe('Another Policy');
});

test('rawYamlToList throws error for empty YAML', () => {
  expect(() => rawYamlToList('')).toThrow('No policies found');
});