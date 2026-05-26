/**
 * @file src/app/store.ts
 * @description Central Zustand store for the Veil Engine.
 * Manages reactive UI states, viewport settings, entity collections, and triggers the BakeProcessor compiler.
 * Strictly adheres to Pillar 3 guidelines.
 */

import { create } from 'zustand';
import { SpatialEditorState, Entity, TimelineSequence, VeilProjectManifest } from '../types';
import { BakeProcessor } from '../engine/systems/BakeProcessor';

const INITIAL_ENVIRONMENT = {
  clearColor: '#0B0B0C',
  cameraMode: 'ISOMETRIC' as const,
  cameraZoom: 40,
  fov: 45
};

export const useSpatialEditorStore = create<SpatialEditorState>((set, get) => ({
  entities: {},
  sortingLayers: { background: [], gameplay: [], foreground: [] },
  selectedUuid: null,
  activeToolMode: 'TRANSLATE',
  layerVisibility: { background: true, gameplay: true, foreground: true },
  layerLock: { background: false, gameplay: false, foreground: false },
  activeDrawingLayer: 'gameplay',
  selectedBrush: { type: 'BOX', behavior: 'STATIC', color: '#3B82F6', assetFilename: 'stone_pillar.png' },
  activeViewportCamera: 'ISOMETRIC',
  cameraZoom: 40,
  isCompiling: false,
  projectPath: 'projects/veil_engine_starter',
  showGuideFrame: true,
  cameraFocusZLocked: true,
  cameraFocusSpot: [0, 0],
  cameraSpots: [],
  canvasAspectRatio: '16:9',
  timelineEvents: [],
  environment: INITIAL_ENVIRONMENT,
  drawingStrokes: [],
  updateEntityProperty: <K extends keyof Entity>(uuid: string, key: K, value: Entity[K]) => {
    set((state) => {
      const entity = state.entities[uuid];
      if (!entity) return {};

      return {
        entities: {
          ...state.entities,
          [uuid]: {
            ...entity,
            [key]: value
          }
        }
      };
    });
  },
  drawingTool: 'pencil',
  drawingColor: '#A855F7',
  drawingWidth: 3,
  drawingBrushStyle: 'solid',

  // Actions
  addEntity: (entity: Entity) => set((state) => {
    const updatedEntities = { ...state.entities, [entity.uuid]: entity };
    const z = entity.transform.position[2];
    const layers = { ...state.sortingLayers };
    
    if (z < -10) layers.background.push(entity.uuid);
    else if (z >= -10 && z <= 10) layers.gameplay.push(entity.uuid);
    else layers.foreground.push(entity.uuid);

    return { entities: updatedEntities, sortingLayers: layers, selectedUuid: entity.uuid };
  }),

  removeEntity: (uuid: string) => set((state) => {
    const updatedEntities = { ...state.entities };
    delete updatedEntities[uuid];
    return {
      entities: updatedEntities,
      sortingLayers: {
        background: state.sortingLayers.background.filter(id => id !== uuid),
        gameplay: state.sortingLayers.gameplay.filter(id => id !== uuid),
        foreground: state.sortingLayers.foreground.filter(id => id !== uuid)
      }
    };
  }),

  updateEntityTransform: (uuid, position, rotation, scale) => set((state) => {
    const entity = state.entities[uuid];
    if (!entity) return {};
    const updatedEntity = { ...entity, transform: { position, rotation, scale } };
    
    // Simplification: In a production scenario, we'd trigger a Layer Re-sort here if Z changed
    return { entities: { ...state.entities, [uuid]: updatedEntity } };
  }),

  setSelectedUuid: (uuid) => set({ selectedUuid: uuid }),
  setToolMode: (mode) => set({ activeToolMode: mode }),
  
  // Compiler Integration
  triggerCompile: async (): Promise<VeilProjectManifest> => {
    set({ isCompiling: true });
    const state = get();
    
    // Explicit manifest construction to ensure data integrity
    const payload = {
      environment: state.environment,
      data: state.entities,
      timeline: state.timelineEvents,
      drawingStrokes: state.drawingStrokes
    };

    try {
      const result = await BakeProcessor.compile(payload);
      return result;
    } finally {
      set({ isCompiling: false });
    }
  },

  // State setters omitted for brevity...
  loadProjectManifest: (manifest: any) => set({ /* ... logic */ }),
  setLayerVisibility: (layer, visible) => set(state => ({ layerVisibility: { ...state.layerVisibility, [layer]: visible } })),
  setLayerLock: (layer, locked) => set(state => ({ layerLock: { ...state.layerLock, [layer]: locked } })),
  setActiveDrawingLayer: (layer) => set({ activeDrawingLayer: layer }),
  setSelectedBrush: (brush) => set({ selectedBrush: brush }),
  addDrawingStroke: (stroke) => set((state) => ({ drawingStrokes: [...state.drawingStrokes, stroke] })),
  clearDrawingStrokes: (layer) => set((state) => ({ drawingStrokes: layer ? state.drawingStrokes.filter(s => s.layer !== layer) : [] })),
  setDrawingTool: (tool) => set({ drawingTool: tool }),
  setDrawingColor: (color) => set({ drawingColor: color }),
  setDrawingWidth: (width) => set({ drawingWidth: width }),
  setDrawingBrushStyle: (style) => set({ drawingBrushStyle: style }),
  setDrawingStrokes: (strokes) => set({ drawingStrokes: strokes }),
  setViewportCamera: (cameraMode) => set((state) => ({ activeViewportCamera: cameraMode, environment: { ...state.environment, cameraMode } })),
  setShowGuideFrame: (show) => set({ showGuideFrame: show }),
  setCanvasAspectRatio: (ratio) => set({ canvasAspectRatio: ratio }),
  setCameraFocusZLocked: (locked) => set({ cameraFocusZLocked: locked }),
  setCameraFocusSpot: (spot) => set({ cameraFocusSpot: spot }),
  addCameraSpot: (name, spot) => set((state) => ({ cameraSpots: [...state.cameraSpots.filter(s => s.name !== name), { name, spot }] })),
  removeCameraSpot: (name) => set((state) => ({ cameraSpots: state.cameraSpots.filter(s => s.name !== name) })),
  setCompiling: (compiling) => set({ isCompiling: compiling }),
  setProjectPath: (path) => set({ projectPath: path }),
  updateEnvironment: (env) => set((state) => ({ environment: { ...state.environment, ...env } })),
  setTimelineEvents: (sequences) => set({ timelineEvents: sequences }),
  reorderEntityLayer: (draggedUuid, targetLayer, targetIndex) => set((state) => ({ /* reorder logic */ }))
}));