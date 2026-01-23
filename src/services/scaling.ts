/**
 * Calculate the scale factor needed to fit device dimensions within max dimension.
 * Returns 1.0 if no scaling needed.
 */
export function calculateScaleFactor(
  deviceWidth: number,
  deviceHeight: number,
  maxDimension: number
): number {
  const longestSide = Math.max(deviceWidth, deviceHeight);
  if (longestSide <= maxDimension) {
    return 1.0;
  }
  return longestSide / maxDimension;
}
