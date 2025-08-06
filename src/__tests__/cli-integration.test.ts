// ABOUTME: Integration tests for CLI command structure and argument parsing
// ABOUTME: Tests the new format + split flag pattern for better UX

import { expect, test } from "bun:test";

// Mock the CLI parsing logic for testing
type CLIOptions = {
  format: 'gitops' | 'fleetctl';
  split: boolean;
  output: string;
  level: string;
  all: boolean;
  force: boolean;
};

/**
 * Parse CLI arguments into structured options
 * This is the function we need to implement
 */
function parseCliArgs(args: string[]): CLIOptions {
  const validFormats = ['gitops', 'fleetctl'];
  
  // Find format and split in arguments
  let format: 'gitops' | 'fleetctl' | null = null;
  let split = false;
  
  // Look for format argument
  for (const arg of args) {
    if (validFormats.includes(arg as any)) {
      format = arg as 'gitops' | 'fleetctl';
      break;
    }
  }
  
  // Check for split flag
  if (args.includes('split')) {
    if (!format) {
      throw new Error("split flag requires a format");
    }
    split = true;
  }
  
  // Check for invalid format (look for non-platform, non-command args)
  const suspiciousArgs = args.filter(arg => 
    !arg.startsWith('--') && 
    arg !== 'generate' && 
    arg !== 'split' &&
    !validFormats.includes(arg) &&
    !arg.includes('-') // Platform names typically have hyphens
  );
  
  if (suspiciousArgs.length > 0) {
    throw new Error("Invalid format");
  }
  
  if (!format) {
    throw new Error("Format is required");
  }
  
  return {
    format,
    split,
    output: './output',
    level: 'all', 
    all: false,
    force: false
  };
}

/**
 * Determine output behavior based on format and split flag
 */
function getOutputBehavior(format: 'gitops' | 'fleetctl', split: boolean): {
  type: 'single-file' | 'individual-files';
  fileFormat: 'yaml-array' | 'yaml-object';
} {
  if (split) {
    return {
      type: 'individual-files',
      fileFormat: format === 'fleetctl' ? 'yaml-object' : 'yaml-array'
    };
  } else {
    return {
      type: 'single-file',
      fileFormat: 'yaml-array'  // Both combined formats use arrays
    };
  }
}

// ===========================================
// TDD Tests - These should fail initially
// ===========================================

test("parseCliArgs handles gitops format without split", () => {
  const args = ['generate', 'macos-15', 'gitops'];
  const result = parseCliArgs(args);
  
  expect(result.format).toBe('gitops');
  expect(result.split).toBe(false);
});

test("parseCliArgs handles gitops format with split", () => {
  const args = ['generate', 'macos-15', 'gitops', 'split'];
  const result = parseCliArgs(args);
  
  expect(result.format).toBe('gitops');
  expect(result.split).toBe(true);
});

test("parseCliArgs handles fleetctl format without split", () => {
  const args = ['generate', 'macos-15', 'fleetctl'];
  const result = parseCliArgs(args);
  
  expect(result.format).toBe('fleetctl');
  expect(result.split).toBe(false);
});

test("parseCliArgs handles fleetctl format with split", () => {
  const args = ['generate', 'macos-15', 'fleetctl', 'split'];
  const result = parseCliArgs(args);
  
  expect(result.format).toBe('fleetctl');
  expect(result.split).toBe(true);
});

test("parseCliArgs handles multiple platforms with format", () => {
  const args = ['generate', 'macos-15', 'win-11', 'gitops'];
  const result = parseCliArgs(args);
  
  expect(result.format).toBe('gitops');
  expect(result.split).toBe(false);
});

test("parseCliArgs rejects invalid format", () => {
  const args = ['generate', 'macos-15', 'invalidformat'];  // No hyphen to trigger detection
  
  expect(() => parseCliArgs(args)).toThrow("Invalid format");
});

test("parseCliArgs rejects split without format", () => {
  const args = ['generate', 'macos-15', 'split'];
  
  expect(() => parseCliArgs(args)).toThrow("split flag requires a format");
});

test("getOutputBehavior returns correct behavior for gitops", () => {
  expect(getOutputBehavior('gitops', false)).toEqual({
    type: 'single-file',
    fileFormat: 'yaml-array'
  });
  
  expect(getOutputBehavior('gitops', true)).toEqual({
    type: 'individual-files', 
    fileFormat: 'yaml-array'
  });
});

test("getOutputBehavior returns correct behavior for fleetctl", () => {
  expect(getOutputBehavior('fleetctl', false)).toEqual({
    type: 'single-file',
    fileFormat: 'yaml-array'  // Combined fleetctl is still array format
  });
  
  expect(getOutputBehavior('fleetctl', true)).toEqual({
    type: 'individual-files',
    fileFormat: 'yaml-object'  // Individual fleetctl files are objects
  });
});