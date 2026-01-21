import { describe, it, expect } from "vitest";
import { parseDeviceList, parsePackageList } from "../../src/parsers/adb-output.js";

describe("ADB Output Parsing", () => {
  describe("parseDeviceList", () => {
    it("parses device list output", () => {
      const output = `List of devices attached
emulator-5554\tdevice
192.168.1.100:5555\tdevice
`;
      const devices = parseDeviceList(output);
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        id: "emulator-5554",
        type: "emulator",
        name: "emulator-5554",
        status: "online",
      });
      expect(devices[1]).toEqual({
        id: "192.168.1.100:5555",
        type: "physical",
        name: "192.168.1.100:5555",
        status: "online",
      });
    });

    it("handles offline devices", () => {
      const output = `List of devices attached
emulator-5554\toffline
`;
      const devices = parseDeviceList(output);
      expect(devices[0].status).toBe("offline");
    });

    it("handles empty device list", () => {
      const output = `List of devices attached

`;
      const devices = parseDeviceList(output);
      expect(devices).toHaveLength(0);
    });
  });

  describe("parsePackageList", () => {
    it("parses package list output", () => {
      const output = `package:com.example.app
package:com.android.chrome
package:com.google.android.gms
`;
      const packages = parsePackageList(output);
      expect(packages).toEqual([
        "com.example.app",
        "com.android.chrome",
        "com.google.android.gms",
      ]);
    });
  });
});
