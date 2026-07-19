# Contributing to iOS Simulator CLI

Thank you for your interest in contributing to the iOS Simulator CLI! This guide outlines our contribution process and project philosophy.

## Project Philosophy

This project is **intentionally simple** and follows these core principles:

### Simplicity First

- **Single file architecture**: All logic is contained in `src/index.ts` to simplify bundling and maintenance
- **Minimal dependencies**: We keep dependencies minimal to ensure fast installs and small footprint on user machines
- **Standard tooling**: We use `npm` (universally available) and `tsc` (simple, already available) for building

### Real Use Cases Only

- New commands should be driven by **real use cases**, not hypothetical situations
- We are **not trying to include every possible command** - additional commands add maintenance burden without clear benefit
- The original use case: Give developers and automation scripts the ability to interact with iOS simulators from the command line

### Architectural Stability

- **No significant architecture changes** without prior discussion
- Major changes must be discussed with the author beforehand via GitHub issues or DMs
- Changes should address real pain points that cannot be solved by existing implementation or configuration

## Prerequisites

Before contributing, ensure you have:

- **macOS** (iOS simulators only work on macOS)
- **Node.js** installed
- **Xcode** and iOS simulators installed
- **Facebook IDB** tool installed ([installation guide](https://fbidb.io/docs/installation))

For additional context and references, see [CONTEXT.md](CONTEXT.md) which contains helpful links for iOS simulator commands and security considerations.

## Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/ios-simulator-cli.git
   cd ios-simulator-cli
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the project**

   ```bash
   npm run build
   ```

4. **Test during development**

   ```bash
   # Watch mode for development
   npm run watch

   # Run the CLI
   node build/index.js --help
   ```

## Making Changes

### Code Style

- Follow the existing TypeScript patterns in the codebase
- Use the existing error handling patterns with `toError()` and `errorWithTroubleshooting()`
- Maintain the single-file architecture - all logic stays in `src/index.ts`

### Adding New Commands

Before adding a new command, ask yourself:

1. **Is this driven by a real use case?** Provide specific examples of when this command would be needed
2. **Can existing commands solve this problem?** Check if current functionality can address the need
3. **Will this add significant value without cluttering the CLI?** Consider the trade-off between utility and complexity

If adding a new command:

1. Follow the existing command handler pattern
2. Use proper Zod schemas for input validation
3. Include comprehensive error handling with troubleshooting links
4. Use the `--` separator when passing user input to commands (security best practice)
5. Add the command to the README.md documentation

### Security Considerations

- Always use the `--` separator when passing user-provided arguments to shell commands
- Validate all inputs using Zod schemas
- Use `execFileAsync` with `shell: false` to prevent command injection
- Follow the existing patterns for UDID validation and path handling

For more security context, see the command injection resources in [CONTEXT.md](CONTEXT.md).

## Testing Requirements

Due to the nature of this project, **manual testing is required** for all changes:

### Testing Process

1. **Build your changes**

   ```bash
   npm run build
   ```

2. **Start an iOS simulator**

   ```bash
   xcrun simctl list devices
   xcrun simctl boot "iPhone 15"  # or your preferred device
   ```

3. **Test thoroughly**
   - Test all affected functionality
   - Test error conditions
   - Consider running the test cases in [QA.md](QA.md) to ensure existing functionality still works

### Required Documentation for Contributions

Include in your pull request:

- **Step-by-step testing instructions**
- **Screenshots or video** of the functionality working
- **Description of the real use case** that drove this change
- **Confirmation that existing functionality still works**

## Submitting Changes

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the guidelines above

3. **Test thoroughly** using the manual testing process

4. **Update documentation** if needed:
   - Add new commands to README.md
   - Update any relevant documentation

5. **Submit a pull request** with:
   - Clear description of the change and motivation
   - Step-by-step testing instructions
   - Screenshots/video of manual testing
   - Confirmation of real use case

## Release Process

- Releases are managed through the GitHub releases page
- The pipeline uses standard `npm publish` commands
- Update the Homebrew formula `sha256` when cutting a release
- Version bumping and release timing are handled by the maintainer

## Questions or Discussions

For significant changes or questions:

- Open a GitHub issue for discussion
- Reach out via DMs for architectural discussions
- Provide context about your specific use case

## Code of Conduct

- Be respectful and constructive in all interactions
- Focus on real use cases and practical solutions
- Respect the project's philosophy of intentional simplicity
- Provide thorough testing and documentation for contributions

Thank you for helping make iOS Simulator CLI better!
