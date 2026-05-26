/**
 * @file src/engine/systems/BrushEngine.ts
 * @description Raster Brush Engine for high-fidelity pen input.
 * Handles sub-segment smoothing and pressure-to-width mapping.
 * Strictly adheres to Pillar 1 architectural rules: 0% React, pure logic.
 */

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface BrushOptions {
  size: number;
  opacity: number;
  color: string;
}

export class BrushEngine {
  /**
   * Calculates interpolation points between segments to prevent "jagged" drawing
   * at high speeds. Uses linear interpolation for pressure and position.
   */
  public static interpolate(p1: StrokePoint, p2: StrokePoint, step: number): StrokePoint {
    return {
      x: p1.x + (p2.x - p1.x) * step,
      y: p1.y + (p2.y - p1.y) * step,
      pressure: p1.pressure + (p2.pressure - p1.pressure) * step,
    };
  }

  /**
   * Calculates the effective radius based on pen pressure.
   */
  public static getEffectiveSize(baseSize: number, pressure: number): number {
    // Clamp pressure to 0.1 minimum to ensure brush is always visible
    const p = Math.max(0.1, pressure);
    return baseSize * p;
  }
}