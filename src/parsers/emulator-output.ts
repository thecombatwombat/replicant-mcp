export interface AvdInfo {
  name: string;
  path?: string;
  target?: string;
  skin?: string;
}

export function parseAvdList(output: string): AvdInfo[] {
  const avds: AvdInfo[] = [];
  const blocks = output.split("---------");

  for (const block of blocks) {
    const nameMatch = block.match(/Name:\s*(.+)/);
    if (!nameMatch) continue;

    const pathMatch = block.match(/Path:\s*(.+)/);
    const targetMatch = block.match(/Target:\s*(.+)/);
    const skinMatch = block.match(/Skin:\s*(.+)/);

    avds.push({
      name: nameMatch[1].trim(),
      path: pathMatch?.[1].trim(),
      target: targetMatch?.[1].trim(),
      skin: skinMatch?.[1].trim(),
    });
  }

  return avds;
}

export function parseEmulatorList(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("emulator-"));
}

export function parseSnapshotList(output: string): string[] {
  // Output format: "snapshot_name    size    date"
  return output
    .split("\n")
    .slice(1) // Skip header
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}
