#!/usr/bin/env node

// ABOUTME: Main CLI entry point for cis-to-fleet TypeScript version
// ABOUTME: Provides commands for listing platforms and generating Fleet-compatible YAML files

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import packageJson from "../package.json" with { type: "json" };
import { fetchYamlSync, listFoldersSync } from "./github.js";
import {
	filterByLevel,
	rawYamlToList,
	sanitizeAll,
	toYamlChunks,
	toYamlGitOps,
	toYamlFleetctl,
	toYamlFleetctlChunks,
} from "./transform.js";
import { outputPath, write } from "./writer.js";

const program = new Command();

// Read version dynamically from package.json
const VERSION = packageJson.version;

program
	.name("cis-to-fleet")
	.description("Convert CIS benchmarks to Fleet-compatible policy files")
	.version(VERSION);

/**
 * List command - shows all available CIS benchmark platforms
 */
program
	.command("list")
	.description("List all available CIS benchmark platforms")
	.action(async () => {
		const spinner = ora("Fetching platform list...").start();

		try {
			const folders = await listFoldersSync();
			spinner.succeed("Platform list fetched successfully");

			console.log(chalk.blue("\nAvailable platforms:"));
			for (const folder of folders) {
				console.log(`  ${folder}`);
			}
		} catch (error) {
			spinner.fail("Failed to fetch platform list");
			console.error(
				chalk.red(
					`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
				),
			);
			process.exit(1);
		}
	});

/**
 * Generate command - creates Fleet-compatible YAML files for specified platforms  
 * 
 * Usage:
 *   generate macos-15 gitops           # Single GitOps file
 *   generate macos-15 gitops split     # Individual GitOps files
 *   generate macos-15 fleetctl         # Single fleetctl file  
 *   generate macos-15 fleetctl split   # Individual fleetctl files
 */
program
	.command("generate")
	.description("Generate Fleet-compatible YAML files for specified platforms\n\nExamples:\n  bun run src/cli.ts generate macos-15 gitops\n  bun run src/cli.ts generate macos-15 fleetctl split\n  bun run src/cli.ts generate win-11 macos-15 gitops")
	.argument(
		"<platforms...>",
		"Platform names, format (gitops|fleetctl), and optional 'split' modifier. Example: macos-15 gitops split",
	)
	.option("-a, --all", "Generate for all available platforms")
	.option("-l, --level <level>", "CIS level to include: 1, 2, or all", "all")
	.option(
		"-o, --output <dir>",
		"Output directory for generated files",
		"./output",
	)
	.option("--force", "Overwrite existing files without prompting")
	.action(async (platformArgs: string[], options) => {
		// Parse the new format: [platforms...] format [split]
		const validFormats = ['gitops', 'fleetctl'];
		
		// Find format in arguments
		let format: 'gitops' | 'fleetctl' | null = null;
		let split = false;
		const platforms: string[] = [];
		
		for (const arg of platformArgs) {
			if (validFormats.includes(arg as any)) {
				format = arg as 'gitops' | 'fleetctl';
			} else if (arg === 'split') {
				split = true;
			} else {
				platforms.push(arg);
			}
		}
		
		// Validation
		if (!format) {
			console.error(chalk.red("Error: Format is required (gitops or fleetctl)."));
			console.error(chalk.blue("Usage: generate macos-15 gitops [split]"));
			process.exit(1);
		}
		
		if (split && !format) {
			console.error(chalk.red("Error: split flag requires a format."));
			process.exit(1);
		}
		
		if (options.all && platforms.length > 0) {
			console.error(
				chalk.red("Error: Cannot specify both --all and platform names."),
			);
			process.exit(1);
		}

		if (!options.all && platforms.length === 0) {
			console.error(
				chalk.red("Error: Must specify platform names."),
			);
			console.error(chalk.blue("Usage: generate macos-15 gitops [split]"));
			process.exit(1);
		}

		if (!["1", "2", "all"].includes(options.level)) {
			console.error(
				chalk.red(
					`Error: Invalid level '${options.level}'. Must be '1', '2', or 'all'.`,
				),
			);
			process.exit(1);
		}

		let platformsToProcess: string[];

		// Determine platforms to process
		if (options.all) {
			const spinner = ora("Fetching platform list...").start();
			try {
				platformsToProcess = await listFoldersSync();
				spinner.succeed(
					`Found ${platformsToProcess.length} platforms to process`,
				);
			} catch (error) {
				spinner.fail("Failed to fetch platform list");
				console.error(
					chalk.red(
						`Error: ${error instanceof Error ? error.message : "Unknown error"}`,
					),
				);
				process.exit(1);
			}
		} else {
			platformsToProcess = platforms;
		}

		let exitCode = 0;

		for (const platform of platformsToProcess) {
			const spinner = ora(`Processing ${platform}...`).start();

			try {
				// Fetch raw YAML content
				spinner.text = `Fetching YAML for ${platform}...`;
				const rawYaml = await fetchYamlSync(platform);

				// Parse and transform
				spinner.text = `Transforming data for ${platform}...`;
				let rawItems = rawYamlToList(rawYaml);

				// Filter by level if specified
				if (options.level !== "all") {
					rawItems = filterByLevel(rawItems, options.level);
				}

				const sanitizedItems = sanitizeAll(rawItems);

				if (!split) {
					// Single file output - different formats
					const outputYaml = format === "gitops" 
						? toYamlGitOps(sanitizedItems)
						: toYamlFleetctl(sanitizedItems);
					const filePath = outputPath(platform, options.output, format);

					spinner.text = `Writing ${format} file for ${platform}...`;
					await write(outputYaml, filePath, options.force);

					spinner.succeed(chalk.green(`Generated ${format} file: ${filePath}`));
				} else {
					// Individual files output
					if (format === "gitops") {
						// GitOps individual files (YAML arrays)
						const chunks = toYamlChunks(sanitizedItems);
						const platformDir = join(options.output, `${platform}-gitops`);

						spinner.text = `Creating GitOps individual files for ${platform}...`;
						await mkdir(platformDir, { recursive: true });

						const chunkEntries = Object.entries(chunks);
						for (const [policyName, yamlContent] of chunkEntries) {
							const chunkPath = join(platformDir, `${policyName}.yml`);
							await write(yamlContent, chunkPath, options.force);
						}

						spinner.succeed(
							chalk.green(
								`Generated ${chunkEntries.length} GitOps individual files in: ${platformDir}`,
							),
						);
					} else if (format === "fleetctl") {
						// Fleetctl individual files (YAML objects)
						const chunks = toYamlFleetctlChunks(sanitizedItems);
						const platformDir = join(options.output, `${platform}-fleetctl`);

						spinner.text = `Creating fleetctl individual files for ${platform}...`;
						await mkdir(platformDir, { recursive: true });

						const chunkEntries = Object.entries(chunks);
						for (const [policyName, yamlContent] of chunkEntries) {
							const chunkPath = join(platformDir, `${policyName}.yml`);
							await write(yamlContent, chunkPath, options.force);
						}

						spinner.succeed(
							chalk.green(
								`Generated ${chunkEntries.length} fleetctl individual files in: ${platformDir}`,
							),
						);
					}
				}
			} catch (error) {
				spinner.fail(chalk.red(`Failed to process ${platform}`));

				if (error instanceof Error) {
					if (error.message.includes("File already exists")) {
						console.error(
							chalk.red(
								`Error: File for ${platform} already exists. Use --force to overwrite.`,
							),
						);
					} else {
						console.error(
							chalk.red(`Error processing ${platform}: ${error.message}`),
						);
					}
				} else {
					console.error(
						chalk.red(`Unexpected error processing ${platform}: Unknown error`),
					);
				}

				exitCode = 1;
			}
		}

		if (exitCode !== 0) {
			process.exit(exitCode);
		}
	});

/**
 * TUI command - launches interactive interface (placeholder for now)
 */
program
	.command("tui")
	.description("Launch the interactive TUI for platform selection")
	.action(() => {
		console.log(
			chalk.yellow(
				"TUI functionality not yet implemented in TypeScript version.",
			),
		);
		console.log(chalk.blue('Use the "list" and "generate" commands for now.'));
		process.exit(1);
	});

// Parse command line arguments
program.parse();
