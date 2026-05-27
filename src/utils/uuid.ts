/**
 * @file src/utils/uuid.ts
 * @description Browser-compatible UUID v4 generator using crypto.getRandomValues()
 */

/**
 * Generate a UUID v4 string using browser's crypto API
 */
export function v4(): string {
  // Generate 16 random bytes
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version to 4 (random)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant to RFC 4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Convert bytes to hex string with hyphens
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Alias for v4() to match uuid package API
 */
export const uuidv4 = v4;

export default { v4, uuidv4 };
