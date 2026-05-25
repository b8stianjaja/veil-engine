/**
 * @file src/engine/systems/BakeProcessor.ts
 * @description Translates 3D Editor Spatial Layout data into 2D Runtime Layer Manifest.
 * Strictly maps Z-axis coordinates to Background, Gameplay, and Foreground layers.
 * Adheres strictly to Pillar 1 architectural rules.
 */

import { Entity, VeilProjectManifest } from '../../types';

export const BakeProcessor = {
  version: "2.5-Hand Drawn",

  /**
   * Compiles 3D spatial entity coordinates into layered, depth-sorted 2D manifests.
   * @param rawMapData Object containing raw system and entity data
   * @returns Output manifest structure.
   */
  async compile(rawMapData: {
    environment: any;
    data: Record<string, Entity>;
    timeline?: any[];
    drawingStrokes?: any[];
  }): Promise<VeilProjectManifest> {
    console.log("[Bake Pipeline] Compiling 3D Spatial Canvas to 2D Manifest...");

    const manifest: VeilProjectManifest = {
      version: this.version,
      metadata: {
        hash: `veil-25d-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
      compileTime: Date.now(),
      environment: this.sanitizeEnvironment(rawMapData.environment),
      layers: {
        background: [],
        gameplay: [],
        foreground: [],
        ui: []
      },
      colliders: [],
      timelineEvents: Array.isArray(rawMapData.timeline) ? rawMapData.timeline : [],
      drawingStrokes: Array.isArray(rawMapData.drawingStrokes) ? rawMapData.drawingStrokes : []
    };

    const rawEntities = rawMapData.data || {};

    Object.entries(rawEntities).forEach(([uuid, entity]: [string, Entity]) => {
      // 1. Core Transform Sanitization
      const cleanTransform = this.sanitizeTransform(entity.transform);

      // 2. Project Coordinate Translation Matrix (3D to 2D Layer Assignment)
      // Z-axis position dictates sorting order
      const depthKey = cleanTransform.position[2];

      const runtimeEntity: any = {
        uuid: uuid,
        name: entity.name || 'Entity',
        type: entity.type || 'BOX',
        behavior: entity.behavior || 'STATIC',
        color: entity.color || '#3B82F6',
        assetFilename: entity.assetFilename || null,
        renderMeta: {
          depthKey: depthKey,
          screenOffset: [cleanTransform.position[0], cleanTransform.position[1]],
          scale2d: [cleanTransform.scale[0], cleanTransform.scale[1]],
          rotation2d: cleanTransform.rotation[2] // Z-rotation drives 2D rotation plane
        },
        animationConfig: entity.animationConfig ? {
          frameCount: Math.max(1, parseInt(entity.animationConfig.frameCount as any, 10) || 1),
          frameDuration: Math.max(0.001, parseFloat(entity.animationConfig.frameDuration as any) || 0.083),
          loop: entity.animationConfig.loop !== false,
          autoPlay: entity.animationConfig.autoPlay !== false
        } : null
      };

      // 3. Structural Layer Sorting
      if (depthKey < -10) {
        manifest.layers.background.push(runtimeEntity);
      } else if (depthKey >= -10 && depthKey <= 10) {
        manifest.layers.gameplay.push(runtimeEntity);
      } else {
        manifest.layers.foreground.push(runtimeEntity);
      }

      // 4. Collision Geometry Extrusion & Export
      if (entity.type !== 'MESH' || entity.behavior === 'PLAYER' || entity.isSensor) {
        manifest.colliders.push({
          entityUuid: uuid,
          shape: this.validateShape(entity.type),
          isSensor: Boolean(entity.isSensor),
          behavior: entity.behavior || 'STATIC',
          geometry: {
            position: cleanTransform.position,
            extents: cleanTransform.scale
          }
        });
      }
    });

    // Sort every rendering layer array by depth key value to secure correct draw order painting
    const sortByDepth = (a: any, b: any) => a.renderMeta.depthKey - b.renderMeta.depthKey;
    manifest.layers.background.sort(sortByDepth);
    manifest.layers.gameplay.sort(sortByDepth);
    manifest.layers.foreground.sort(sortByDepth);

    console.log('[Bake Pipeline] Export manifest successfully generated.');
    return manifest;
  },

  sanitizeEnvironment(env: any) {
    return {
      clearColor: env?.clearColor || '#0B0B0C',
      cameraMode: env?.cameraMode || 'ISOMETRIC', // PERSPECTIVE, ISOMETRIC, DIMETRIC
      cameraZoom: typeof env?.cameraZoom === 'number' ? env.cameraZoom : 50,
      fov: typeof env?.fov === 'number' ? env.fov : 45
    };
  },

  validateShape(type: string): string {
    const validShapes = ['BOX', 'SPHERE', 'CAPSULE'];
    return validShapes.includes(type) ? type : 'BOX';
  },

  sanitizeTransform(transform: any) {
    const defaultVec: [number, number, number] = [0, 0, 0];
    const defaultScale: [number, number, number] = [1, 1, 1];

    if (!transform) {
      return {
        position: defaultVec,
        rotation: defaultVec,
        scale: defaultScale
      };
    }

    const ensureVec3 = (arr: any, fallback: [number, number, number]): [number, number, number] => {
      return (Array.isArray(arr) && arr.length === 3) ? (arr as [number, number, number]) : fallback;
    };

    return {
      position: ensureVec3(transform.position, defaultVec),
      rotation: ensureVec3(transform.rotation, defaultVec),
      scale: ensureVec3(transform.scale, defaultScale)
    };
  }
};

export default BakeProcessor;
