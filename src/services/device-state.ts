import { Device, ReplicantError, ErrorCode } from "../types/index.js";
import type { AdbAdapter } from "../adapters/adb.js";

export class DeviceStateManager {
  private currentDevice: Device | null = null;

  getCurrentDevice(): Device | null {
    return this.currentDevice;
  }

  setCurrentDevice(device: Device): void {
    this.currentDevice = device;
  }

  clearCurrentDevice(): void {
    this.currentDevice = null;
  }

  requireCurrentDevice(): Device {
    if (!this.currentDevice) {
      throw new ReplicantError(
        ErrorCode.NO_DEVICE_SELECTED,
        "No device selected",
        "Call adb-device({ operation: 'list' }) to see available devices"
      );
    }
    return this.currentDevice;
  }

  async ensureDevice(adb: AdbAdapter): Promise<Device> {
    // Already selected? Use it.
    if (this.currentDevice) {
      return this.currentDevice;
    }

    // Try to auto-select
    const allDevices = await adb.getDevices();
    const onlineDevices = allDevices.filter((d) => d.status === "online");

    if (allDevices.length === 0) {
      throw new ReplicantError(
        ErrorCode.NO_DEVICES,
        "No devices connected",
        "Start an emulator with 'emulator-device start' or connect a USB device with debugging enabled"
      );
    }

    if (onlineDevices.length === 0) {
      const statuses = allDevices.map((d) => `${d.id} (${d.status})`).join(", ");
      const suggestion = allDevices.some((d) => d.status === "unauthorized")
        ? "Check the USB debugging authorization prompt on the device and tap 'Allow'"
        : "Wait for the device to come online or restart it with 'adb reconnect'";
      throw new ReplicantError(
        ErrorCode.DEVICE_OFFLINE,
        `No online devices available. Found: ${statuses}`,
        suggestion
      );
    }

    if (onlineDevices.length === 1) {
      this.currentDevice = onlineDevices[0];
      return this.currentDevice;
    }

    // Multiple online devices - user must choose
    const deviceList = onlineDevices.map((d) => d.id).join(", ");
    throw new ReplicantError(
      ErrorCode.MULTIPLE_DEVICES,
      `${onlineDevices.length} devices connected: ${deviceList}`,
      `Call adb-device({ operation: 'select', deviceId: '...' }) to choose one`
    );
  }

  autoSelectIfSingle(devices: Device[]): boolean {
    const onlineDevices = devices.filter((d) => d.status === "online");
    if (onlineDevices.length === 1 && !this.currentDevice) {
      this.currentDevice = onlineDevices[0];
      return true;
    }
    return false;
  }
}
