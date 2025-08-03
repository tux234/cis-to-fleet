# CIS to Fleet - TypeScript Version

Convert CIS benchmarks to Fleet-compatible policy files using modern TypeScript tooling.

## Features

- 🚀 **Fast**: Built with Bun for rapid development and execution
- 🔧 **Compatible**: Works with both Bun and Node.js runtimes  
- 📦 **Type-safe**: Full TypeScript support with strict type checking
- 🧪 **Tested**: Comprehensive test suite using Bun's built-in test runner
- ⚡ **Modern**: Uses latest JavaScript features and best practices

## Prerequisites

- **Bun** (recommended): Install from [bun.sh](https://bun.sh/)
- **Node.js 18+** (alternative): For environments where Bun isn't available

## Installation & Usage

### With Bun (Recommended)

```bash
# Install dependencies
bun install

# Run directly with Bun (fastest)
bun run src/cli.ts list
bun run src/cli.ts generate macos-15

# Or build and run
bun run build
node dist/cli.js list
```

### With Node.js

```bash
# Install dependencies (if you don't have Bun)
npm install

# Run with tsx
npx tsx src/cli.ts list
npx tsx src/cli.ts generate macos-15

# Or build with TypeScript compiler
npm run build:node
node dist/cli.js list
```

## Commands

### List Available Platforms
```bash
bun run src/cli.ts list
```

### Generate Fleet YAML Files
```bash
# Generate for specific platforms
bun run src/cli.ts generate macos-15 win-11

# Generate for all platforms
bun run src/cli.ts generate --all

# Filter by CIS level
bun run src/cli.ts generate macos-15 --level 1

# Split into individual files per policy
bun run src/cli.ts generate macos-15 --format split

# Custom output directory
bun run src/cli.ts generate macos-15 --output ./my-policies

# Force overwrite existing files
bun run src/cli.ts generate macos-15 --force
```

## Development

### Running Tests
```bash
# With Bun (recommended)
bun test

# With Node.js
npm run test:node
```

### Code Quality
```bash
# Lint and format
bun run lint
bun run lint:fix
```

### Build Process
```bash
# Build with Bun (single file bundle)
bun run build

# Build with TypeScript compiler (separate files)
bun run build:node
```

## Project Structure

```
src/
├── cli.ts          # Main CLI entry point
├── github.ts       # GitHub API client  
├── transform.ts    # YAML parsing and transformation
├── writer.ts       # File writing utilities
└── __tests__/      # Test suite
    ├── transform.test.ts
    └── writer.test.ts
```

## Key Features

### Dual Runtime Support
The project is designed to work seamlessly with both Bun and Node.js:

- **Development**: Use Bun for fastest iteration
- **Deployment**: Use Node.js for maximum compatibility
- **CI/CD**: Test with both runtimes

### Type Safety
All code is fully typed with strict TypeScript configuration:
- No implicit `any` types
- Strict null checks
- Comprehensive error handling

### Performance
- Uses native `fetch` API (no external HTTP libraries needed)
- Optimized YAML processing
- Efficient file I/O with Node.js built-ins

## Migration from Python

This TypeScript version provides feature parity with the Python implementation:

| Python Module | TypeScript Module | Status |
|---------------|-------------------|--------|
| `__main__.py` | `cli.ts` | ✅ Complete |
| `github.py` | `github.ts` | ✅ Complete |
| `transform.py` | `transform.ts` | ✅ Complete |
| `writer.py` | `writer.ts` | ✅ Complete |
| `tui/` | - | 🚧 Planned |

### Breaking Changes
- TUI functionality not yet implemented (use CLI commands)
- Different command-line library (Commander.js vs Typer)
- Different error message formatting

## Contributing

1. Ensure Bun is installed for development
2. Run tests: `bun test`
3. Check linting: `bun run lint`
4. Test both runtimes before submitting

## License

MIT