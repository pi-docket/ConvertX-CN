import { afterEach, beforeEach, expect, test } from "bun:test";
import { convert } from "../../src/converters/ffmpeg";
import type { ExecFileOptions } from "node:child_process";

let calls: string[][] = [];
let lastOptions: ExecFileOptions | undefined;

function mockExecFile(
  _cmd: string,
  args: string[],
  options: ExecFileOptions,
  callback: (err: Error | null, stdout: string, stderr: string) => void,
) {
  calls.push(args);
  lastOptions = options;
  if (args.includes("fail.mov")) {
    callback(new Error("mock failure"), "", "Fake stderr: fail");
  } else {
    callback(null, "Fake stdout", "");
  }
}

beforeEach(() => {
  calls = [];
  lastOptions = undefined;
  delete process.env.FFMPEG_ARGS;
  delete process.env.FFMPEG_OUTPUT_ARGS;
});

afterEach(() => {
  delete process.env.FFMPEG_ARGS;
  delete process.env.FFMPEG_OUTPUT_ARGS;
});

test("ignores surrounding whitespace in FFmpeg input and output arguments", async () => {
  process.env.FFMPEG_ARGS = "  -y\t ";
  process.env.FFMPEG_OUTPUT_ARGS = "\n -preset veryfast  ";
  await convert("in.mp4", "mp4", "mp4", "out.mp4", undefined, mockExecFile);
  expect(calls[0]).toEqual(["-y", "-i", "in.mp4", "-preset", "veryfast", "out.mp4"]);
});

test("3CX WAV fixes the sample rate, channels and codec after user output arguments", async () => {
  process.env.FFMPEG_OUTPUT_ARGS = " -ar 44100 -ac 2 -c:a pcm_f32le ";
  await convert("in.mp3", "mp3", "wav-3cx", "out.wav", undefined, mockExecFile);
  expect(calls[0]?.slice(-10)).toEqual([
    "-vn",
    "-ac",
    "1",
    "-ar",
    "8000",
    "-c:a",
    "pcm_s16le",
    "-f",
    "wav",
    "out.wav",
  ]);
});

test("converts a normal file", async () => {
  const originalConsoleLog = console.log;

  let loggedMessage = "";
  console.log = (msg) => {
    loggedMessage = msg;
  };

  const result = await convert("in.mp4", "mp4", "avi", "out.avi", undefined, mockExecFile);

  console.log = originalConsoleLog;

  expect(result).toBe("Done");
  expect(calls[0]).toEqual(expect.arrayContaining(["-i", "in.mp4", "out.avi"]));
  expect(loggedMessage).toBe("stdout: Fake stdout");
});

test("adds resize for ico output", async () => {
  const originalConsoleLog = console.log;

  let loggedMessage = "";
  console.log = (msg) => {
    loggedMessage = msg;
  };

  const result = await convert("in.png", "png", "ico", "out.ico", undefined, mockExecFile);

  console.log = originalConsoleLog;

  expect(result).toBe("Done: resized to 256x256");
  expect(calls[0]).toEqual(
    expect.arrayContaining(["-filter:v", expect.stringContaining("scale=")]),
  );
  expect(loggedMessage).toBe("stdout: Fake stdout");
});

test("uses libaom-av1 for av1.mp4", async () => {
  const originalConsoleLog = console.log;

  let loggedMessage = "";
  console.log = (msg) => {
    loggedMessage = msg;
  };

  await convert("in.mkv", "mkv", "av1.mp4", "out.mp4", undefined, mockExecFile);

  console.log = originalConsoleLog;

  expect(calls[0]).toEqual(expect.arrayContaining(["-c:v", "libaom-av1"]));
  expect(loggedMessage).toBe("stdout: Fake stdout");
});

test("uses libx264 for h264.mp4", async () => {
  const originalConsoleLog = console.log;

  let loggedMessage = "";
  console.log = (msg) => {
    loggedMessage = msg;
  };

  await convert("in.mkv", "mkv", "h264.mp4", "out.mp4", undefined, mockExecFile);

  console.log = originalConsoleLog;

  expect(calls[0]).toEqual(expect.arrayContaining(["-c:v", "libx264"]));
  expect(loggedMessage).toBe("stdout: Fake stdout");
});

test("uses libx265 for h265.mp4", async () => {
  const originalConsoleLog = console.log;

  let loggedMessage = "";
  console.log = (msg) => {
    loggedMessage = msg;
  };

  await convert("in.mkv", "mkv", "h265.mp4", "out.mp4", undefined, mockExecFile);

  console.log = originalConsoleLog;

  expect(calls[0]).toEqual(expect.arrayContaining(["-c:v", "libx265"]));
  expect(loggedMessage).toBe("stdout: Fake stdout");
});

test("uses libx266 for h266.mp4", async () => {
  const originalConsoleLog = console.log;

  let loggedMessage = "";
  console.log = (msg) => {
    loggedMessage = msg;
  };

  await convert("in.mkv", "mkv", "h266.mp4", "out.mp4", undefined, mockExecFile);

  console.log = originalConsoleLog;

  expect(calls[0]).toEqual(expect.arrayContaining(["-c:v", "libx266"]));
  expect(loggedMessage).toBe("stdout: Fake stdout");
});

test("respects FFMPEG_ARGS", async () => {
  process.env.FFMPEG_ARGS = "-hide_banner -y";

  const originalConsoleLog = console.log;

  let loggedMessage = "";
  console.log = (msg) => {
    loggedMessage = msg;
  };

  await convert("input.mov", "mov", "mp4", "output.mp4", undefined, mockExecFile);

  console.log = originalConsoleLog;

  expect(calls[0]?.slice(0, 2)).toEqual(["-hide_banner", "-y"]);
  expect(loggedMessage).toBe("stdout: Fake stdout");
});

test("fails on exec error", async () => {
  const originalConsoleError = console.error;

  let loggedMessage = "";
  console.error = (msg) => {
    loggedMessage = msg;
  };

  expect(convert("fail.mov", "mov", "mp4", "output.mp4", undefined, mockExecFile)).rejects.toThrow(
    "mock failure",
  );

  console.error = originalConsoleError;

  expect(loggedMessage).toBe("stderr: Fake stderr: fail");
});

test("logs stderr when execFile returns only stderr and no error", async () => {
  const originalConsoleError = console.error;

  let loggedMessage = "";
  console.error = (msg) => {
    loggedMessage = msg;
  };

  // Mock execFile to call back with no error, no stdout, but with stderr
  const mockExecFileStderrOnly = (
    _cmd: string,
    _args: string[],
    _options: ExecFileOptions,
    callback: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    callback(null, "", "Only stderr output");
  };

  await convert("input.mov", "mov", "mp4", "output.mp4", undefined, mockExecFileStderrOnly);

  console.error = originalConsoleError;

  expect(loggedMessage).toBe("stderr: Only stderr output");
});

test("passes a maxBuffer above the 1 MB default so long conversions don't overflow stderr (#565)", async () => {
  await convert("in.mkv", "mkv", "h264.mp4", "out.mp4", undefined, mockExecFile);

  // execFile's default maxBuffer is 1 MB; ffmpeg's progress output on a long
  // encode exceeds it and the conversion fails with "stderr maxBuffer length
  // exceeded". Lock in the raised buffer (must match FFMPEG_MAX_BUFFER in
  // ffmpeg.ts) so a regression to a smaller-but-still-over-1-MB value is caught.
  expect(lastOptions?.maxBuffer).toBe(1024 * 1024 * 64);
});
