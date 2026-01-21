import { describe, it, expect, beforeEach } from "vitest";
import { DeviceStateManager } from "../../src/services/device-state.js";

describe("DeviceStateManager", () => {
  let state: DeviceStateManager;

  beforeEach(() => {
    state = new DeviceStateManager();
  });

  describe("current device", () => {
    it("starts with no device selected", () => {
      expect(state.getCurrentDevice()).toBeNull();
    });

    it("selects a device", () => {
      state.setCurrentDevice({
        id: "emulator-5554",
        type: "emulator",
        name: "Pixel_7_API_34",
        status: "online",
      });

      const device = state.getCurrentDevice();
      expect(device?.id).toBe("emulator-5554");
      expect(device?.type).toBe("emulator");
    });

    it("clears the current device", () => {
      state.setCurrentDevice({
        id: "emulator-5554",
        type: "emulator",
        name: "Pixel_7_API_34",
        status: "online",
      });
      state.clearCurrentDevice();
      expect(state.getCurrentDevice()).toBeNull();
    });
  });

  describe("requireCurrentDevice", () => {
    it("throws when no device selected", () => {
      expect(() => state.requireCurrentDevice()).toThrow("No device selected");
    });

    it("returns device when selected", () => {
      state.setCurrentDevice({
        id: "emulator-5554",
        type: "emulator",
        name: "Pixel_7_API_34",
        status: "online",
      });
      const device = state.requireCurrentDevice();
      expect(device.id).toBe("emulator-5554");
    });
  });

  describe("auto-selection", () => {
    it("auto-selects when only one device available", () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "Pixel", status: "online" as const },
      ];
      state.autoSelectIfSingle(devices);
      expect(state.getCurrentDevice()?.id).toBe("emulator-5554");
    });

    it("does not auto-select when multiple devices available", () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "Pixel", status: "online" as const },
        { id: "emulator-5556", type: "emulator" as const, name: "Nexus", status: "online" as const },
      ];
      state.autoSelectIfSingle(devices);
      expect(state.getCurrentDevice()).toBeNull();
    });
  });
});
