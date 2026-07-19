#!/usr/bin/env node

import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { parseArgs } from "node:util";
import { z } from "zod";
import path from "path";
import os from "os";
import fs from "fs";

const VERSION = require("../package.json").version as string;

type LaunchArgsInput = {
  udid: string;
  bundleId: string;
  terminateRunning?: boolean;
  env?: Record<string, string>;
};

type LaunchArgsOutput = {
  args: string[];
  env: Record<string, string>;
};

export function buildLaunchArgs({
  udid,
  bundleId,
  terminateRunning,
  env,
}: LaunchArgsInput): LaunchArgsOutput {
  const args: string[] = ["launch"];

  if (terminateRunning) {
    args.push("--terminate-running-process");
  }

  const simctlEnv: Record<string, string> = {};

  if (env) {
    const entries = Object.entries(env)
      .map(([key, value]) => [key.trim(), value] as const)
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [key, value] of entries) {
      if (!key) {
        throw new Error("Environment variable keys must be non-empty.");
      }
      simctlEnv[`SIMCTL_CHILD_${key}`] = value;
    }
  }

  args.push(udid, bundleId);
  return { args, env: simctlEnv };
}

const execFileAsync = promisify(execFile);

const UDID_REGEX =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

const udidSchema = z.string().regex(UDID_REGEX).optional();

const TMP_ROOT_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "ios-simulator-cli-")
);

type RunOptions = {
  env?: Record<string, string>;
};

async function run(
  cmd: string,
  args: string[],
  options: RunOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  const mergedEnv = options.env
    ? { ...process.env, ...options.env }
    : process.env;
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    shell: false,
    env: mergedEnv,
  });
  return {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

function getIdbPath(): string {
  const customPath =
    process.env.IOS_SIMULATOR_CLI_IDB_PATH ??
    process.env.IOS_SIMULATOR_MCP_IDB_PATH;

  if (customPath) {
    const expandedPath = customPath.startsWith("~/")
      ? path.join(os.homedir(), customPath.slice(2))
      : customPath;

    if (!fs.existsSync(expandedPath)) {
      throw new Error(
        `Custom IDB path specified in IOS_SIMULATOR_CLI_IDB_PATH does not exist: ${expandedPath}`
      );
    }

    return expandedPath;
  }

  const pythonBins: string[] = [];
  const pythonRoot = path.join(os.homedir(), "Library/Python");
  if (fs.existsSync(pythonRoot)) {
    for (const entry of fs.readdirSync(pythonRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      pythonBins.push(
        path.join(pythonRoot, entry.name, "bin/idb")
      );
    }
  }

  const candidates = preferWorkingIdb([
    path.join(os.homedir(), ".local/bin/idb"),
    ...pythonBins,
    "/opt/homebrew/bin/idb",
    "/usr/local/bin/idb",
  ].filter((candidate) => fs.existsSync(candidate)));

  if (candidates.length > 0) {
    return candidates[0];
  }

  return "idb";
}

/** Prefer arm64-friendly idb installs (Xcode/system Python) over Intel Homebrew Python. */
function preferWorkingIdb(candidates: string[]): string[] {
  const score = (idbPath: string): number => {
    try {
      const shebang = fs.readFileSync(idbPath, "utf8").split("\n", 1)[0] ?? "";
      if (shebang.includes("/usr/local/opt/python")) return 2;
      if (
        shebang.includes("Xcode.app") ||
        shebang.includes("/usr/bin/python") ||
        shebang.includes("/opt/homebrew/")
      ) {
        return 0;
      }
      return 1;
    } catch {
      return 1;
    }
  };

  return [...candidates].sort((a, b) => score(a) - score(b));
}

async function idb(...args: string[]) {
  return run(getIdbPath(), args);
}

function toError(input: unknown): Error {
  if (input instanceof Error) return input;

  if (
    typeof input === "object" &&
    input &&
    "message" in input &&
    typeof input.message === "string"
  )
    return new Error(input.message);

  return new Error(JSON.stringify(input));
}

function troubleshootingLink(): string {
  return "https://github.com/DebugSwift/ios-simulator-cli/blob/main/TROUBLESHOOTING.md";
}

function errorWithTroubleshooting(message: string): string {
  return `${message}\n\nFor help, see ${troubleshootingLink()}`;
}

async function getBootedDevice() {
  const { stdout, stderr } = await run("xcrun", ["simctl", "list", "devices"]);

  if (stderr) throw new Error(stderr);

  const lines = stdout.split("\n");
  for (const line of lines) {
    if (line.includes("Booted")) {
      const match = line.match(/\(([-0-9A-F]+)\)/);
      if (match) {
        const deviceId = match[1];
        const deviceName = line.split("(")[0].trim();
        return {
          name: deviceName,
          id: deviceId,
        };
      }
    }
  }

  throw Error("No booted simulator found");
}

async function getBootedDeviceId(
  deviceId: string | undefined
): Promise<string> {
  let actualDeviceId = deviceId;
  if (!actualDeviceId) {
    const { id } = await getBootedDevice();
    actualDeviceId = id;
  }
  if (!actualDeviceId) {
    throw new Error("No booted simulator found and no deviceId provided");
  }
  return actualDeviceId;
}

function ensureAbsolutePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }

  let defaultDir = path.join(os.homedir(), "Downloads");
  const customDefaultDir =
    process.env.IOS_SIMULATOR_CLI_DEFAULT_OUTPUT_DIR ??
    process.env.IOS_SIMULATOR_MCP_DEFAULT_OUTPUT_DIR;

  if (customDefaultDir) {
    if (customDefaultDir.startsWith("~/")) {
      defaultDir = path.join(os.homedir(), customDefaultDir.slice(2));
    } else {
      defaultDir = customDefaultDir;
    }
  }

  return path.join(defaultDir, filePath);
}

function parseEnvPairs(values: string[] | undefined): Record<string, string> {
  const env: Record<string, string> = {};
  for (const pair of values ?? []) {
    const separator = pair.indexOf("=");
    if (separator <= 0) {
      throw new Error(
        `Invalid env pair "${pair}". Expected format KEY=VALUE.`
      );
    }
    env[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return env;
}

type UiElement = Record<string, unknown>;

type FindElementOptions = {
  search: string[];
  type?: string;
  matchMode: "substring" | "exact";
  caseSensitive: boolean;
};

function matchesSearch(
  value: string | null,
  term: string,
  mode: "substring" | "exact",
  sensitive: boolean
): boolean {
  if (value == null) return false;
  const v = sensitive ? value : value.toLowerCase();
  const t = sensitive ? term : term.toLowerCase();
  return mode === "exact" ? v === t : v.includes(t);
}

function findUiElements(
  elements: UiElement[],
  options: FindElementOptions
): UiElement[] {
  const results: UiElement[] = [];

  for (const element of elements) {
    const label = element.AXLabel as string | null;
    const uniqueId = element.AXUniqueId as string | null;
    const elementType = element.type as string | undefined;

    const matchesAnySearch = options.search.some(
      (term) =>
        matchesSearch(label, term, options.matchMode, options.caseSensitive) ||
        matchesSearch(uniqueId, term, options.matchMode, options.caseSensitive)
    );

    const matchesType =
      options.type == null ||
      (elementType != null &&
        elementType.toLowerCase() === options.type.toLowerCase());

    if (matchesAnySearch && matchesType) {
      results.push(element);
    }

    const children = element.children as UiElement[] | undefined;
    if (children && children.length > 0) {
      results.push(...findUiElements(children, options));
    }
  }

  return results;
}

async function fetchUiTree(udid?: string): Promise<UiElement[]> {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(udid));
  const { stdout } = await idb(
    "ui",
    "describe-all",
    "--udid",
    actualUdid,
    "--json",
    "--nested"
  );

  return JSON.parse(stdout) as UiElement[];
}

function elementCenter(element: UiElement): { x: number; y: number } {
  const frame = element.frame as
    | { x?: unknown; y?: unknown; width?: unknown; height?: unknown }
    | undefined;

  if (
    !frame ||
    typeof frame.x !== "number" ||
    typeof frame.y !== "number" ||
    typeof frame.width !== "number" ||
    typeof frame.height !== "number"
  ) {
    throw new Error("Element has no valid frame for tapping");
  }

  return {
    x: Math.round(frame.x + frame.width / 2),
    y: Math.round(frame.y + frame.height / 2),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const matchModeSchema = z.enum(["substring", "exact"]);

const workflowSchema = z.object({
  udid: udidSchema,
  steps: z.array(z.record(z.unknown())).min(1),
});

async function cmdGetBootedSimId() {
  const { id, name } = await getBootedDevice();
  console.log(`Booted Simulator: "${name}". UUID: "${id}"`);
}

async function cmdOpenSimulator() {
  await run("open", ["-a", "Simulator.app"]);
  console.log("Simulator.app opened successfully");
}

async function cmdUiDescribeAll(udid?: string) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(udid));
  const { stdout } = await idb(
    "ui",
    "describe-all",
    "--udid",
    actualUdid,
    "--json",
    "--nested"
  );
  console.log(stdout);
}

async function cmdUiTap(options: {
  udid?: string;
  x: number;
  y: number;
  duration?: string;
}) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(options.udid));
  const { stderr } = await idb(
    "ui",
    "tap",
    "--udid",
    actualUdid,
    ...(options.duration ? ["--duration", options.duration] : []),
    "--json",
    "--",
    String(options.x),
    String(options.y)
  );

  if (stderr) throw new Error(stderr);
  console.log("Tapped successfully");
}

async function cmdUiType(text: string, udid?: string) {
  z.string().max(500).regex(/^[\x20-\x7E]+$/).parse(text);
  const actualUdid = await getBootedDeviceId(udidSchema.parse(udid));
  const { stderr } = await idb(
    "ui",
    "text",
    "--udid",
    actualUdid,
    "--",
    text
  );

  if (stderr) throw new Error(stderr);
  console.log("Typed successfully");
}

async function cmdUiSwipe(options: {
  udid?: string;
  xStart: number;
  yStart: number;
  xEnd: number;
  yEnd: number;
  duration?: string;
  delta?: number;
}) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(options.udid));
  const { stderr } = await idb(
    "ui",
    "swipe",
    "--udid",
    actualUdid,
    ...(options.duration ? ["--duration", options.duration] : []),
    ...(options.delta != null ? ["--delta", String(options.delta)] : []),
    "--json",
    "--",
    String(options.xStart),
    String(options.yStart),
    String(options.xEnd),
    String(options.yEnd)
  );

  if (stderr) throw new Error(stderr);
  console.log("Swiped successfully");
}

async function cmdUiDescribePoint(options: {
  udid?: string;
  x: number;
  y: number;
}) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(options.udid));
  const { stdout, stderr } = await idb(
    "ui",
    "describe-point",
    "--udid",
    actualUdid,
    "--json",
    "--",
    String(options.x),
    String(options.y)
  );

  if (stderr) throw new Error(stderr);
  console.log(stdout);
}

async function cmdUiFindElement(options: {
  udid?: string;
  search: string[];
  type?: string;
  matchMode: "substring" | "exact";
  caseSensitive: boolean;
}) {
  const uiData = await fetchUiTree(options.udid);
  console.log(JSON.stringify(findUiElements(uiData, options)));
}

async function cmdUiView(options: { udid?: string; output?: string }) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(options.udid));

  const { stdout: uiDescribeOutput } = await idb(
    "ui",
    "describe-all",
    "--udid",
    actualUdid,
    "--json",
    "--nested"
  );

  let uiData: unknown;
  try {
    uiData = JSON.parse(uiDescribeOutput);
  } catch {
    throw new Error(
      "Failed to parse screen dimensions: idb returned invalid JSON"
    );
  }

  const screenFrame = (
    uiData as Array<{ frame?: { width: unknown; height: unknown } }>
  )[0]?.frame;
  if (
    !screenFrame ||
    typeof screenFrame.width !== "number" ||
    typeof screenFrame.height !== "number" ||
    screenFrame.width <= 0 ||
    screenFrame.height <= 0
  ) {
    throw new Error(
      "Could not determine valid screen dimensions from idb output"
    );
  }

  const ts = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rawPng = path.join(TMP_ROOT_DIR, `ui-view-${ts}-raw.png`);
  const compressedJpg = path.join(
    TMP_ROOT_DIR,
    `ui-view-${ts}-compressed.jpg`
  );

  await run("xcrun", [
    "simctl",
    "io",
    actualUdid,
    "screenshot",
    "--type=png",
    "--",
    rawPng,
  ]);

  await run("sips", [
    "-z",
    String(screenFrame.height),
    String(screenFrame.width),
    "-s",
    "format",
    "jpeg",
    "-s",
    "formatOptions",
    "80",
    rawPng,
    "--out",
    compressedJpg,
  ]);

  if (options.output) {
    const outputPath = ensureAbsolutePath(options.output);
    fs.copyFileSync(compressedJpg, outputPath);
    console.log(`Screenshot saved to ${outputPath}`);
  } else {
    const base64Data = fs.readFileSync(compressedJpg).toString("base64");
    console.log(base64Data);
  }

  try {
    fs.unlinkSync(rawPng);
    fs.unlinkSync(compressedJpg);
  } catch {
    // ignore cleanup errors
  }
}

async function cmdScreenshot(options: {
  udid?: string;
  outputPath: string;
  type?: "png" | "tiff" | "bmp" | "gif" | "jpeg";
  display?: "internal" | "external";
  mask?: "ignored" | "alpha" | "black";
}) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(options.udid));
  const absolutePath = ensureAbsolutePath(options.outputPath);

  const { stderr: stdout } = await run("xcrun", [
    "simctl",
    "io",
    actualUdid,
    "screenshot",
    ...(options.type ? [`--type=${options.type}`] : []),
    ...(options.display ? [`--display=${options.display}`] : []),
    ...(options.mask ? [`--mask=${options.mask}`] : []),
    "--",
    absolutePath,
  ]);

  if (stdout && !stdout.includes("Wrote screenshot to")) {
    throw new Error(stdout);
  }

  console.log(stdout || `Screenshot saved to ${absolutePath}`);
}

async function cmdRecordVideo(options: {
  udid?: string;
  outputPath?: string;
  codec?: "h264" | "hevc";
  display?: "internal" | "external";
  mask?: "ignored" | "alpha" | "black";
  force?: boolean;
}) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(options.udid));
  const defaultFileName = `simulator_recording_${Date.now()}.mp4`;
  const outputFile = ensureAbsolutePath(options.outputPath ?? defaultFileName);

  const recordingProcess = spawn("xcrun", [
    "simctl",
    "io",
    actualUdid,
    "recordVideo",
    ...(options.codec ? [`--codec=${options.codec}`] : []),
    ...(options.display ? [`--display=${options.display}`] : []),
    ...(options.mask ? [`--mask=${options.mask}`] : []),
    ...(options.force ? ["--force"] : []),
    "--",
    outputFile,
  ]);

  await new Promise((resolve, reject) => {
    let errorOutput = "";
    let resolved = false;

    recordingProcess.stderr.on("data", (data) => {
      const message = data.toString();
      if (message.includes("Recording started")) {
        resolved = true;
        resolve(true);
      } else {
        errorOutput += message;
      }
    });

    recordingProcess.on("exit", (code) => {
      if (!resolved) {
        reject(
          new Error(
            errorOutput.trim() ||
              `Recording process exited early with code ${code}`
          )
        );
      }
    });

    setTimeout(() => {
      if (!resolved) {
        if (recordingProcess.killed || recordingProcess.exitCode !== null) {
          reject(
            new Error(
              errorOutput.trim() ||
                "Recording process terminated unexpectedly"
            )
          );
        } else {
          resolve(true);
        }
      }
    }, 5000);
  });

  console.log(
    `Recording started. The video will be saved to: ${outputFile}\nTo stop recording, run: ios-simulator-cli stop-recording`
  );
}

async function cmdStopRecording() {
  await run("pkill", ["-SIGINT", "-f", "simctl.*recordVideo"]);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log("Recording stopped successfully.");
}

async function cmdInstallApp(appPath: string, udid?: string) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(udid));
  const absolutePath = path.isAbsolute(appPath)
    ? appPath
    : path.resolve(appPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`App bundle not found at: ${absolutePath}`);
  }

  await run("xcrun", ["simctl", "install", actualUdid, absolutePath]);
  console.log(`App installed successfully from: ${absolutePath}`);
}

async function cmdLaunchApp(options: {
  udid?: string;
  bundleId: string;
  terminateRunning?: boolean;
  env?: Record<string, string>;
}) {
  const actualUdid = await getBootedDeviceId(udidSchema.parse(options.udid));

  const { args, env: simctlEnv } = buildLaunchArgs({
    udid: actualUdid,
    bundleId: options.bundleId,
    terminateRunning: options.terminateRunning,
    env: options.env,
  });

  const { stdout } = await run("xcrun", ["simctl", ...args], {
    env: simctlEnv,
  });

  const pidMatch = stdout.match(/^(\d+)/);
  const pid = pidMatch ? pidMatch[1] : null;

  console.log(
    pid
      ? `App ${options.bundleId} launched successfully with PID: ${pid}`
      : `App ${options.bundleId} launched successfully`
  );
}

function stepUdid(
  globalUdid: string | undefined,
  step: Record<string, unknown>
): string | undefined {
  const value = step.udid;
  if (value == null) return globalUdid;
  return udidSchema.parse(value);
}

function parseStepObject(step: unknown, index: number): Record<string, unknown> {
  if (typeof step !== "object" || step == null || Array.isArray(step)) {
    throw new Error(`Step ${index + 1}: expected an object`);
  }

  const keys = Object.keys(step);
  if (keys.length !== 1) {
    throw new Error(
      `Step ${index + 1}: expected exactly one action, got: ${keys.join(", ") || "(empty)"}`
    );
  }

  return step as Record<string, unknown>;
}

async function runWorkflowStep(
  action: string,
  payload: unknown,
  globalUdid: string | undefined,
  index: number
) {
  const stepLabel = `Step ${index + 1}: ${action}`;
  console.log(stepLabel);

  switch (action) {
    case "wait": {
      const ms = z.number().int().nonnegative().parse(payload);
      await sleep(ms);
      return;
    }
    case "open": {
      if (payload != null && payload !== true) {
        throw new Error(`${stepLabel} expects true or no value`);
      }
      await cmdOpenSimulator();
      return;
    }
    case "launch-app": {
      const step = z
        .object({
          bundleId: z.string().min(1),
          terminateRunning: z.boolean().optional(),
          env: z.record(z.string()).optional(),
          udid: udidSchema,
        })
        .parse(payload);
      await cmdLaunchApp({
        udid: stepUdid(globalUdid, step),
        bundleId: step.bundleId,
        terminateRunning: step.terminateRunning,
        env: step.env,
      });
      return;
    }
    case "install-app": {
      const step = z
        .object({
          appPath: z.string().min(1),
          udid: udidSchema,
        })
        .parse(payload);
      await cmdInstallApp(step.appPath, stepUdid(globalUdid, step));
      return;
    }
    case "tap": {
      const step = z
        .object({
          x: z.number().optional(),
          y: z.number().optional(),
          search: z.union([z.string(), z.array(z.string())]).optional(),
          type: z.string().optional(),
          matchMode: matchModeSchema.optional(),
          caseSensitive: z.boolean().optional(),
          index: z.number().int().nonnegative().optional(),
          duration: z.string().regex(/^\d+(\.\d+)?$/).optional(),
          udid: udidSchema,
        })
        .parse(payload);
      const udid = stepUdid(globalUdid, step);

      if (step.x != null && step.y != null) {
        await cmdUiTap({
          udid,
          x: step.x,
          y: step.y,
          duration: step.duration,
        });
        return;
      }

      if (step.search == null) {
        throw new Error(`${stepLabel} requires x/y or search`);
      }

      const search = Array.isArray(step.search) ? step.search : [step.search];
      const matches = findUiElements(await fetchUiTree(udid), {
        search,
        type: step.type,
        matchMode: step.matchMode ?? "substring",
        caseSensitive: step.caseSensitive ?? false,
      });

      const matchIndex = step.index ?? 0;
      if (matches.length === 0) {
        throw new Error(
          `${stepLabel} found no element matching: ${search.join(", ")}`
        );
      }
      if (matchIndex >= matches.length) {
        throw new Error(
          `${stepLabel} index ${matchIndex} out of range (${matches.length} matches)`
        );
      }

      const { x, y } = elementCenter(matches[matchIndex]);
      await cmdUiTap({ udid, x, y, duration: step.duration });
      return;
    }
    case "type": {
      const step = z
        .object({
          text: z.string().min(1).max(500).regex(/^[\x20-\x7E]+$/),
          udid: udidSchema,
        })
        .parse(payload);
      await cmdUiType(step.text, stepUdid(globalUdid, step));
      return;
    }
    case "swipe": {
      const step = z
        .object({
          xStart: z.number(),
          yStart: z.number(),
          xEnd: z.number(),
          yEnd: z.number(),
          duration: z.string().regex(/^\d+(\.\d+)?$/).optional(),
          delta: z.number().optional(),
          udid: udidSchema,
        })
        .parse(payload);
      await cmdUiSwipe({
        udid: stepUdid(globalUdid, step),
        xStart: step.xStart,
        yStart: step.yStart,
        xEnd: step.xEnd,
        yEnd: step.yEnd,
        duration: step.duration,
        delta: step.delta,
      });
      return;
    }
    case "screenshot": {
      const step = z
        .object({
          output: z.string().min(1),
          type: z.enum(["png", "tiff", "bmp", "gif", "jpeg"]).optional(),
          display: z.enum(["internal", "external"]).optional(),
          mask: z.enum(["ignored", "alpha", "black"]).optional(),
          udid: udidSchema,
        })
        .parse(payload);
      await cmdScreenshot({
        udid: stepUdid(globalUdid, step),
        outputPath: step.output,
        type: step.type,
        display: step.display,
        mask: step.mask,
      });
      return;
    }
    case "ui-view": {
      const step = z
        .object({
          output: z.string().optional(),
          udid: udidSchema,
        })
        .parse(payload);
      await cmdUiView({
        udid: stepUdid(globalUdid, step),
        output: step.output,
      });
      return;
    }
    default:
      throw new Error(
        `${stepLabel} uses unknown action "${action}". Run ios-simulator-cli run --help for supported actions.`
      );
  }
}

async function cmdRun(configPath: string) {
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch {
    throw new Error(`Invalid JSON in config file: ${absolutePath}`);
  }

  const workflow = workflowSchema.parse(parsed);

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = parseStepObject(workflow.steps[i], i);
    const [action, payload] = Object.entries(step)[0];
    await runWorkflowStep(action, payload, workflow.udid, i);
  }

  console.log(`Completed ${workflow.steps.length} step(s)`);
}

function printRunHelp() {
  console.log(`ios-simulator-cli run --config <path>

Run a JSON workflow file against the booted simulator.

Config format:
{
  "udid": "<optional-simulator-uuid>",
  "steps": [
    { "open": true },
    { "wait": 1000 },
    { "launch-app": { "bundleId": "com.example.app", "terminateRunning": true } },
    { "tap": { "search": "Sign In", "type": "Button" } },
    { "tap": { "x": 200, "y": 400 } },
    { "type": { "text": "hello@world.com" } },
    { "swipe": { "xStart": 200, "yStart": 600, "xEnd": 200, "yEnd": 200 } },
    { "screenshot": { "output": "result.png" } }
  ]
}

Supported step actions:
  wait              Milliseconds to pause (number)
  open              Open Simulator.app (true)
  launch-app        Launch app by bundle ID
  install-app       Install .app or .ipa
  tap               Tap by x/y or by accessibility search label
  type              Type ASCII text
  swipe             Swipe gesture
  screenshot        Save screenshot to file
  ui-view           Capture compressed JPEG view

Each step object must contain exactly one action key.
Step payloads may include an optional "udid" to override the config-level udid.
`);
}

function printHelp() {
  console.log(`ios-simulator-cli v${VERSION}

A command-line tool for interacting with iOS simulators.

Usage:
  ios-simulator-cli <command> [options]

Commands:
  get-booted-sim-id                     Get the booted simulator UUID
  open                                  Open Simulator.app
  ui describe-all [--udid <uuid>]       Describe all UI elements
  ui tap --x <n> --y <n> [--duration <s>] [--udid <uuid>]
  ui type <text> [--udid <uuid>]        Type text into the simulator
  ui swipe --x-start <n> --y-start <n> --x-end <n> --y-end <n> [--duration <s>] [--delta <n>] [--udid <uuid>]
  ui describe-point --x <n> --y <n> [--udid <uuid>]
  ui find-element --search <term> [--search <term>] [--type <type>] [--match-mode substring|exact] [--case-sensitive] [--udid <uuid>]
  ui view [--output <path>] [--udid <uuid>]
  screenshot --output <path> [--type png|jpeg|...] [--display internal|external] [--mask ignored|alpha|black] [--udid <uuid>]
  record-video [--output <path>] [--codec h264|hevc] [--display internal|external] [--mask ignored|alpha|black] [--force] [--udid <uuid>]
  stop-recording                        Stop an active simulator recording
  install-app --app-path <path> [--udid <uuid>]
  launch-app --bundle-id <id> [--terminate-running] [--env KEY=VALUE] [--udid <uuid>]
  run --config <path>                    Run a JSON workflow file

Global options:
  -h, --help                            Show this help
  -v, --version                         Show version

Environment variables:
  IOS_SIMULATOR_CLI_DEFAULT_OUTPUT_DIR  Default directory for relative output paths (default: ~/Downloads)
  IOS_SIMULATOR_CLI_IDB_PATH            Custom path to the idb executable

Examples:
  ios-simulator-cli get-booted-sim-id
  ios-simulator-cli ui tap --x 200 --y 400
  ios-simulator-cli screenshot --output home.png
  ios-simulator-cli launch-app --bundle-id com.apple.mobilesafari
  ios-simulator-cli run --config flow.json

Run ios-simulator-cli run --help for JSON workflow format.
`);
}

async function handleUiCommand(args: string[]) {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "describe-all": {
      const { values } = parseArgs({
        args: rest,
        options: { udid: { type: "string" } },
        allowPositionals: false,
      });
      await cmdUiDescribeAll(values.udid);
      return;
    }
    case "tap": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          x: { type: "string" },
          y: { type: "string" },
          duration: { type: "string" },
        },
        allowPositionals: false,
      });
      if (!values.x || !values.y) {
        throw new Error("ui tap requires --x and --y");
      }
      if (values.duration) {
        z.string().regex(/^\d+(\.\d+)?$/).parse(values.duration);
      }
      await cmdUiTap({
        udid: values.udid,
        x: Number(values.x),
        y: Number(values.y),
        duration: values.duration,
      });
      return;
    }
    case "type": {
      const { values, positionals } = parseArgs({
        args: rest,
        options: { udid: { type: "string" } },
        allowPositionals: true,
      });
      const text = positionals.join(" ");
      if (!text) {
        throw new Error("ui type requires text");
      }
      await cmdUiType(text, values.udid);
      return;
    }
    case "swipe": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          "x-start": { type: "string" },
          "y-start": { type: "string" },
          "x-end": { type: "string" },
          "y-end": { type: "string" },
          duration: { type: "string" },
          delta: { type: "string" },
        },
        allowPositionals: false,
      });
      if (!values["x-start"] || !values["y-start"] || !values["x-end"] || !values["y-end"]) {
        throw new Error(
          "ui swipe requires --x-start, --y-start, --x-end, and --y-end"
        );
      }
      await cmdUiSwipe({
        udid: values.udid,
        xStart: Number(values["x-start"]),
        yStart: Number(values["y-start"]),
        xEnd: Number(values["x-end"]),
        yEnd: Number(values["y-end"]),
        duration: values.duration,
        delta: values.delta ? Number(values.delta) : undefined,
      });
      return;
    }
    case "describe-point": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          x: { type: "string" },
          y: { type: "string" },
        },
        allowPositionals: false,
      });
      if (!values.x || !values.y) {
        throw new Error("ui describe-point requires --x and --y");
      }
      await cmdUiDescribePoint({
        udid: values.udid,
        x: Number(values.x),
        y: Number(values.y),
      });
      return;
    }
    case "find-element": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          search: { type: "string", multiple: true },
          type: { type: "string" },
          "match-mode": { type: "string" },
          "case-sensitive": { type: "boolean", default: false },
        },
        allowPositionals: false,
      });
      if (!values.search || values.search.length === 0) {
        throw new Error("ui find-element requires at least one --search value");
      }
      const matchMode = z.enum(["substring", "exact"]).parse(
        values["match-mode"] ?? "substring"
      );
      await cmdUiFindElement({
        udid: values.udid,
        search: values.search,
        type: values.type,
        matchMode,
        caseSensitive: values["case-sensitive"] ?? false,
      });
      return;
    }
    case "view": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          output: { type: "string" },
        },
        allowPositionals: false,
      });
      await cmdUiView({ udid: values.udid, output: values.output });
      return;
    }
    default:
      throw new Error(
        `Unknown ui subcommand: ${subcommand ?? "(none)"}. Run ios-simulator-cli --help for usage.`
      );
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    if (args[0] === "run") {
      printRunHelp();
      return;
    }
    printHelp();
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return;
  }

  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case "get-booted-sim-id":
      await cmdGetBootedSimId();
      return;
    case "open":
      await cmdOpenSimulator();
      return;
    case "ui":
      await handleUiCommand(rest);
      return;
    case "screenshot": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          output: { type: "string" },
          type: { type: "string" },
          display: { type: "string" },
          mask: { type: "string" },
        },
        allowPositionals: false,
      });
      if (!values.output) {
        throw new Error("screenshot requires --output");
      }
      await cmdScreenshot({
        udid: values.udid,
        outputPath: values.output,
        type: z
          .enum(["png", "tiff", "bmp", "gif", "jpeg"])
          .optional()
          .parse(values.type),
        display: z.enum(["internal", "external"]).optional().parse(values.display),
        mask: z.enum(["ignored", "alpha", "black"]).optional().parse(values.mask),
      });
      return;
    }
    case "record-video": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          output: { type: "string" },
          codec: { type: "string" },
          display: { type: "string" },
          mask: { type: "string" },
          force: { type: "boolean", default: false },
        },
        allowPositionals: false,
      });
      await cmdRecordVideo({
        udid: values.udid,
        outputPath: values.output,
        codec: z.enum(["h264", "hevc"]).optional().parse(values.codec),
        display: z.enum(["internal", "external"]).optional().parse(values.display),
        mask: z.enum(["ignored", "alpha", "black"]).optional().parse(values.mask),
        force: values.force,
      });
      return;
    }
    case "stop-recording":
      await cmdStopRecording();
      return;
    case "install-app": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          "app-path": { type: "string" },
        },
        allowPositionals: false,
      });
      if (!values["app-path"]) {
        throw new Error("install-app requires --app-path");
      }
      await cmdInstallApp(values["app-path"], values.udid);
      return;
    }
    case "launch-app": {
      const { values } = parseArgs({
        args: rest,
        options: {
          udid: { type: "string" },
          "bundle-id": { type: "string" },
          "terminate-running": { type: "boolean", default: false },
          env: { type: "string", multiple: true },
        },
        allowPositionals: false,
      });
      if (!values["bundle-id"]) {
        throw new Error("launch-app requires --bundle-id");
      }
      await cmdLaunchApp({
        udid: values.udid,
        bundleId: values["bundle-id"],
        terminateRunning: values["terminate-running"],
        env: parseEnvPairs(values.env),
      });
      return;
    }
    case "run": {
      if (rest.includes("--help") || rest.includes("-h")) {
        printRunHelp();
        return;
      }
      const { values } = parseArgs({
        args: rest,
        options: {
          config: { type: "string" },
        },
        allowPositionals: false,
      });
      if (!values.config) {
        printRunHelp();
        return;
      }
      await cmdRun(values.config);
      return;
    }
    default:
      throw new Error(
        `Unknown command: ${command}. Run ios-simulator-cli --help for usage.`
      );
  }
}

function cleanup() {
  try {
    fs.rmSync(TMP_ROOT_DIR, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

main()
  .catch((error) => {
    console.error(errorWithTroubleshooting(`Error: ${toError(error).message}`));
    process.exitCode = 1;
  })
  .finally(cleanup);
