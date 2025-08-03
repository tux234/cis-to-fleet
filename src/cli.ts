#!/usr/bin/env node

// ABOUTME: Main CLI entry point for cis-to-fleet TypeScript version
// ABOUTME: Provides commands for listing platforms and generating Fleet-compatible YAML files

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { listFoldersSync, fetchYamlSync } from './github.js';
import { rawYamlToList, sanitizeAll, filterByLevel, toYaml, toYamlChunks } from './transform.js';
import { outputPath, write } from './writer.js';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

const program = new Command();

// Package version - in a real setup this would come from package.json
const VERSION = '0.1.0';

program
  .name('cis-to-fleet')
  .description('Convert CIS benchmarks to Fleet-compatible policy files')
  .version(VERSION);

/**
 * List command - shows all available CIS benchmark platforms
 */
program
  .command('list')
  .description('List all available CIS benchmark platforms')
  .action(async () => {
    const spinner = ora('Fetching platform list...').start();
    
    try {
      const folders = await listFoldersSync();
      spinner.succeed('Platform list fetched successfully');
      
      console.log(chalk.blue('\nAvailable platforms:'));
      for (const folder of folders) {
        console.log(`  ${folder}`);
      }
    } catch (error) {
      spinner.fail('Failed to fetch platform list');
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Generate command - creates Fleet-compatible YAML files for specified platforms
 */
program
  .command('generate')
  .description('Generate Fleet-compatible YAML files for specified platforms')
  .argument('[platforms...]', 'Platform names to generate (leave empty to use --all)')
  .option('-a, --all', 'Generate for all available platforms')
  .option('-l, --level <level>', 'CIS level to include: 1, 2, or all', 'all')
  .option('-f, --format <format>', 'Output format: combine (single file) or split (individual files per policy)', 'combine')
  .option('-o, --output <dir>', 'Output directory for generated files', './output')
  .option('--force', 'Overwrite existing files without prompting')
  .action(async (platforms: string[], options) => {
    // Validate arguments
    if (options.all && platforms.length > 0) {
      console.error(chalk.red('Error: Cannot specify both --all and platform names.'));
      process.exit(1);
    }
    
    if (!options.all && platforms.length === 0) {
      console.error(chalk.red('Error: Must specify either platform names or --all flag.'));
      process.exit(1);
    }
    
    if (!['1', '2', 'all'].includes(options.level)) {
      console.error(chalk.red(`Error: Invalid level '${options.level}'. Must be '1', '2', or 'all'.`));
      process.exit(1);
    }
    
    if (!['combine', 'split'].includes(options.format)) {
      console.error(chalk.red(`Error: Invalid format '${options.format}'. Must be 'combine' or 'split'.`));
      process.exit(1);
    }
    
    let platformsToProcess: string[];
    
    // Determine platforms to process
    if (options.all) {
      const spinner = ora('Fetching platform list...').start();
      try {
        platformsToProcess = await listFoldersSync();
        spinner.succeed(`Found ${platformsToProcess.length} platforms to process`);
      } catch (error) {
        spinner.fail('Failed to fetch platform list');
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
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
        if (options.level !== 'all') {
          rawItems = filterByLevel(rawItems, options.level);
        }
        
        const sanitizedItems = sanitizeAll(rawItems);
        
        if (options.format === 'combine') {
          // Generate single YAML file with all policies
          const outputYaml = toYaml(sanitizedItems);
          const filePath = outputPath(platform, options.output);
          
          spinner.text = `Writing combined file for ${platform}...`;
          await write(outputYaml, filePath, options.force);
          
          spinner.succeed(chalk.green(`Generated combined file: ${filePath}`));
        } else if (options.format === 'split') {
          // Generate individual YAML files for each policy
          const chunks = toYamlChunks(sanitizedItems);
          const platformDir = join(options.output, platform);
          
          spinner.text = `Creating directory and writing files for ${platform}...`;
          await mkdir(platformDir, { recursive: true });
          
          const chunkEntries = Object.entries(chunks);
          for (const [policyName, yamlContent] of chunkEntries) {
            const chunkPath = join(platformDir, `${policyName}.yml`);
            await write(yamlContent, chunkPath, options.force);
          }
          
          spinner.succeed(chalk.green(`Generated ${chunkEntries.length} individual policy files in: ${platformDir}`));
        }
      } catch (error) {
        spinner.fail(chalk.red(`Failed to process ${platform}`));
        
        if (error instanceof Error) {
          if (error.message.includes('File already exists')) {
            console.error(chalk.red(`Error: File for ${platform} already exists. Use --force to overwrite.`));
          } else {
            console.error(chalk.red(`Error processing ${platform}: ${error.message}`));
          }
        } else {
          console.error(chalk.red(`Unexpected error processing ${platform}: Unknown error`));
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
  .command('tui')
  .description('Launch the interactive TUI for platform selection')
  .action(() => {
    console.log(chalk.yellow('TUI functionality not yet implemented in TypeScript version.'));
    console.log(chalk.blue('Use the "list" and "generate" commands for now.'));
    process.exit(1);
  });

// Parse command line arguments
program.parse();