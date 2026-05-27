/**
 * @file src/types.ts
 * @description Master TypeScript contracts and schema interfaces for Veil Engine, including
 * the Entity component schema and the SpatialEditorState Zustand schema.
 */

export type GeometryType = 'BOX' | 'SPHERE' | 'CAPSULE' | 'MESH';

export type BehaviorType = 'STATIC' | 'PLAYER' | 'ROTATOR' | 'COLLECTIBLE' | 'HAZARD' | 'TRIGGER';

// ============================================================================
// BEHAVIOR TREE SYSTEM TYPES
// ============================================================================

export type TreeNodeType = 
  | 'CONDITIONAL'   // If condition is true, proceed to child
  | 'SEQUENCE'      // Execute children in order, stop on first failure
  | 'PARALLEL'      // Execute all children simultaneously
  | 'TRIGGER'       // Fire an event/action
  | 'TRANSFORM'     // Animate entity transform (position/rotation/scale)
  | 'ANIMATE'       // Play sprite animation
  | 'EMIT'          // Emit particles
  | 'WAIT';         // Wait for duration

export type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

export interface ConditionalNodeConfig {
  property: 'behavior' | 'x' | 'y' | 'z' | 'custom'; // Entity property to check
  operator: ComparisonOperator;
  value: any;
  childId?: string; // If true, execute this child node
  elseChildId?: string; // If false, execute this child node
}

export interface SequenceNodeConfig {
  childIds: string[]; // Execute in order
}

export interface ParallelNodeConfig {
  childIds: string[]; // Execute simultaneously
}

export interface TriggerNodeConfig {
  eventType: 'ON_COLLISION' | 'ON_ANIMATION_END' | 'CUSTOM_EVENT';
  payload?: any;
}

export interface TransformNodeConfig {
  targetProperty: 'position' | 'rotation' | 'scale';
  targetValue: [number, number, number] | number;
  duration: number; // seconds
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface AnimateNodeConfig {
  frameStart: number;
  frameEnd: number;
  duration: number;
  loop: boolean;
}

export interface EmitNodeConfig {
  particleType: 'SPARK' | 'SMOKE' | 'STAR' | 'DUST';
  count: number;
  direction?: [number, number];
}

export interface WaitNodeConfig {
  duration: number; // seconds
}

export interface BehaviorNode {
  id: string; // Unique within tree
  type: TreeNodeType;
  name: string; // Human-readable label
  config: 
    | ConditionalNodeConfig
    | SequenceNodeConfig
    | ParallelNodeConfig
    | TriggerNodeConfig
    | TransformNodeConfig
    | AnimateNodeConfig
    | EmitNodeConfig
    | WaitNodeConfig;
}

export interface BehaviorTree {
  id: string; // UUID
  name: string; // e.g., "PlayerMovement", "EnemyPatrol"
  rootNodeId: string; // Points to BehaviorNode.id
  nodes: Record<string, BehaviorNode>; // Map of nodeId → BehaviorNode
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

export interface BehaviorTreeExecutionState {
  treeId: string;
  entityUuid: string;
  currentNodeId: string;
  startTime: number;
  activeTimers: Record<string, number>; // Track waiting/animation timers
  completionCallbacks?: ((success: boolean) => void)[];
}

// ============================================================================
// ASSET PIPELINE TYPES
// ============================================================================

export interface SpriteFrameData {
  frameIndex: number;
  x: number; // Pixel offset in sprite sheet
  y: number;
  width: number;
  height: number;
  duration?: number; // Frame duration override
}

export interface AnimationClipDefinition {
  name: string;
  frames: SpriteFrameData[];
  loop: boolean;
  speed: number; // Frames per second
}

export interface SpriteSheetMetadata {
  imageUrl: string;
  gridWidth: number; // Number of columns
  gridHeight: number; // Number of rows
  frameWidth: number;
  frameHeight: number;
  animations?: Record<string, AnimationClipDefinition>;
}

export interface AssetDefinition {
  id: string; // UUID
  name: string;
  type: 'SPRITE_SHEET' | 'ANIMATION_CLIP' | 'TEXTURE' | 'MODEL';
  path: string; // File path relative to project
  metadata: SpriteSheetMetadata | any;
  tags: string[];
  importedAt: number;
  size: number; // File size in bytes
  checksum: string; // For change detection
}

export interface Transformation3D {
  position: [number, number, number]; // [X,Y,Z]
  rotation: [number, number, number]; // [Pitch, Yaw, Roll] in radians
  scale: [number, number, number];    // [Width, Height, Depth]
}

export interface SpriteAnimationConfig {
  frameCount: number;       // Number of discrete frames
  frameDuration: number;    // Time duration per frame in seconds (e.g. 0.083 for ~12 FPS)
  loop: boolean;            // Loop back once finished
  autoPlay: boolean;        // Play immediately on load
}

export interface PhysicsConfig {
  speed: number;
  rotationSpeed: number;
  isSolid: boolean; // Explicit solid flag for collision
}

export interface Entity {
  uuid: string;
  name: string;
  type: GeometryType;
  behavior: BehaviorType;
  isSensor: boolean;
  color: string;
  transform: Transformation3D;
  assetFilename: string | null;
  animationConfig?: SpriteAnimationConfig | null;
  physics?: PhysicsConfig; // NEW: Data-driven physics
}

export interface TimelineKeyframe {
  time: number;             // Time in seconds
  value: any;               // Target property value (e.g. frame index, position offsets, etc.)
  action?: string;          // Executed discrete event (for Trigger/Dialogue tracks)
  payload?: any;            // Payload parameters
}

export interface TimelineTrack {
  trackType: 'SPRITE_FRAME' | 'GSAP_TWEEN' | 'TRIGGER' | 'DIALOGUE';
  targetUuid: string;
  channel?: 'position2d' | 'opacity' | 'scale2d';
  timelineData?: any;       // Specific GSAP parameters or keyframes representation
  keyframes?: TimelineKeyframe[];
}

export interface TimelineSequence {
  id: string;               // Unique sequence identifier
  name: string;             // E.g. "idle", "spin_h_anim", etc.
  duration: number;         // Total duration in seconds
  tracks: TimelineTrack[];
}

export interface VeilProjectManifest {
  version: string;
  metadata: {
    hash: string;
  };
  compileTime: number;
  environment: {
    clearColor: string;
    cameraMode: 'ISOMETRIC' | 'PERSPECTIVE' | 'DIMETRIC';
    cameraZoom: number;
    fov: number;
  };
  layers: {
    background: any[];
    gameplay: any[];
    foreground: any[];
    ui: any[];
  };
  colliders: any[];
  timelineEvents: TimelineSequence[];
  drawingStrokes?: DrawingStroke[];
}

export interface DrawingStroke {
  uuid: string;
  layer: 'background' | 'gameplay' | 'foreground';
  tool: 'pencil' | 'eraser';
  color: string;
  width: number;
  points: [number, number][]; // [X, Y] coordinates
  brushStyle?: 'solid' | 'calligraphy' | 'charcoal' | 'neon' | 'star' | 'dash';
}

export interface SpatialEditorState {
  // Collection Matrix
  entities: Record<string, Entity>;
  sortingLayers: {
    background: string[]; // UUID list
    gameplay: string[];   // UUID list
    foreground: string[]; // UUID list
  };
  behaviorTrees: Record<string, BehaviorTree>;
  entityBehaviorTreeBindings: Record<string, string>; // entityUuid → treeId
  assets: Record<string, AssetDefinition>;

  // Selection & UI Focus
  selectedUuid: string | null;
  selectedTreeId: string | null;
  selectedAssetId: string | null;
  activeToolMode: 'TRANSLATE' | 'ROTATE' | 'SCALE' | 'SELECT' | 'DRAW';
  activeViewportCamera: 'ISOMETRIC' | 'PERSPECTIVE' | 'DIMETRIC' | 'FLAT_2D';
  cameraZoom: number;
  isCompiling: boolean;
  projectPath: string | null;

  // Layer Drafting & Spot Locking Systems
  showGuideFrame: boolean;
  cameraFocusZLocked: boolean;
  cameraFocusSpot: [number, number];
  cameraSpots: { name: string; spot: [number, number] }[];
  canvasAspectRatio: '16:9' | '4:3';

  // 2.5D Layer Visibility, Locking, and Active Drawing config
  layerVisibility: {
    background: boolean;
    gameplay: boolean;
    foreground: boolean;
  };
  layerLock: {
    background: boolean;
    gameplay: boolean;
    foreground: boolean;
  };
  activeDrawingLayer: 'background' | 'gameplay' | 'foreground';
  selectedBrush: {
    type: GeometryType;
    behavior: BehaviorType;
    color: string;
    assetFilename: string | null;
  };

  // Freehand Drawing States
  drawingStrokes: DrawingStroke[];
  drawingTool: 'pencil' | 'eraser' | 'mesh';
  drawingColor: string;
  drawingWidth: number;
  drawingBrushStyle: 'solid' | 'calligraphy' | 'charcoal' | 'neon' | 'star' | 'dash';

  // Timelines & Animations in project
  timelineEvents: TimelineSequence[];

  // Environment Options
  environment: {
    clearColor: string;
    cameraMode: 'ISOMETRIC' | 'PERSPECTIVE' | 'DIMETRIC' | 'FLAT_2D';
    cameraZoom: number;
    fov: number;
  };

  // Actions Matrix
  addEntity: (entity: Entity) => void;
  removeEntity: (uuid: string) => void;
  updateEntityTransform: (
    uuid: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => void;
  updateEntityProperty: <K extends keyof Entity>(
    uuid: string,
    key: K,
    value: Entity[K]
  ) => void;
  setSelectedUuid: (uuid: string | null) => void;
  setToolMode: (mode: 'TRANSLATE' | 'ROTATE' | 'SCALE' | 'SELECT' | 'DRAW') => void;
  setViewportCamera: (cameraMode: 'ISOMETRIC' | 'PERSPECTIVE' | 'DIMETRIC' | 'FLAT_2D') => void;
  loadProjectManifest: (manifest: any) => void;
  setCompiling: (compiling: boolean) => void;
  setProjectPath: (path: string | null) => void;
  
  // Custom Visual Guide setters
  setShowGuideFrame: (show: boolean) => void;
  setCameraFocusZLocked: (locked: boolean) => void;
  setCameraFocusSpot: (spot: [number, number]) => void;
  addCameraSpot: (name: string, spot: [number, number]) => void;
  removeCameraSpot: (name: string) => void;
  setCanvasAspectRatio: (ratio: '16:9' | '4:3') => void;
  
  // Layer controls action contracts
  setLayerVisibility: (layer: 'background' | 'gameplay' | 'foreground', visible: boolean) => void;
  setLayerLock: (layer: 'background' | 'gameplay' | 'foreground', locked: boolean) => void;
  setActiveDrawingLayer: (layer: 'background' | 'gameplay' | 'foreground') => void;
  setSelectedBrush: (brush: {
    type: GeometryType;
    behavior: BehaviorType;
    color: string;
    assetFilename: string | null;
  }) => void;
  
  // Freehand drawing actions
  addDrawingStroke: (stroke: DrawingStroke) => void;
  clearDrawingStrokes: (layer?: 'background' | 'gameplay' | 'foreground') => void;
  setDrawingTool: (tool: 'pencil' | 'eraser' | 'mesh') => void;
  setDrawingColor: (color: string) => void;
  setDrawingWidth: (width: number) => void;
  setDrawingBrushStyle: (style: 'solid' | 'calligraphy' | 'charcoal' | 'neon' | 'star' | 'dash') => void;
  setDrawingStrokes: (strokes: DrawingStroke[]) => void;
  
  // Custom project and timeline action matrix (app-level extensions)
  updateEnvironment: (env: Partial<SpatialEditorState['environment']>) => void;
  setTimelineEvents: (sequences: TimelineSequence[]) => void;
  triggerCompile: () => Promise<VeilProjectManifest>;
  reorderEntityLayer: (draggedUuid: string, targetLayer: 'background' | 'gameplay' | 'foreground', targetIndex: number) => void;

  // Behavior Tree Management
  addBehaviorTree: (tree: BehaviorTree) => void;
  updateBehaviorTree: (treeId: string, tree: Partial<BehaviorTree>) => void;
  deleteBehaviorTree: (treeId: string) => void;
  setSelectedTreeId: (treeId: string | null) => void;
  linkTreeToEntity: (entityUuid: string, treeId: string) => void;
  unlinkTreeFromEntity: (entityUuid: string) => void;

  // Asset Management
  addAsset: (asset: AssetDefinition) => void;
  updateAsset: (assetId: string, asset: Partial<AssetDefinition>) => void;
  deleteAsset: (assetId: string) => void;
  setSelectedAssetId: (assetId: string | null) => void;
}
