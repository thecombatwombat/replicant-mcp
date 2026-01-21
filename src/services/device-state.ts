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
    const devices = await adb.getDevices();

    if (devices.length === 0) {
      throw new ReplicantError(
        ErrorCode.NO_DEVICES,
        "No devices connected",
        "Start an emulator with 'emulator-device start' or connect a USB device with debugging enabled"
      );
    }

    if (devices.length === 1) {
      this.currentDevice = devices[0];
      return this.currentDevice;
    }

    // Multiple devices - user must choose
    const deviceList = devices.map((d) => d.id).join(", ");
    throw new ReplicantError(
      ErrorCode.MULTIPLE_DEVICES,
      `${devices.length} devices connected: ${deviceList}`,
      `Call adb-device({ operation: 'select', deviceId: '...' }) to choose one`
    );
  }

  autoSelectIfSingle(devices: Device[]): boolean {
    if (devices.length === 1 && !this.currentDevice) {
      this.currentDevice = devices[0];
      return true;
    }
    return false;
  }
}
