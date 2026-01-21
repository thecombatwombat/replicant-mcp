export type DeviceType = "emulator" | "physical";
export type DeviceStatus = "online" | "offline" | "booting";

export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  status: DeviceStatus;
}

export interface DeviceState {
  currentDevice: Device | null;
}
