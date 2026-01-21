import { Device, ReplicantError, ErrorCode } from "../types/index.js";

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

  autoSelectIfSingle(devices: Device[]): boolean {
    if (devices.length === 1 && !this.currentDevice) {
      this.currentDevice = devices[0];
      return true;
    }
    return false;
  }
}
