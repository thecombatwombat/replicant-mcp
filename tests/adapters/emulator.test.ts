import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseAvdList, parseEmulatorList } from "../../src/parsers/emulator-output.js";
import { EmulatorAdapter } from "../../src/adapters/emulator.js";

describe("Emulator Output Parsing", () => {
  describe("parseAvdList", () => {
    it("parses avdmanager list output", () => {
      const output = `Available Android Virtual Devices:
    Name: Pixel_7_API_34
    Path: /Users/test/.android/avd/Pixel_7_API_34.avd
  Target: Google APIs (Google Inc.)
          Based on: Android 14.0 (UpsideDownCake)
    Skin: pixel_7
---------
    Name: Nexus_5_API_30
    Path: /Users/test/.android/avd/Nexus_5_API_30.avd
  Target: Google APIs (Google Inc.)
          Based on: Android 11.0 (R)
    Skin: nexus_5
`;
      const avds = parseAvdList(output);
      expect(avds).toHaveLength(2);
      expect(avds[0].name).toBe("Pixel_7_API_34");
      expect(avds[1].name).toBe("Nexus_5_API_30");
    });
  });

  describe("parseEmulatorList", () => {
    it("parses running emulator list", () => {
      const output = `emulator-5554
emulator-5556
`;
      const running = parseEmulatorList(output);
      expect(running).toEqual(["emulator-5554", "emulator-5556"]);
    });
  });
});

describe("EmulatorAdapter.start", () => {
  let mockRunner: {
    runAdb: ReturnType<typeof vi.fn>;
    runEmulator: ReturnType<typeof vi.fn>;
  };
  let adapter: EmulatorAdapter;

  beforeEach(() => {
    mockRunner = {
      runAdb: vi.fn(),
      runEmulator: vi.fn(),
    };
    adapter = new EmulatorAdapter(mockRunner as any);
    // runEmulator returns a promise that "times out" (rejects) as expected
    mockRunner.runEmulator.mockRejectedValue(new Error("timeout"));
  });

  it("returns the correct emulator when starting with no others running", async () => {
    // Before start: no emulators
    // After start: one emulator
    mockRunner.runAdb
      .mockResolvedValueOnce({ stdout: "List of devices attached\n\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "List of devices attached\nemulator-5554\tdevice\n", stderr: "", exitCode: 0 });

    const result = await adapter.start("Pixel_7");
    expect(result).toBe("emulator-5554");
  });

  it("returns the new emulator when others are already running", async () => {
    // Before start: emulator-5554 already running
    // After start: emulator-5554 + emulator-5556
    mockRunner.runAdb
      .mockResolvedValueOnce({ stdout: "List of devices attached\nemulator-5554\tdevice\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n", stderr: "", exitCode: 0 });

    const result = await adapter.start("Nexus_5");
    expect(result).toBe("emulator-5556");
  });

  it("falls back to AVD name matching when multiple new emulators appear", async () => {
    // Before start: emulator-5554
    // After start: emulator-5554 + emulator-5556 + emulator-5558 (two new ones)
    mockRunner.runAdb
      .mockResolvedValueOnce({ stdout: "List of devices attached\nemulator-5554\tdevice\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\nemulator-5558\tdevice\n", stderr: "", exitCode: 0 })
      // AVD name query for emulator-5556
      .mockResolvedValueOnce({ stdout: "Other_AVD\nOK\n", stderr: "", exitCode: 0 })
      // AVD name query for emulator-5558
      .mockResolvedValueOnce({ stdout: "MyTarget\nOK\n", stderr: "", exitCode: 0 });

    const result = await adapter.start("MyTarget");
    expect(result).toBe("emulator-5558");
  });

  it("uses last-resort AVD name matching when no new emulators detected", async () => {
    // Before and after show same emulators (race condition: emulator registered before snapshot)
    mockRunner.runAdb
      .mockResolvedValueOnce({ stdout: "List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "List of devices attached\nemulator-5554\tdevice\nemulator-5556\tdevice\n", stderr: "", exitCode: 0 })
      // AVD name queries for all current emulators
      .mockResolvedValueOnce({ stdout: "Pixel_7\nOK\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "Nexus_5\nOK\n", stderr: "", exitCode: 0 });

    const result = await adapter.start("Nexus_5");
    expect(result).toBe("emulator-5556");
  });

  it("throws when emulator fails to start", async () => {
    // No emulators before or after
    mockRunner.runAdb
      .mockResolvedValueOnce({ stdout: "List of devices attached\n\n", stderr: "", exitCode: 0 })
      .mockResolvedValueOnce({ stdout: "List of devices attached\n\n", stderr: "", exitCode: 0 });

    await expect(adapter.start("BadAVD")).rejects.toThrow("failed to start");
  });
});
