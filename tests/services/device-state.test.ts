import { describe, it, expect, beforeEach, vi } from "vitest";
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

    it("skips offline devices during auto-select", () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "Pixel", status: "offline" as const },
      ];
      state.autoSelectIfSingle(devices);
      expect(state.getCurrentDevice()).toBeNull();
    });

    it("skips unauthorized devices during auto-select", () => {
      const devices = [
        { id: "device-1234", type: "physical" as const, name: "Phone", status: "unauthorized" as const },
      ];
      state.autoSelectIfSingle(devices);
      expect(state.getCurrentDevice()).toBeNull();
    });

    it("auto-selects the one online device among mixed statuses", () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "Pixel", status: "offline" as const },
        { id: "device-1234", type: "physical" as const, name: "Phone", status: "online" as const },
      ];
      state.autoSelectIfSingle(devices);
      expect(state.getCurrentDevice()?.id).toBe("device-1234");
    });
  });

  describe("ensureDevice", () => {
    it("returns current device if already selected", async () => {
      const device = { id: "emulator-5554", type: "emulator" as const, name: "test", status: "online" as const };
      state.setCurrentDevice(device);
      const mockAdb = { getDevices: vi.fn() };

      const result = await state.ensureDevice(mockAdb as any);

      expect(result).toBe(device);
      expect(mockAdb.getDevices).not.toHaveBeenCalled();
    });

    it("auto-selects when exactly one device connected", async () => {
      const device = { id: "emulator-5554", type: "emulator" as const, name: "test", status: "online" as const };
      const mockAdb = { getDevices: vi.fn().mockResolvedValue([device]) };

      const result = await state.ensureDevice(mockAdb as any);

      expect(result).toEqual(device);
      expect(state.getCurrentDevice()).toEqual(device);
    });

    it("throws NO_DEVICES when no devices connected", async () => {
      const mockAdb = { getDevices: vi.fn().mockResolvedValue([]) };

      await expect(state.ensureDevice(mockAdb as any)).rejects.toMatchObject({
        code: "NO_DEVICES",
        suggestion: expect.stringContaining("emulator"),
      });
    });

    it("throws MULTIPLE_DEVICES when multiple devices connected", async () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "test1", status: "online" as const },
        { id: "device-1234", type: "physical" as const, name: "test2", status: "online" as const },
      ];
      const mockAdb = { getDevices: vi.fn().mockResolvedValue(devices) };

      await expect(state.ensureDevice(mockAdb as any)).rejects.toMatchObject({
        code: "MULTIPLE_DEVICES",
        message: expect.stringContaining("emulator-5554"),
      });
    });

    it("throws DEVICE_OFFLINE when only device is offline", async () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "test", status: "offline" as const },
      ];
      const mockAdb = { getDevices: vi.fn().mockResolvedValue(devices) };

      await expect(state.ensureDevice(mockAdb as any)).rejects.toMatchObject({
        code: "DEVICE_OFFLINE",
        message: expect.stringContaining("offline"),
      });
    });

    it("throws DEVICE_OFFLINE with auth suggestion when device is unauthorized", async () => {
      const devices = [
        { id: "device-1234", type: "physical" as const, name: "test", status: "unauthorized" as const },
      ];
      const mockAdb = { getDevices: vi.fn().mockResolvedValue(devices) };

      await expect(state.ensureDevice(mockAdb as any)).rejects.toMatchObject({
        code: "DEVICE_OFFLINE",
        suggestion: expect.stringContaining("authorization"),
      });
    });

    it("auto-selects the one online device when others are offline", async () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "test1", status: "offline" as const },
        { id: "device-1234", type: "physical" as const, name: "test2", status: "online" as const },
      ];
      const mockAdb = { getDevices: vi.fn().mockResolvedValue(devices) };

      const result = await state.ensureDevice(mockAdb as any);
      expect(result.id).toBe("device-1234");
    });

    it("throws MULTIPLE_DEVICES only counting online devices", async () => {
      const devices = [
        { id: "emulator-5554", type: "emulator" as const, name: "test1", status: "online" as const },
        { id: "device-1234", type: "physical" as const, name: "test2", status: "online" as const },
        { id: "device-5678", type: "physical" as const, name: "test3", status: "offline" as const },
      ];
      const mockAdb = { getDevices: vi.fn().mockResolvedValue(devices) };

      await expect(state.ensureDevice(mockAdb as any)).rejects.toMatchObject({
        code: "MULTIPLE_DEVICES",
        message: expect.stringContaining("2 devices"),
      });
    });
  });
});
