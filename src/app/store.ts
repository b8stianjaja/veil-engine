/**
 * @file src/app/store.ts
 * @description Central Zustand store for the Veil Engine.
 * Manages reactive UI states, viewport settings, entity collections, and triggers the BakeProcessor compiler.
 * Strictly adheres to Pillar 3 guidelines.
 */

import { create } from 'zustand';
import { SpatialEditorState, Entity, TimelineSequence, VeilProjectManifest } from '../types';
import { BakeProcessor } from '../engine/systems/BakeProcessor';

const INITIAL_ENVIRONMENT: {
  clearColor: string;
  cameraMode: 'ISOMETRIC' | 'PERSPECTIVE' | 'DIMETRIC' | 'FLAT_2D';
  cameraZoom: number;
  fov: number;
} = {
  clearColor: '#0B0B0C',
  cameraMode: 'ISOMETRIC',
  cameraZoom: 40,
  fov: 45
};

const DEFAULT_TIMELINES: TimelineSequence[] = [
  {
    id: 'seq-bounce',
    name: 'Object Spin & Bounce',
    duration: 3.0,
    tracks: [
      {
        trackType: 'SPRITE_FRAME',
        targetUuid: 'demo-player',
        keyframes: [
          { time: 0.0, value: 0 },
          { time: 0.5, value: 1 },
          { time: 1.0, value: 2 },
          { time: 1.5, value: 3 },
          { time: 2.0, value: 4 },
          { time: 2.5, value: 5 },
          { time: 3.0, value: 0 }
        ]
      },
      {
        trackType: 'GSAP_TWEEN',
        targetUuid: 'demo-rotator',
        channel: 'scale2d',
        timelineData: {
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 1.5,
          yoyo: true,
          repeat: -1
        }
      },
      {
        trackType: 'TRIGGER',
        targetUuid: 'demo-trigger',
        keyframes: [
          { time: 1.0, value: null, action: 'ALERT', payload: { message: 'First Sec Metronome tick!' } },
          { time: 2.5, value: null, action: 'CONSOLE', payload: { text: 'Pillar 1 metrics secure.' } }
        ]
      }
    ]
  }
];

export const useSpatialEditorStore = create<SpatialEditorState>((set, get) => ({
  entities: {
    'demo-player': {
      uuid: 'demo-player',
      name: 'Hero Player (WASD)',
      type: 'BOX',
      behavior: 'PLAYER',
      isSensor: false,
      color: '#10B981',
      transform: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      assetFilename: 'hero_sprite_sheet.png',
      animationConfig: {
        frameCount: 6,
        frameDuration: 0.1,
        loop: true,
        autoPlay: true
      }
    },
    'demo-static-1': {
      uuid: 'demo-static-1',
      name: 'Obstacle Pillar',
      type: 'BOX',
      behavior: 'STATIC',
      isSensor: false,
      color: '#EF4444',
      transform: {
        position: [-3, 0, 0],
        rotation: [0, 0, 0],
        scale: [1.2, 2.4, 1.2]
      },
      assetFilename: 'stone_pillar.png'
    },
    'demo-rotator': {
      uuid: 'demo-rotator',
      name: 'Dynamic Rotator',
      type: 'MESH',
      behavior: 'ROTATOR',
      isSensor: false,
      color: '#3B82F6',
      transform: {
        position: [3, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      assetFilename: 'nexus_core.png'
    },
    'demo-collectible': {
      uuid: 'demo-collectible',
      name: 'Gold Star',
      type: 'SPHERE',
      behavior: 'COLLECTIBLE',
      isSensor: true,
      color: '#FBF236',
      transform: {
        position: [0, 3, -12], // Background segment (depth key < -10)
        rotation: [0, 0, 0],
        scale: [0.8, 0.8, 0.8]
      },
      assetFilename: 'star.png'
    },
    'demo-hazard': {
      uuid: 'demo-hazard',
      name: 'Spike Trap',
      type: 'CAPSULE',
      behavior: 'HAZARD',
      isSensor: true,
      color: '#9E0B0B',
      transform: {
        position: [0, -3, 12], // Foreground segment (depth key > 10)
        rotation: [0, 0, 0],
        scale: [1, 1.2, 1]
      },
      assetFilename: 'spikes.png'
    }
  },
  sortingLayers: {
    background: ['demo-collectible'],
    gameplay: ['demo-player', 'demo-static-1', 'demo-rotator'],
    foreground: ['demo-hazard']
  },

  selectedUuid: null,
  activeToolMode: 'TRANSLATE',
  layerVisibility: {
    background: true,
    gameplay: true,
    foreground: true
  },
  layerLock: {
    background: false,
    gameplay: false,
    foreground: false
  },
  activeDrawingLayer: 'gameplay',
  selectedBrush: {
    type: 'BOX',
    behavior: 'STATIC',
    color: '#3B82F6',
    assetFilename: 'stone_pillar.png'
  },
  activeViewportCamera: 'ISOMETRIC',
  cameraZoom: 40,
  isCompiling: false,
  projectPath: 'projects/veil_engine_starter',
  
  // Visual drafting states
  showGuideFrame: true,
  cameraFocusZLocked: true,
  cameraFocusSpot: [0, 0],
  cameraSpots: [
    { name: 'Center Stage', spot: [0, 0] },
    { name: 'Left Wing', spot: [-8, 0] },
    { name: 'Right Wing', spot: [8, 0] },
    { name: 'Sky Limit', spot: [0, 6] }
  ],
  canvasAspectRatio: '16:9',

  timelineEvents: DEFAULT_TIMELINES,
  environment: INITIAL_ENVIRONMENT,

  // Freehand Drawing defaults
  drawingStrokes: [],
  drawingTool: 'pencil',
  drawingColor: '#A855F7',
  drawingWidth: 3,
  drawingBrushStyle: 'solid',

  // Action Methods
  addEntity: (entity: Entity) => {
    set((state) => {
      const updatedEntities = { ...state.entities, [entity.uuid]: entity };
      
      // Determine layer sorting based on current Z-axis coordinate depth
      const z = entity.transform.position[2];
      const bg = [...state.sortingLayers.background];
      const gp = [...state.sortingLayers.gameplay];
      const fg = [...state.sortingLayers.foreground];

      if (z < -10) {
        bg.push(entity.uuid);
      } else if (z >= -10 && z <= 10) {
        gp.push(entity.uuid);
      } else {
        fg.push(entity.uuid);
      }

      return {
        entities: updatedEntities,
        sortingLayers: { background: bg, gameplay: gp, foreground: fg },
        selectedUuid: entity.uuid
      };
    });
  },

  removeEntity: (uuid: string) => {
    set((state) => {
      const updatedEntities = { ...state.entities };
      delete updatedEntities[uuid];

      const bg = state.sortingLayers.background.filter(id => id !== uuid);
      const gp = state.sortingLayers.gameplay.filter(id => id !== uuid);
      const fg = state.sortingLayers.foreground.filter(id => id !== uuid);

      return {
        entities: updatedEntities,
        sortingLayers: { background: bg, gameplay: gp, foreground: fg },
        selectedUuid: state.selectedUuid === uuid ? null : state.selectedUuid
      };
    });
  },

  updateEntityTransform: (
    uuid: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => {
    set((state) => {
      const entity = state.entities[uuid];
      if (!entity) return {};

      const previousZ = entity.transform.position[2];
      const currentZ = position[2];

      const updatedEntity = {
        ...entity,
        transform: { position, rotation, scale }
      };

      const updatedEntities = { ...state.entities, [uuid]: updatedEntity };

      // Re-calculate depth layer mapping if depth thresholds were breached
      let bg = [...state.sortingLayers.background];
      let gp = [...state.sortingLayers.gameplay];
      let fg = [...state.sortingLayers.foreground];

      const checkBg = (z: number) => z < -10;
      const checkGp = (z: number) => z >= -10 && z <= 10;
      const checkFg = (z: number) => z > 10;

      if (checkBg(previousZ) !== checkBg(currentZ) || checkGp(previousZ) !== checkGp(currentZ) || checkFg(previousZ) !== checkFg(currentZ)) {
        // Remove from all layers and re-insert
        bg = bg.filter(id => id !== uuid);
        gp = gp.filter(id => id !== uuid);
        fg = fg.filter(id => id !== uuid);

        if (currentZ < -10) {
          bg.push(uuid);
        } else if (currentZ >= -10 && currentZ <= 10) {
          gp.push(uuid);
        } else {
          fg.push(uuid);
        }
      }

      return {
        entities: updatedEntities,
        sortingLayers: { background: bg, gameplay: gp, foreground: fg }
      };
    });
  },

  updateEntityProperty: <K extends keyof Entity>(uuid: string, key: K, value: Entity[K]) => {
    set((state) => {
      const entity = state.entities[uuid];
      if (!entity) return {};

      const updatedEntities = {
        ...state.entities,
        [uuid]: {
          ...entity,
          [key]: value
        }
      };

      return { entities: updatedEntities };
    });
  },

  setSelectedUuid: (uuid: string | null) => set({ selectedUuid: uuid }),

  setToolMode: (mode: 'TRANSLATE' | 'ROTATE' | 'SCALE' | 'SELECT' | 'DRAW') => set({ activeToolMode: mode }),

  setLayerVisibility: (layer, visible) => set(state => ({
    layerVisibility: { ...state.layerVisibility, [layer]: visible }
  })),

  setLayerLock: (layer, locked) => set(state => ({
    layerLock: { ...state.layerLock, [layer]: locked }
  })),

  setActiveDrawingLayer: (layer) => set({ activeDrawingLayer: layer }),

  setSelectedBrush: (brush) => set({ selectedBrush: brush }),

  addDrawingStroke: (stroke) => set((state) => ({
    drawingStrokes: [...state.drawingStrokes, stroke]
  })),

  clearDrawingStrokes: (layer) => set((state) => ({
    drawingStrokes: layer 
      ? state.drawingStrokes.filter(s => s.layer !== layer) 
      : []
  })),

  setDrawingTool: (tool) => set({ drawingTool: tool }),

  setDrawingColor: (color) => set({ drawingColor: color }),

  setDrawingWidth: (width) => set({ drawingWidth: width }),

  setDrawingBrushStyle: (style) => set({ drawingBrushStyle: style }),

  setDrawingStrokes: (strokes) => set({ drawingStrokes: strokes }),

  setViewportCamera: (cameraMode: 'ISOMETRIC' | 'PERSPECTIVE' | 'DIMETRIC' | 'FLAT_2D') => {
    set((state) => ({
      activeViewportCamera: cameraMode,
      environment: { ...state.environment, cameraMode }
    }));
  },

  setShowGuideFrame: (show: boolean) => set({ showGuideFrame: show }),

  setCanvasAspectRatio: (ratio: '16:9' | '4:3') => set({ canvasAspectRatio: ratio }),

  setCameraFocusZLocked: (locked: boolean) => set({ cameraFocusZLocked: locked }),

  setCameraFocusSpot: (spot: [number, number]) => set({ cameraFocusSpot: spot }),

  addCameraSpot: (name: string, spot: [number, number]) => {
    set((state) => {
      // Avoid duplicate names or spots
      const filtered = state.cameraSpots.filter(s => s.name.toLowerCase() !== name.toLowerCase());
      return {
        cameraSpots: [...filtered, { name, spot }],
        cameraFocusSpot: spot
      };
    });
  },

  removeCameraSpot: (name: string) => {
    set((state) => ({
      cameraSpots: state.cameraSpots.filter(s => s.name !== name)
    }));
  },

  loadProjectManifest: (manifest: any) => {
    if (!manifest) return;
    set(() => {
      const env = manifest.environment || INITIAL_ENVIRONMENT;
      const timeline = manifest.timelineEvents || [];
      const loadedEntities: Record<string, Entity> = {};
      const bg: string[] = [];
      const gp: string[] = [];
      const fg: string[] = [];

      const reconstructEntities = (layerEntities: any[]) => {
        layerEntities.forEach(le => {
          const z = le.renderMeta.depthKey;
          const entity: Entity = {
            uuid: le.uuid,
            name: le.name || 'Entity',
            type: le.type || 'BOX',
            behavior: le.behavior || 'STATIC',
            isSensor: false,
            color: le.color || '#3B82F6',
            transform: {
              position: [...le.renderMeta.screenOffset, z] as [number, number, number],
              rotation: [0, 0, le.renderMeta.rotation2d] as [number, number, number],
              scale: [...le.renderMeta.scale2d, 1] as [number, number, number]
            },
            assetFilename: le.assetFilename,
            animationConfig: le.animationConfig
          };

          loadedEntities[le.uuid] = entity;

          if (z < -10) {
            bg.push(le.uuid);
          } else if (z >= -10 && z <= 10) {
            gp.push(le.uuid);
          } else {
            fg.push(le.uuid);
          }
        });
      };

      reconstructEntities(manifest.layers.background || []);
      reconstructEntities(manifest.layers.gameplay || []);
      reconstructEntities(manifest.layers.foreground || []);

      // Reconnect sensors details
      if (manifest.colliders) {
        manifest.colliders.forEach((coll: any) => {
          if (loadedEntities[coll.entityUuid]) {
            loadedEntities[coll.entityUuid].isSensor = coll.isSensor;
          }
        });
      }

      return {
        entities: loadedEntities,
        sortingLayers: { background: bg, gameplay: gp, foreground: fg },
        selectedUuid: null,
        timelineEvents: timeline,
        drawingStrokes: manifest.drawingStrokes || [],
        environment: {
          clearColor: env.clearColor || '#0B0B0C',
          cameraMode: env.cameraMode || 'ISOMETRIC',
          cameraZoom: env.cameraZoom || 40,
          fov: env.fov || 45
        }
      };
    });
  },

  setCompiling: (compiling: boolean) => set({ isCompiling: compiling }),

  setProjectPath: (path: string | null) => set({ projectPath: path }),

  updateEnvironment: (env: Partial<SpatialEditorState['environment']>) => {
    set((state) => ({
      environment: { ...state.environment, ...env }
    }));
  },

  setTimelineEvents: (sequences: TimelineSequence[]) => {
    set({ timelineEvents: sequences });
  },

  triggerCompile: async (): Promise<VeilProjectManifest> => {
    set({ isCompiling: true });
    
    // Assemble payload matching BakeProcessor expectations
    const state = get();
    const payload = {
      environment: state.environment,
      data: state.entities,
      timeline: state.timelineEvents,
      drawingStrokes: state.drawingStrokes
    };

    // Synthesize compile
    const result = await BakeProcessor.compile(payload);
    
    // Simulate compile latency
    await new Promise(resolve => setTimeout(resolve, 600));

    set({ isCompiling: false });
    return result;
  },

  reorderEntityLayer: (draggedUuid: string, targetLayer: 'background' | 'gameplay' | 'foreground', targetIndex: number) => {
    set((state) => {
      // Find the entity
      const entity = state.entities[draggedUuid];
      if (!entity) return {};

      // Remove draggedUuid from all lists
      let bg = state.sortingLayers.background.filter(id => id !== draggedUuid);
      let gp = state.sortingLayers.gameplay.filter(id => id !== draggedUuid);
      let fg = state.sortingLayers.foreground.filter(id => id !== draggedUuid);

      // Insert at targetIndex in targetLayer list
      let targetList: string[] = [];
      if (targetLayer === 'background') targetList = bg;
      else if (targetLayer === 'gameplay') targetList = gp;
      else if (targetLayer === 'foreground') targetList = fg;

      // Bound targetIndex
      const insertIndex = Math.max(0, Math.min(targetIndex, targetList.length));
      targetList.splice(insertIndex, 0, draggedUuid);

      if (targetLayer === 'background') bg = targetList;
      else if (targetLayer === 'gameplay') gp = targetList;
      else if (targetLayer === 'foreground') fg = targetList;

      // Now, update z-coordinate transformations of all entities in these layers to secure absolute sorted depths matching the lists.
      // background z ranges from -15 upwards (e.g. -15 + i * 0.1)
      // gameplay z ranges from -5 upwards (e.g. -5 + i * 0.1)
      // foreground z ranges from 12 upwards (e.g. 12 + i * 0.1)
      const updatedEntities = { ...state.entities };

      const updateZDepths = (list: string[], baseZ: number) => {
        list.forEach((uuid, index) => {
          const ent = updatedEntities[uuid];
          if (ent) {
            const currentPos = ent.transform.position;
            const targetZ = parseFloat((baseZ + index * 0.1).toFixed(2));
            updatedEntities[uuid] = {
              ...ent,
              transform: {
                ...ent.transform,
                position: [currentPos[0], currentPos[1], targetZ]
              }
            };
          }
        });
      };

      updateZDepths(bg, -15);
      updateZDepths(gp, -5);
      updateZDepths(fg, 12);

      return {
        entities: updatedEntities,
        sortingLayers: { background: bg, gameplay: gp, foreground: fg }
      };
    });
  }
}));
