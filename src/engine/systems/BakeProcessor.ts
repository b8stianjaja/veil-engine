/**
 * @file src/engine/systems/BakeProcessor.ts
 * @description Translates 3D Editor Spatial Layout data into 2D Runtime Layer Manifest.
 * Strictly maps Z-axis coordinates to Background, Gameplay, and Foreground layers.
 * Adheres strictly to Pillar 1 architectural rules.
 */

import { Entity, VeilProjectManifest } from '../../types';

export const BakeProcessor = {
  version: "2.5-Stable",

  async compile(rawMapData: {
    environment: any;
    data: Record<string, Entity>;
    timeline?: any[];
    drawingStrokes?: any[];
  }): Promise<VeilProjectManifest> {
    const manifest: VeilProjectManifest = {
      version: this.version,
      metadata: { hash: `v-${Date.now()}` },
      compileTime: Date.now(),
      environment: this.sanitizeEnvironment(rawMapData.environment),
      layers: { background: [], gameplay: [], foreground: [], ui: [] },
      colliders: [],
      timelineEvents: rawMapData.timeline || [],
      drawingStrokes: rawMapData.drawingStrokes || []
    };

    Object.entries(rawMapData.data).forEach(([uuid, entity]) => {
      const transform = this.sanitizeTransform(entity.transform);
      
      const runtimeEntity: any = {
        uuid,
        name: entity.name,
        behavior: entity.behavior,
        renderMeta: {
          depthKey: transform.position[2],
          screenOffset: [transform.position[0], transform.position[1]],
          scale2d: [transform.scale[0], transform.scale[1]],
          rotation2d: transform.rotation[2]
        },
        // NEW: Map physics config with defaults
        physics: {
          speed: entity.physics?.speed ?? 5.0,
          rotationSpeed: entity.physics?.rotationSpeed ?? 1.5,
          isSolid: entity.physics?.isSolid ?? true
        }
      };

      if (runtimeEntity.renderMeta.depthKey < -10) manifest.layers.background.push(runtimeEntity);
      else if (runtimeEntity.renderMeta.depthKey <= 10) manifest.layers.gameplay.push(runtimeEntity);
      else manifest.layers.foreground.push(runtimeEntity);

      if (entity.type !== 'MESH' || entity.isSensor) {
        manifest.colliders.push({
          entityUuid: uuid,
          isSensor: Boolean(entity.isSensor),
          behavior: entity.behavior
        });
      }
    });
    return manifest;
  },
  
  sanitizeEnvironment: (env: any) => ({
    clearColor: env?.clearColor || '#0B0B0C',
    cameraMode: env?.cameraMode || 'ISOMETRIC',
    cameraZoom: Number(env?.cameraZoom) || 40,
    fov: Number(env?.fov) || 45
  }),

  sanitizeTransform: (t: any) => ({
    position: (Array.isArray(t?.position) && t.position.length === 3) ? t.position : [0, 0, 0],
    rotation: (Array.isArray(t?.rotation) && t.rotation.length === 3) ? t.rotation : [0, 0, 0],
    scale: (Array.isArray(t?.scale) && t.scale.length === 3) ? t.scale : [1, 1, 1]
  })
};
export default BakeProcessor;