# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the iOS Simulator CLI - a command-line tool for interacting with iOS simulators. The project follows an **intentionally simple** single-file architecture where all logic is contained in `src/index.ts`.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Build the TypeScript project (compiles to build/)
npm run build

# Development with automatic rebuild on changes
npm run watch

# Run the CLI
npm start -- --help
ios-simulator-cli get-booted-sim-id
```

## Architecture

The entire CLI implementation is in `src/index.ts` (single file by design). The tool:
- Exposes subcommands for iOS simulator interaction
- Wraps `xcrun simctl` and Facebook's `idb` commands
- Validates all inputs with Zod schemas
- Implements security best practices with `--` argument separation
- Handles output paths with `IOS_SIMULATOR_CLI_DEFAULT_OUTPUT_DIR` environment variable

## Available Commands

- `get-booted-sim-id` - Get the currently booted simulator ID
- `open` - Open the iOS Simulator application
- `ui describe-all` - Get accessibility info for the entire screen
- `ui tap` - Tap at coordinates
- `ui type` - Input text
- `ui swipe` - Swipe gesture
- `ui describe-point` - Get element at specific coordinates
- `ui find-element` - Search accessibility tree for elements by label, identifier, or type
- `ui view` - Get compressed screenshot as base64 JPEG or save to file
- `screenshot` - Save screenshot to file
- `record-video` - Start video recording
- `stop-recording` - Stop video recording
- `install-app` - Install an app bundle (.app or .ipa) on the simulator
- `launch-app` - Launch an app by bundle identifier

## Testing

This project requires **manual testing** on macOS with:
- Xcode and iOS simulators installed
- Facebook IDB tool installed

Test changes by:
1. Building with `npm run build`
2. Running commands from `QA.md`

## Important Design Principles

- **Keep it simple**: Single file, minimal dependencies, standard tooling (npm/tsc)
- **Real use cases only**: Don't add hypothetical features
- **Security first**: Always use `--` separator for user inputs, validate with Zod
- **No architecture changes** without discussion - the single-file design is intentional

## Additional Documentation

For more detailed information, refer to these documentation files:

- **[README.md](README.md)** - Complete project documentation including installation instructions, available commands, configuration options, and usage examples
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Contribution guidelines, development setup, dependency management, and the project's philosophy of intentional simplicity
- **[QA.md](QA.md)** - Manual quality assurance test cases for validating functionality
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and their solutions, including IDB installation help
- **[SECURITY.md](SECURITY.md)** - Security policy and information about fixed vulnerabilities
- **[CONTEXT.md](CONTEXT.md)** - Reference links for iOS simulator commands, IDB commands, and security best practices
