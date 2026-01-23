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

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Convert device coordinates to image coordinates.
 */
export function toImageSpace(
  deviceX: number,
  deviceY: number,
  scaleFactor: number
): { x: number; y: number } {
  if (scaleFactor === 1.0) {
    return { x: deviceX, y: deviceY };
  }
  return {
    x: Math.round(deviceX / scaleFactor),
    y: Math.round(deviceY / scaleFactor),
  };
}

/**
 * Convert image coordinates to device coordinates.
 */
export function toDeviceSpace(
  imageX: number,
  imageY: number,
  scaleFactor: number
): { x: number; y: number } {
  if (scaleFactor === 1.0) {
    return { x: imageX, y: imageY };
  }
  return {
    x: Math.round(imageX * scaleFactor),
    y: Math.round(imageY * scaleFactor),
  };
}

/**
 * Convert bounds from device space to image space.
 */
export function boundsToImageSpace(bounds: Bounds, scaleFactor: number): Bounds {
  if (scaleFactor === 1.0) {
    return bounds;
  }
  return {
    left: Math.round(bounds.left / scaleFactor),
    top: Math.round(bounds.top / scaleFactor),
    right: Math.round(bounds.right / scaleFactor),
    bottom: Math.round(bounds.bottom / scaleFactor),
  };
}
