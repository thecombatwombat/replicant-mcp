import { describe, it, expect } from "vitest";
import { parseAvdList, parseEmulatorList } from "../../src/parsers/emulator-output.js";

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
