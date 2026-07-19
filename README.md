# iOS Simulator CLI

[![NPM Version](https://img.shields.io/npm/v/ios-simulator-cli)](https://www.npmjs.com/package/ios-simulator-cli)

A command-line tool for interacting with iOS simulators. Control UI, capture screenshots and video, install apps, and inspect accessibility elements from your terminal or automation scripts.

> **Security Notice**: Command injection vulnerabilities present in versions < 1.3.3 have been fixed. Please update to v1.3.3 or later. See [SECURITY.md](SECURITY.md) for details.

## Installation

### Homebrew (recommended)

The formula lives in this repo, so tap it explicitly (Homebrew otherwise looks for a separate `homebrew-ios-simulator-cli` repo that does not exist):

```bash
brew tap DebugSwift/ios-simulator-cli https://github.com/DebugSwift/ios-simulator-cli
brew install ios-simulator-cli
```

To install the latest from `main`:

```bash
brew install --HEAD ios-simulator-cli
```

### npm

```bash
npm install -g ios-simulator-cli
```

### From source

```bash
git clone https://github.com/DebugSwift/ios-simulator-cli
cd ios-simulator-cli
npm install
npm run build
npm link
```

## Prerequisites

- macOS (iOS simulators are only available on macOS)
- [Xcode](https://developer.apple.com/xcode/resources/) and iOS simulators installed
- Facebook [IDB](https://fbidb.io/) tool ([install guide](https://fbidb.io/docs/installation))

## Usage

```bash
ios-simulator-cli --help
ios-simulator-cli --version
```

### Commands

| Command | Description |
| --- | --- |
| `get-booted-sim-id` | Get the booted simulator UUID |
| `open` | Open Simulator.app |
| `ui describe-all` | Describe all UI accessibility elements |
| `ui tap` | Tap at coordinates |
| `ui type` | Input text |
| `ui swipe` | Swipe gesture |
| `ui describe-point` | Get element at coordinates |
| `ui find-element` | Search accessibility tree |
| `ui view` | Capture compressed screenshot (JPEG base64 or file) |
| `screenshot` | Save screenshot to file |
| `record-video` | Start video recording |
| `stop-recording` | Stop video recording |
| `install-app` | Install an app bundle (.app or .ipa) |
| `launch-app` | Launch an app by bundle identifier |

### Examples

```bash
# Get the booted simulator
ios-simulator-cli get-booted-sim-id

# Open Simulator.app
ios-simulator-cli open

# Describe the current screen
ios-simulator-cli ui describe-all

# Tap at coordinates
ios-simulator-cli ui tap --x 200 --y 400

# Type text
ios-simulator-cli ui type "Hello World"

# Swipe down
ios-simulator-cli ui swipe --x-start 200 --y-start 600 --x-end 200 --y-end 200

# Find a button by label
ios-simulator-cli ui find-element --search "Search" --type Button

# Save a screenshot
ios-simulator-cli screenshot --output home.png

# Capture a compressed view to a file
ios-simulator-cli ui view --output screen.jpg

# Start and stop recording
ios-simulator-cli record-video --output demo.mp4
ios-simulator-cli stop-recording

# Install and launch an app
ios-simulator-cli install-app --app-path ./MyApp.app
ios-simulator-cli launch-app --bundle-id com.apple.mobilesafari --terminate-running
ios-simulator-cli launch-app --bundle-id com.example.app --env FOO=bar --env BAZ=qux
```

## Configuration

### Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `IOS_SIMULATOR_CLI_DEFAULT_OUTPUT_DIR` | Default directory for relative output paths (screenshots, recordings). Defaults to `~/Downloads`. | `~/Code/project/tmp` |
| `IOS_SIMULATOR_CLI_IDB_PATH` | Custom path to the IDB executable. Defaults to `idb` on PATH. | `~/bin/idb` |

Legacy `IOS_SIMULATOR_MCP_*` environment variables are still supported for output directory and IDB path.

## License

MIT
