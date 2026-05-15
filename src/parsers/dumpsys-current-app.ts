export interface CurrentAppParseResult {
  packageName: string;
  activityName: string;
}

// The trailing `\s+` on ACTIVITIES_REGEX is load-bearing: it anchors the match
// to the `package/activity ` segment of a `mResumedActivity: ActivityRecord{...}`
// line and prevents matching the trailing `tNN}` token.
const ACTIVITIES_REGEX = /([a-zA-Z0-9_.]+)\/([a-zA-Z0-9_.]+)\s+/;
const WINDOW_REGEX = /([a-zA-Z0-9_.]+)\/([a-zA-Z0-9_.]+)/;

function findFirstMatch(
  stdout: string,
  marker: string,
  regex: RegExp
): CurrentAppParseResult | null {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes(marker)) continue;
    const match = line.match(regex);
    if (match) return { packageName: match[1], activityName: match[2] };
  }
  return null;
}

export function parseCurrentAppFromDumpsysActivities(
  stdout: string
): CurrentAppParseResult | null {
  return findFirstMatch(stdout, "mResumedActivity", ACTIVITIES_REGEX);
}

export function parseCurrentAppFromDumpsysWindow(
  stdout: string
): CurrentAppParseResult | null {
  return findFirstMatch(stdout, "mCurrentFocus", WINDOW_REGEX);
}
