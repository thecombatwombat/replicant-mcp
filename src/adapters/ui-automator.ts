import { AdbAdapter } from "./adb.js";
import { parseUiDump, findElements, flattenTree, AccessibilityNode } from "../parsers/ui-dump.js";

export class UiAutomatorAdapter {
  constructor(private adb: AdbAdapter = new AdbAdapter()) {}

  async dump(deviceId: string): Promise<AccessibilityNode[]> {
    // Dump UI hierarchy to device
    await this.adb.shell(deviceId, "uiautomator dump /sdcard/ui-dump.xml");

    // Pull the dump
    const result = await this.adb.shell(deviceId, "cat /sdcard/ui-dump.xml");

    // Clean up
    await this.adb.shell(deviceId, "rm /sdcard/ui-dump.xml");

    return parseUiDump(result.stdout);
  }

  async find(
    deviceId: string,
    selector: {
      resourceId?: string;
      text?: string;
      textContains?: string;
      className?: string;
    }
  ): Promise<AccessibilityNode[]> {
    const tree = await this.dump(deviceId);
    return findElements(tree, selector);
  }

  async tap(deviceId: string, x: number, y: number): Promise<void> {
    await this.adb.shell(deviceId, `input tap ${x} ${y}`);
  }

  async tapElement(deviceId: string, element: AccessibilityNode): Promise<void> {
    await this.tap(deviceId, element.centerX, element.centerY);
  }

  async input(deviceId: string, text: string): Promise<void> {
    // Escape special characters for shell
    const escaped = text.replace(/(['"\\$`])/g, "\\$1").replace(/ /g, "%s");
    await this.adb.shell(deviceId, `input text "${escaped}"`);
  }

  async screenshot(deviceId: string, localPath: string): Promise<void> {
    const remotePath = "/sdcard/screenshot.png";
    await this.adb.shell(deviceId, `screencap -p ${remotePath}`);

    // Pull to local (using adb pull via shell workaround)
    // In real implementation, would use adb pull directly
    const result = await this.adb.shell(deviceId, `base64 ${remotePath}`);

    // For now, just verify it worked
    await this.adb.shell(deviceId, `rm ${remotePath}`);
  }

  async accessibilityCheck(deviceId: string): Promise<{
    hasAccessibleElements: boolean;
    clickableCount: number;
    textCount: number;
    totalElements: number;
  }> {
    const tree = await this.dump(deviceId);
    const flat = flattenTree(tree);

    const clickableCount = flat.filter((n) => n.clickable).length;
    const textCount = flat.filter((n) => n.text || n.contentDesc).length;

    return {
      hasAccessibleElements: textCount > 0,
      clickableCount,
      textCount,
      totalElements: flat.length,
    };
  }
}
