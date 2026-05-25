/**
 * @file src/editor/SpatialCreativeCanvas.tsx
 * @description 3D spatial layout-builder viewport using React Three Fiber.
 * Standardizes 3D spatial entity positioning, depth layer dividers, interactive transformation gizmos,
 * and custom Bezier camera trajectory splines.
 * Strictly adheres to Pillar 2 rules.
 */

import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Entity, GeometryType, DrawingStroke } from '../types';

interface SpatialCreativeCanvasProps {
  entities: Record<string, Entity>;
  selectedUuid: string | null;
  activeToolMode: 'TRANSLATE' | 'ROTATE' | 'SCALE' | 'SELECT' | 'DRAW';
  cameraMode: 'ISOMETRIC' | 'PERSPECTIVE' | 'DIMETRIC' | 'FLAT_2D';
  cameraZoom: number;
  onSelectEntity: (uuid: string | null) => void;
  onUpdateTransform: (
    uuid: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => void;
  cameraTrajectory: [number, number, number][]; // Bezier control points
  workspace?: 'ARTIST' | 'DEVELOPER';
  theme?: 'LIGHT' | 'DARK';
}

// Internal component to manage Camera adjustments without fight loops
function MapCameraController({ mode }: { mode: 'ISOMETRIC' | 'PERSPECTIVE' | 'DIMETRIC' | 'FLAT_2D' }) {
  const { camera, controls } = useThree();
  const { activeDrawingLayer, cameraFocusZLocked, cameraFocusSpot } = useSpatialEditorStore();

  const prevModeRef = useRef<string | null>(null);
  const prevFocusSpotRef = useRef<[number, number] | null>(null);

  const activeZ = activeDrawingLayer === 'background' ? -15 : activeDrawingLayer === 'foreground' ? 12 : 0;

  useEffect(() => {
    // Preserve core upright coordinate defaults for drawing layout
    camera.up.set(0, 1, 0);

    const orbit = controls as any;
    const targetX = cameraFocusSpot ? cameraFocusSpot[0] : 0;
    const targetY = cameraFocusSpot ? cameraFocusSpot[1] : 0;
    const targetZ = cameraFocusZLocked ? activeZ : 0;

    const modeChanged = prevModeRef.current !== mode;

    if (modeChanged) {
      // 1. If mode actually changed, snap/reset to the preset coordinates and direction
      if (mode === 'FLAT_2D') {
        camera.position.set(targetX, targetY, targetZ + 45);
        if (orbit && orbit.target) {
          orbit.target.set(targetX, targetY, targetZ);
        } else {
          camera.lookAt(targetX, targetY, targetZ);
        }
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = 35;
        }
      } else if (mode === 'ISOMETRIC') {
        camera.position.set(targetX + 15, targetY + 15, targetZ + 15);
        if (orbit && orbit.target) {
          orbit.target.set(targetX, targetY, targetZ);
        } else {
          camera.lookAt(targetX, targetY, targetZ);
        }
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = 40;
        }
      } else if (mode === 'DIMETRIC') {
        camera.position.set(targetX + 18, targetY + 9, targetZ + 18);
        if (orbit && orbit.target) {
          orbit.target.set(targetX, targetY, targetZ);
        } else {
          camera.lookAt(targetX, targetY, targetZ);
        }
        if (camera instanceof THREE.OrthographicCamera) {
          camera.zoom = 35;
        }
      } else {
        // PERSPECTIVE
        camera.position.set(targetX, targetY + 10, targetZ + 25);
        if (orbit && orbit.target) {
          orbit.target.set(targetX, targetY, targetZ);
        } else {
          camera.lookAt(targetX, targetY, targetZ);
        }
      }

      if (orbit && typeof orbit.update === 'function') {
        orbit.update();
      }
      camera.updateProjectionMatrix();

      prevModeRef.current = mode;
      prevFocusSpotRef.current = cameraFocusSpot;
      return;
    }

    // 2. If the focus spot changed, check if it was a programmatic transition (e.g. clicking a preset from sidebar)
    if (cameraFocusSpot && orbit && orbit.target) {
      const curTargetX = orbit.target.x;
      const curTargetY = orbit.target.y;

      const dx = targetX - curTargetX;
      const dy = targetY - curTargetY;

      // If the difference is significant, pan the camera target to the new spot while preserving relative angle & zoom
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        camera.position.x += dx;
        camera.position.y += dy;
        camera.position.z = cameraFocusZLocked ? (targetZ + (camera.position.z - orbit.target.z)) : camera.position.z;

        orbit.target.set(targetX, targetY, cameraFocusZLocked ? targetZ : orbit.target.z);
        orbit.update();
        camera.updateProjectionMatrix();
      }
    }

    prevFocusSpotRef.current = cameraFocusSpot;
  }, [mode, camera, controls, activeZ, cameraFocusZLocked, cameraFocusSpot]);

  return null;
}

// Spline Trajectory helper
function TrajectorySpline({ points }: { points: [number, number, number][] }) {
  if (points.length < 2) return null;

  // Render a bezier spline using cubic interpolation
  const threePoints = points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(threePoints);
  const splinePoints = curve.getPoints(50);

  return (
    <>
      <Line
        points={splinePoints}
        color="#3B82F6"
        lineWidth={2}
        dashed
        dashScale={2}
        dashSize={0.5}
        gapSize={0.25}
      />
      {/* Visual control anchors */}
      {threePoints.map((pt, idx) => (
        <mesh key={idx} position={pt}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color={idx === 0 ? "#10B981" : "#EF4444"} />
        </mesh>
      ))}
    </>
  );
}

// Depth Layer Visual Planes to highlight compilation mapping
function DepthLayerDividers() {
  return (
    <group>
      {/* Background boundary: Z = -10 */}
      <mesh position={[0, -5, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 1]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Foreground boundary: Z = 10 */}
      <mesh position={[0, -5, 10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 1]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Model mesh depending on geometric shape type
function EntityMesh({ entity, isSelected }: { entity: Entity; isSelected: boolean }) {
  const meshColor = isSelected ? '#7C3AED' : entity.color || '#7C3AED';

  let geom: React.ReactNode;
  switch (entity.type) {
    case 'SPHERE':
      geom = <sphereGeometry args={[0.5, 32, 32]} />;
      break;
    case 'CAPSULE':
      geom = <capsuleGeometry args={[0.3, 0.8, 4, 16]} />;
      break;
    case 'MESH':
      geom = <torusKnotGeometry args={[0.4, 0.12, 64, 8]} />;
      break;
    case 'BOX':
    default:
      geom = <boxGeometry args={[1, 1, 1]} />;
      break;
  }

  return (
    <mesh castShadow receiveShadow>
      {geom}
      <meshStandardMaterial
        color={meshColor}
        roughness={0.2}
        metalness={0.5}
        wireframe={entity.behavior === 'TRIGGER'}
        transparent={entity.behavior === 'TRIGGER'}
        opacity={entity.behavior === 'TRIGGER' ? 0.35 : 1.0}
      />
    </mesh>
  );
}

import { useSpatialEditorStore } from '../app/store';
import { 
  Undo, Layers, Eye, EyeOff, Lock, Unlock, Pencil, Eraser, 
  Sparkles, Trash2, Maximize2, Camera, Navigation, Plus,
  Compass, Crosshair
} from 'lucide-react';

export default function SpatialCreativeCanvas({
  entities,
  selectedUuid,
  activeToolMode,
  cameraMode,
  cameraZoom,
  onSelectEntity,
  onUpdateTransform,
  cameraTrajectory,
  workspace = 'ARTIST',
  theme = 'DARK'
}: SpatialCreativeCanvasProps) {
  const transformRef = useRef<any>(null);
  const orbitRef = useRef<any>(null);
  const [activeGizmo, setActiveGizmo] = useState<boolean>(false);
  const [hoverPoint, setHoverPoint] = useState<[number, number, number] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStrokePoints, setCurrentStrokePoints] = useState<[number, number][]>([]);
  const [draftLayoutMode, setDraftLayoutMode] = useState<'SPLIT' | 'FULL_2D' | 'FULL_3D'>('FULL_3D');
  const [isolateDrawingLayer, setIsolateDrawingLayer] = useState<boolean>(false);
  const [hoverCoords, setHoverCoords] = useState<[number, number] | null>(null);

  // Precision Drafting States - Advanced CAD-like drawing board alignment tools
  const [gridSnapValue, setGridSnapValue] = useState<number>(0.5); 
  const [showSceneReferences, setShowSceneReferences] = useState<boolean>(true); 
  const [symmetricMirror, setSymmetricMirror] = useState<'NONE' | 'X' | 'Y' | 'BOTH'>('NONE'); 
  const [straightLineMode, setStraightLineMode] = useState<boolean>(false);

  // Advanced Onion skin tracing depth opacities
  const [bgDrawingOpacity, setBgDrawingOpacity] = useState<number>(0.25);
  const [gpDrawingOpacity, setGpDrawingOpacity] = useState<number>(0.95);
  const [fgDrawingOpacity, setFgDrawingOpacity] = useState<number>(0.55);

  // Read layer and drawing states from the centralized store
  const {
    layerVisibility,
    layerLock,
    activeDrawingLayer,
    selectedBrush,
    addEntity,
    drawingStrokes,
    drawingTool,
    drawingColor,
    drawingWidth,
    drawingBrushStyle,
    setDrawingBrushStyle,
    addDrawingStroke,
    setDrawingStrokes,
    clearDrawingStrokes,
    showGuideFrame,
    cameraFocusZLocked,
    cameraFocusSpot,
    cameraSpots,
    setCameraFocusSpot,
    addCameraSpot,
    removeCameraSpot,
    canvasAspectRatio
  } = useSpatialEditorStore();

  const [newSpotName, setNewSpotName] = useState('');
  const [newSpotX, setNewSpotX] = useState<number>(cameraFocusSpot?.[0] ?? 0);
  const [newSpotY, setNewSpotY] = useState<number>(cameraFocusSpot?.[1] ?? 0);

  useEffect(() => {
    if (cameraFocusSpot) {
      setNewSpotX(cameraFocusSpot[0]);
      setNewSpotY(cameraFocusSpot[1]);
    }
  }, [cameraFocusSpot]);

  const [isSpotsCollapsed, setIsSpotsCollapsed] = useState<boolean>(false);

  const activeZ = activeDrawingLayer === 'background' ? -15 : activeDrawingLayer === 'foreground' ? 12 : 0;
  const useLightboardSheet = draftLayoutMode !== 'FULL_3D';
  const isSplitMode = activeToolMode === 'DRAW' && draftLayoutMode === 'SPLIT' && (drawingTool === 'pencil' || drawingTool === 'eraser');
  const isFull2D = activeToolMode === 'DRAW' && draftLayoutMode === 'FULL_2D' && (drawingTool === 'pencil' || drawingTool === 'eraser');

  const getEntityLayer = (z: number): 'background' | 'gameplay' | 'foreground' => {
    if (z < -10) return 'background';
    if (z >= -10 && z <= 10) return 'gameplay';
    return 'foreground';
  };

  // Disable orbit controls while dragging elements or while active in drawing strokes inside the canvas
  // and lock rotation of standard orbit controls during FLAT_2D drawing mode
  useEffect(() => {
    if (orbitRef.current) {
      // In DRAW mode, if we are inside the 2D split-screen drafting sheet, orbit controls are 100% enabled because drawing is separated.
      // If we are in direct 3D drawing mode, orbit controls are enabled EXCEPT when we are actively drawing a stroke (which locks the view).
      const shouldDisableOrbit = activeToolMode === 'DRAW' && !isSplitMode && isDrawing;
      orbitRef.current.enabled = !shouldDisableOrbit;
      
      if (cameraMode === 'FLAT_2D') {
        orbitRef.current.enableRotate = false;
      } else {
        orbitRef.current.enableRotate = true;
      }
    }
  }, [activeToolMode, cameraMode, isSplitMode, isDrawing]);

  useEffect(() => {
    const gizmo = transformRef.current;
    if (!gizmo) return;

    const handleDraggingChanged = (event: any) => {
      if (orbitRef.current && activeToolMode !== 'DRAW') {
        orbitRef.current.enabled = !event.value;
      }
      setActiveGizmo(event.value);
    };

    gizmo.addEventListener('dragging-changed', handleDraggingChanged);
    return () => {
      gizmo.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [selectedUuid, activeToolMode]);

  const handleTransformEnd = () => {
    if (!selectedUuid || !transformRef.current) return;
    const object = transformRef.current.object;
    if (!object) return;

    // Flush final positions to Zustand on completion to preserve hot-loop zero layout thrashing rules
    const pos = object.position.toArray() as [number, number, number];
    const rot = [
      object.rotation.x,
      object.rotation.y,
      object.rotation.z
    ] as [number, number, number];
    const scl = object.scale.toArray() as [number, number, number];

    onUpdateTransform(selectedUuid, pos, rot, scl);
  };

  const handleDrawClick = (e: any) => {
    e.stopPropagation();
    if (activeToolMode !== 'DRAW' || !e.point) return;

    // Snapping calculations to integer grid line boundaries for high precision CAD-like alignment
    const snapX = Math.round(e.point.x);
    const snapY = Math.round(e.point.y);
    const uuid = `uuid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const name = `${selectedBrush.behavior}_${Math.random().toString(36).substring(7).toUpperCase()}`;

    addEntity({
      uuid,
      name,
      type: selectedBrush.type,
      behavior: selectedBrush.behavior,
      isSensor: ['COLLECTIBLE', 'HAZARD', 'TRIGGER'].includes(selectedBrush.behavior),
      color: selectedBrush.color,
      transform: {
        position: [snapX, snapY, activeZ],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      assetFilename: selectedBrush.assetFilename,
      animationConfig: selectedBrush.behavior === 'PLAYER' ? {
        frameCount: 4,
        frameDuration: 0.1,
        loop: true,
        autoPlay: true
      } : null
    });
  };

  const handleDrawMove = (e: any) => {
    e.stopPropagation();
    if (activeToolMode !== 'DRAW' || !e.point) {
      setHoverPoint(null);
      return;
    }
    const snapX = Math.round(e.point.x);
    const snapY = Math.round(e.point.y);
    setHoverPoint([snapX, snapY, activeZ]);
  };

  const eraseStrokesNearPoint = (x: number, y: number) => {
    // Determine the brush deletion radius based on size parameter
    const eraseRadius = drawingWidth * 0.15 + 0.5;
    const filtered = drawingStrokes.filter((stroke) => {
      if (stroke.layer !== activeDrawingLayer) return true;
      const hasClosePoint = stroke.points.some((pt) => {
        const dist = Math.sqrt((pt[0] - x) ** 2 + (pt[1] - y) ** 2);
        return dist < eraseRadius;
      });
      return !hasClosePoint;
    });

    if (filtered.length !== drawingStrokes.length) {
      setDrawingStrokes(filtered);
    }
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (activeToolMode !== 'DRAW' || !e.point) return;

    if (drawingTool === 'pencil') {
      setIsDrawing(true);
      const pt: [number, number] = [e.point.x, e.point.y];
      setCurrentStrokePoints([pt]);
    } else if (drawingTool === 'eraser') {
      setIsDrawing(true);
      eraseStrokesNearPoint(e.point.x, e.point.y);
    }
  };

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    if (activeToolMode !== 'DRAW' || !e.point) {
      setHoverPoint(null);
      return;
    }

    const { x, y } = e.point;
    setHoverPoint([x, y, activeZ]);

    if (isDrawing) {
      if (drawingTool === 'pencil') {
        const pt: [number, number] = [x, y];
        setCurrentStrokePoints((prev) => {
          if (prev.length === 0) return [pt];
          const last = prev[prev.length - 1];
          const dist = Math.sqrt((x - last[0]) ** 2 + (y - last[1]) ** 2);
          // Only commit points separated by minimum spacing to optimize payload size
          if (dist > 0.12) {
            return [...prev, pt];
          }
          return prev;
        });
      } else if (drawingTool === 'eraser') {
        eraseStrokesNearPoint(x, y);
      }
    }
  };

  const handlePointerUp = (e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!isDrawing) return;
    setIsDrawing(false);

    if (drawingTool === 'pencil' && currentStrokePoints.length > 0) {
      addDrawingStroke({
        uuid: `stroke-${Date.now()}-${Math.floor(Math.random() * 10005)}`,
        layer: activeDrawingLayer,
        tool: 'pencil',
        color: drawingColor,
        width: drawingWidth,
        points: currentStrokePoints,
        brushStyle: drawingBrushStyle
      });
    }
    setCurrentStrokePoints([]);
  };

  const createMirroredStrokes = (points: [number, number][]): DrawingStroke[] => {
    if (symmetricMirror === 'NONE' || points.length === 0) return [];
    
    const strokesToCreate: DrawingStroke[] = [];
    const makeStrokeObj = (pts: [number, number][], suffix: string) => ({
      uuid: `stroke-${Date.now()}-${Math.floor(Math.random() * 10005)}-mirror-${suffix}`,
      layer: activeDrawingLayer,
      tool: 'pencil' as const,
      color: drawingColor,
      width: drawingWidth,
      points: pts,
      brushStyle: drawingBrushStyle
    });

    if (symmetricMirror === 'Y' || symmetricMirror === 'BOTH') {
      strokesToCreate.push(makeStrokeObj(points.map(([x, y]) => [-x, y] as [number, number]), 'Y'));
    }
    if (symmetricMirror === 'X' || symmetricMirror === 'BOTH') {
      strokesToCreate.push(makeStrokeObj(points.map(([x, y]) => [x, -y] as [number, number]), 'X'));
    }
    if (symmetricMirror === 'BOTH') {
      strokesToCreate.push(makeStrokeObj(points.map(([x, y]) => [-x, -y] as [number, number]), 'XY'));
    }

    return strokesToCreate;
  };

  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeToolMode !== 'DRAW') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Safe boundary lock bypass
    }

    const is43 = canvasAspectRatio === '4:3';
    const playWidth = is43 ? 24 : 32;
    const halfWidth = playWidth / 2;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let ux = ((mouseX / rect.width) * playWidth) - halfWidth;
    let uy = -(((mouseY / rect.height) * 18) - 9);

    if (gridSnapValue > 0) {
      ux = Math.round(ux / gridSnapValue) * gridSnapValue;
      uy = Math.round(uy / gridSnapValue) * gridSnapValue;
    }

    if (drawingTool === 'pencil') {
      setIsDrawing(true);
      setCurrentStrokePoints([[ux, uy]]);
    } else if (drawingTool === 'eraser') {
      setIsDrawing(true);
      eraseStrokesNearPoint(ux, uy);
    }
  };

  const handleOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeToolMode !== 'DRAW') return;
    const is43 = canvasAspectRatio === '4:3';
    const playWidth = is43 ? 24 : 32;
    const halfWidth = playWidth / 2;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let ux = ((mouseX / rect.width) * playWidth) - halfWidth;
    let uy = -(((mouseY / rect.height) * 18) - 9);

    if (gridSnapValue > 0) {
      ux = Math.round(ux / gridSnapValue) * gridSnapValue;
      uy = Math.round(uy / gridSnapValue) * gridSnapValue;
    }

    setHoverCoords([parseFloat(ux.toFixed(2)), parseFloat(uy.toFixed(2))]);

    if (isDrawing) {
      if (drawingTool === 'pencil') {
        const pt: [number, number] = [ux, uy];
        if (straightLineMode) {
          setCurrentStrokePoints((prev) => {
            if (prev.length === 0) return [pt];
            return [prev[0], pt];
          });
        } else {
          setCurrentStrokePoints((prev) => {
            if (prev.length === 0) return [pt];
            const last = prev[prev.length - 1];
            const dist = Math.sqrt((ux - last[0]) ** 2 + (uy - last[1]) ** 2);
            if (dist > 0.08) {
              return [...prev, pt];
            }
            return prev;
          });
        }
      } else if (drawingTool === 'eraser') {
        eraseStrokesNearPoint(ux, uy);
      }
    }
  };

  const handleOverlayPointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (e && e.currentTarget && e.pointerId !== undefined) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Safe lock release
      }
    }

    if (drawingTool === 'pencil' && currentStrokePoints.length > 0) {
      const primaryStroke = {
        uuid: `stroke-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        layer: activeDrawingLayer,
        tool: 'pencil' as const,
        color: drawingColor,
        width: drawingWidth,
        points: currentStrokePoints,
        brushStyle: drawingBrushStyle
      };
      const mirrored = createMirroredStrokes(currentStrokePoints);
      addDrawingStroke(primaryStroke);
      mirrored.forEach(st => addDrawingStroke(st));
    }
    setCurrentStrokePoints([]);
  };

  const handleOverlayPointerLeave = () => {
    setHoverCoords(null);
    if (isDrawing) {
      setIsDrawing(false);
      if (drawingTool === 'pencil' && currentStrokePoints.length > 0) {
        const primaryStroke = {
          uuid: `stroke-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          layer: activeDrawingLayer,
          tool: 'pencil' as const,
          color: drawingColor,
          width: drawingWidth,
          points: currentStrokePoints,
          brushStyle: drawingBrushStyle
        };
        const mirrored = createMirroredStrokes(currentStrokePoints);
        addDrawingStroke(primaryStroke);
        mirrored.forEach(st => addDrawingStroke(st));
      }
      setCurrentStrokePoints([]);
    }
  };

  const handleUndoLastStroke = () => {
    const layerStrokes = drawingStrokes.filter(s => s.layer === activeDrawingLayer);
    if (layerStrokes.length === 0) return;
    const lastStrokeUuid = layerStrokes[layerStrokes.length - 1].uuid;
    const nextStrokes = drawingStrokes.filter(s => s.uuid !== lastStrokeUuid);
    setDrawingStrokes(nextStrokes);
  };

  const handleClearLayer = () => {
    if (confirm(`Flush all freehand strokes on the ${activeDrawingLayer.toUpperCase()} layer?`)) {
      clearDrawingStrokes(activeDrawingLayer);
    }
  };

  const selectedEntity = selectedUuid ? entities[selectedUuid] : null;

  // Drafting components declared inside component scope for dual-layout injection (avoiding code duplication)
  const headerPanel = (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2 shrink-0 ${
      theme === 'LIGHT' ? 'border-[#D1D1D6]/85' : 'border-[#2D2D33]/60'
    }`}>
      <div className="space-y-0.5">
        <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
          <span>Drafting Table Studio</span>
        </span>
        <p className={`text-[8.5px] font-mono ${
          theme === 'LIGHT' ? 'text-zinc-650' : 'text-[#71717A]'
        }`}>Precision vector drafting separated from 3D camera</p>
      </div>

      {/* Segmented layout controls */}
      <div className={`flex items-center border rounded p-0.5 self-start sm:self-auto transition-colors ${
        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
      }`}>
        {[
          { id: 'FULL_3D', icon: '🗺️', label: '3D' },
          { id: 'SPLIT', icon: '🌓', label: 'Split' },
          { id: 'FULL_2D', icon: '✏️', label: '2D Draft' }
        ].map((item) => {
          const isCurrent = draftLayoutMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setDraftLayoutMode(item.id as any)}
              className={`px-2 py-0.5 text-[8.5px] font-mono font-bold rounded-sm transition cursor-pointer flex items-center gap-1 ${
                isCurrent 
                  ? 'bg-[#7C3AED] text-white shadow-sm' 
                  : theme === 'LIGHT' 
                    ? 'text-zinc-650 hover:text-zinc-900 hover:bg-[#E5E5EA]' 
                    : 'text-[#A0A0AA] hover:text-white hover:bg-[#252529]'
              }`}
              title={`Switch workspace style to ${item.label}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const vectorSketchboard = (() => {
    const is43 = canvasAspectRatio === '4:3';
    const playWidth = is43 ? 24 : 32;
    const halfWidth = playWidth / 2;

    const renderStrokePath = (
      pts: [number, number][],
      strokeColor: string,
      strokeWidth: number,
      brushStyle: string,
      opacityValue: number,
      customKey: string
    ) => {
      if (pts.length < 2) return null;

      const percentPoints = pts.map(pt => {
        const px = ((pt[0] + halfWidth) / playWidth) * 100;
        const py = (1 - (pt[1] + 9) / 18) * 100;
        return { x: px, y: py };
      });

      const dString = `M ${percentPoints.map(p => `${p.x}% ${p.y}%`).join(' L ')}`;
      const bType = brushStyle || 'solid';

      if (bType === 'neon') {
        return (
          <g key={customKey} opacity={opacityValue}>
            <path
              d={dString}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth * 3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neon-glow)"
              opacity={0.65}
            />
            <path
              d={dString}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={strokeWidth * 0.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
          </g>
        );
      }

      if (bType === 'calligraphy') {
        return (
          <g key={customKey} opacity={opacityValue}>
            <path
              d={dString}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth * 1.5}
              strokeLinecap="square"
              strokeLinejoin="miter"
              style={{ transform: 'translate(-0.12%, 0.1%)' }}
            />
            <path
              d={dString}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth * 1.1}
              strokeLinecap="square"
              strokeLinejoin="miter"
              style={{ transform: 'translate(0.12%, -0.1%)' }}
              opacity={0.8}
            />
          </g>
        );
      }

      if (bType === 'charcoal') {
        return (
          <path
            key={customKey}
            d={dString}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth * 2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#charcoal-filter)"
            opacity={opacityValue * 0.85}
          />
        );
      }

      if (bType === 'dash') {
        return (
          <path
            key={customKey}
            d={dString}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth * 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 5"
            opacity={opacityValue}
          />
        );
      }

      if (bType === 'star') {
        const stars: React.ReactNode[] = [];
        percentPoints.forEach((pt, pIdx) => {
          if (pIdx % 3 === 0 || pIdx === percentPoints.length - 1) {
            const sizeX = (strokeWidth * 0.25) + 0.6;
            const sizeY = (strokeWidth * 0.45) + 1.1;
            const ptsAttr = `${pt.x}%,${pt.y - sizeY}% ${pt.x + sizeX}%,${pt.y}% ${pt.x}%,${pt.y + sizeY}% ${pt.x - sizeX}%,${pt.y}%`;
            stars.push(
              <polygon
                key={`star-${customKey}-${pIdx}`}
                points={ptsAttr}
                fill={strokeColor}
                opacity={opacityValue * 0.9}
              />
            );
          }
        });
        return (
          <g key={customKey}>
            <path
              d={dString}
              fill="none"
              stroke={strokeColor}
              strokeWidth={1.0}
              strokeDasharray="2 6"
              opacity={opacityValue * 0.4}
              strokeLinecap="round"
            />
            {stars}
          </g>
        );
      }

      return (
        <path
          key={customKey}
          d={dString}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth * 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacityValue}
        />
      );
    };

    // Build CAD Precision Ruler Ticks
    const renderRulerTicks = () => {
      const ticks = [];
      
      // X Rulers (Horizontal)
      for (let x = -halfWidth; x <= halfWidth; x += 1) {
        const pctX = ((x + halfWidth) / playWidth) * 100;
        const isMajor = x % 2 === 0;
        ticks.push(
          <g key={`xtick-${x}`}>
            <line
              x1={`${pctX}%`}
              y1="0"
              x2={`${pctX}%`}
              y2={isMajor ? "6" : "3"}
              stroke={theme === 'LIGHT' ? '#A1A1AA' : '#3F3F46'}
              strokeWidth={0.8}
            />
            {isMajor && (
              <text
                x={`${pctX}%`}
                y="11"
                textAnchor="middle"
                fill={theme === 'LIGHT' ? '#71717A' : '#71717A'}
                fontSize="5px"
                fontFamily="monospace"
                className="select-none pointer-events-none font-bold scale-[0.9]"
              >
                {x}
              </text>
            )}
          </g>
        );
      }

      // Y Rulers (Vertical)
      for (let y = -9; y <= 9; y += 1) {
        const pctY = (1 - (y + 9) / 18) * 100;
        const isMajor = y % 2 === 0;
        ticks.push(
          <g key={`ytick-${y}`}>
            <line
              x1="0"
              y1={`${pctY}%`}
              x2={isMajor ? "6" : "3"}
              y2={`${pctY}%`}
              stroke={theme === 'LIGHT' ? '#A1A1AA' : '#3F3F46'}
              strokeWidth={0.8}
            />
            {isMajor && (
              <text
                x="8"
                y={`${pctY}%`}
                dominantBaseline="middle"
                fill={theme === 'LIGHT' ? '#71717A' : '#71717A'}
                fontSize="5px"
                fontFamily="monospace"
                className="select-none pointer-events-none font-bold scale-[0.9]"
              >
                {y}
              </text>
            )}
          </g>
        );
      }

      return ticks;
    };

    // Mirror current layer existing strokes helper
    const handleMirrorExistingStrokes = (axis: 'X' | 'Y') => {
      const layerStrokes = drawingStrokes.filter(s => s.layer === activeDrawingLayer);
      if (layerStrokes.length === 0) return;
      
      const mirrored = layerStrokes.map(st => {
        const pts = st.points.map(([x, y]) => {
          return [
            axis === 'Y' ? -x : x, // Mirror over Y-axis (invert X)
            axis === 'X' ? -y : y  // Mirror over X-axis (invert Y)
          ] as [number, number];
        });
        return {
          ...st,
          uuid: `stroke-${Date.now()}-${Math.floor(Math.random() * 100000)}-mirror-${axis}`,
          points: pts
        };
      });
      setDrawingStrokes([...drawingStrokes, ...mirrored]);
    };

    return (
      <div className="space-y-2 select-none shrink-0" id="drafting-vector-sketchboard">
        {/* Header toolbar with live coordinate indicator */}
        <div className={`flex justify-between items-center border p-2 rounded-t-md transition-colors ${
          theme === 'LIGHT' ? 'bg-[#F4F4F5] border-[#D1D1D6]' : 'bg-[#0F0F13] border-[#2D2D33]/40'
        }`}>
          <div className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-purple-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span className={`uppercase text-[8px] tracking-wider font-extrabold flex items-center gap-1 ${
              theme === 'LIGHT' ? 'text-zinc-805 text-zinc-800' : 'text-gray-300'
            }`}>
              {canvasAspectRatio} CAD Precision Board
            </span>
          </div>
          {hoverCoords ? (
            <div className="flex items-center gap-2 text-[9px] font-mono">
              <span className="text-zinc-500">COORD:</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[#9562FF] font-semibold">
                X: <span className="font-extrabold">{hoverCoords[0]}</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-[#9562FF] font-semibold">
                Y: <span className="font-extrabold">{hoverCoords[1]}</span>
              </span>
            </div>
          ) : (
            <span className="text-[8px] font-mono text-[#71717A] italic">Hover grid coordinate rulers</span>
          )}
        </div>

        {/* The Viewport Container */}
        <div 
          className={`relative ${
            is43 ? 'aspect-[4/3]' : 'aspect-video'
          } w-full rounded-b-none border-x border-b shadow-2xl overflow-hidden cursor-crosshair group flex items-center justify-center transition-all ${
            theme === 'LIGHT' 
              ? 'bg-[#FAFAF9] border-[#D1D1D6] shadow-purple-900/5' 
              : 'bg-[#08080A] border-[#2D2D33]/50 hover:border-purple-500/30'
          }`}
          onPointerDown={handleOverlayPointerDown}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerUp}
          onPointerLeave={handleOverlayPointerLeave}
        >
          {/* Grid visual coordinates */}
          <div className={`absolute inset-0 pointer-events-none opacity-[0.06] ${
            theme === 'LIGHT' 
              ? 'bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)]' 
              : 'bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)]'
          } bg-[size:10%_10%]` } />
          <div className="absolute inset-0 pointer-events-none opacity-[0.2] bg-[linear-gradient(to_right,#7C3AED_1px,transparent_1px),linear-gradient(to_bottom,#7C3AED_1px,transparent_1px)] bg-[size:25%_25%]" />

          {/* Canvas Center Axis Markers */}
          <div className="absolute left-1/2 top-0 bottom-0 w-[0.5px] border-l border-zinc-500/30 dashed pointer-events-none animate-pulse" />
          <div className="absolute top-1/2 left-0 right-0 h-[0.5px] border-t border-zinc-500/30 dashed pointer-events-none animate-pulse" />

          {/* Grid guidelines metrics indicator */}
          <span className={`absolute bottom-2 left-10 pointer-events-none text-[7px] font-mono font-bold uppercase transition-colors select-none leading-none ${
            theme === 'LIGHT' ? 'text-zinc-500' : 'text-zinc-500'
          }`}>
            X Limit: ±{halfWidth} | Y Limit: ±9
          </span>

          <span className="absolute top-2 right-10 pointer-events-none text-[8px] font-mono bg-purple-500/10 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded font-extrabold tracking-wider select-none uppercase">
            ✏️ {activeDrawingLayer.toUpperCase()} PLANE
          </span>

          {/* SVG Render Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <defs>
              <filter id="charcoal-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="3" result="rough" />
                <feDisplacementMap in="SourceGraphic" in2="rough" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Draw Rulers ticks */}
            {renderRulerTicks()}

            {/* Draw Scene Backdrops Outlines (Ensuring complete coordinate awareness) */}
            {showSceneReferences && Object.values(entities).map((ent) => {
              const entLayer = getEntityLayer(ent.transform.position[2]);
              const isLayerMatch = entLayer === activeDrawingLayer;
              const ex = ent.transform.position[0];
              const ey = ent.transform.position[1];
              const ew = ent.transform.scale[0];
              const eh = ent.transform.scale[1];

              const pctX = ((ex - ew / 2 + halfWidth) / playWidth) * 100;
              const pctY = (1 - (ey + eh / 2 + 9) / 18) * 100;
              const pctW = (ew / playWidth) * 100;
              const pctH = (eh / 18) * 100;

              let colHex = '#7C3AED';
              if (ent.behavior === 'PLAYER') colHex = '#10B981';
              else if (ent.behavior === 'HAZARD') colHex = '#EF4444';
              else if (ent.behavior === 'COLLECTIBLE') colHex = '#F59E0B';
              else if (ent.behavior === 'TRIGGER') colHex = '#3B82F6';

              return (
                <g key={`backdrop-${ent.uuid}`} opacity={isLayerMatch ? 0.35 : 0.08} className="transition-opacity duration-300">
                  <rect
                    x={`${pctX}%`}
                    y={`${pctY}%`}
                    width={`${pctW}%`}
                    height={`${pctH}%`}
                    fill={colHex}
                    fillOpacity={0.08}
                    stroke={colHex}
                    strokeWidth={1.2}
                    strokeDasharray={isLayerMatch ? "none" : "2 2"}
                    rx={1.5}
                  />
                  <text
                    x={`${pctX + pctW / 2}%`}
                    y={`${pctY + pctH / 2 + 1.2}%`}
                    textAnchor="middle"
                    fill={colHex}
                    fontSize="5px"
                    fontFamily="monospace"
                    fontWeight="bold"
                    className="select-none pointer-events-none opacity-80"
                  >
                    {ent.name.toUpperCase()} (H:{eh})
                  </text>
                </g>
              );
            })}

            {/* Hover Precision Alignment Crosshair Guide Lines */}
            {hoverCoords && (
              <g opacity={0.35}>
                {/* Vertical align */}
                <line
                  x1={`${((hoverCoords[0] + halfWidth) / playWidth) * 100}%`}
                  y1="0"
                  x2={`${((hoverCoords[0] + halfWidth) / playWidth) * 100}%`}
                  y2="100%"
                  stroke="#7C3AED"
                  strokeWidth={0.8}
                  strokeDasharray="2 3"
                />
                {/* Horizontal align */}
                <line
                  x1="0"
                  y1={`${(1 - (hoverCoords[1] + 9) / 18) * 100}%`}
                  x2="100%"
                  y2={`${(1 - (hoverCoords[1] + 9) / 18) * 100}%`}
                  stroke="#7C3AED"
                  strokeWidth={0.8}
                  strokeDasharray="2 3"
                />
              </g>
            )}

             {/* Render existing vector strokes */}
            {drawingStrokes.map((stroke, index) => {
              const matchesCurrent = stroke.layer === activeDrawingLayer;
              if (isolateDrawingLayer && !matchesCurrent) return null;

              // Customize exact trace visibility opacity based on sliders
              let strokeOp = matchesCurrent ? 0.95 : 0.15;
              if (stroke.layer === 'background') strokeOp = bgDrawingOpacity;
              else if (stroke.layer === 'gameplay') strokeOp = gpDrawingOpacity;
              else if (stroke.layer === 'foreground') strokeOp = fgDrawingOpacity;

              return renderStrokePath(
                stroke.points,
                stroke.color,
                stroke.width,
                stroke.brushStyle || 'solid',
                strokeOp,
                stroke.uuid || `stroke-${index}`
              );
            })}

            {/* Render active vector brush segment */}
            {isDrawing && currentStrokePoints.length >= 2 && (
              renderStrokePath(
                currentStrokePoints,
                drawingColor,
                drawingWidth,
                drawingBrushStyle,
                0.95,
                'live-active'
              )
            )}

            {/* Live mirror symmetry guide previewing (so artists don't draft blind) */}
            {isDrawing && currentStrokePoints.length >= 2 && symmetricMirror !== 'NONE' && (
              <>
                {/* Horizontal Flip */}
                {(symmetricMirror === 'Y' || symmetricMirror === 'BOTH') && (
                  renderStrokePath(
                    currentStrokePoints.map(([x, y]) => [-x, y]),
                    drawingColor,
                    drawingWidth,
                    drawingBrushStyle,
                    0.45,
                    'live-mirror-y'
                  )
                )}
                {/* Vertical flip */}
                {(symmetricMirror === 'X' || symmetricMirror === 'BOTH') && (
                  renderStrokePath(
                    currentStrokePoints.map(([x, y]) => [x, -y]),
                    drawingColor,
                    drawingWidth,
                    drawingBrushStyle,
                    0.45,
                    'live-mirror-x'
                  )
                )}
                {/* Diagonal symmetry flip */}
                {symmetricMirror === 'BOTH' && (
                  renderStrokePath(
                    currentStrokePoints.map(([x, y]) => [-x, -y]),
                    drawingColor,
                    drawingWidth,
                    drawingBrushStyle,
                    0.45,
                    'live-mirror-xy'
                  )
                )}
              </>
            )}
          </svg>
        </div>

        {/* Tactical Config Dashboard Panel */}
        <div className={`p-2.5 rounded-b-md border-x border-b text-[8.5px] font-mono grid grid-cols-1 md:grid-cols-2 gap-3 transition-colors ${
          theme === 'LIGHT' ? 'bg-[#FAFAF9] border-[#D1D1D6]' : 'bg-[#0E0E12] border-[#2D2D33]/40'
        }`}>
          {/* Snap and Rulers alignment */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className={`font-bold uppercase tracking-tight ${theme==='LIGHT' ? 'text-zinc-700':'text-zinc-400'}`}>
                📏 Precision Snap Align
              </span>
              <span className="font-semibold text-purple-400 font-mono">
                {gridSnapValue > 0 ? `${gridSnapValue} units` : 'FREEHAND'}
              </span>
            </div>
            
            <div className="flex gap-1">
              {[
                { name: 'OFF', val: 0 },
                { name: '0.10', val: 0.1 },
                { name: '0.25', val: 0.25 },
                { name: '0.50', val: 0.5 },
                { name: '1.00', val: 1.0 },
                { name: '2.00', val: 2.0 }
              ].map(opt => (
                <button
                  key={`snap-${opt.val}`}
                  type="button"
                  onClick={() => setGridSnapValue(opt.val)}
                  className={`flex-1 py-1 rounded border text-[7.5px] font-bold transition focus:outline-none cursor-pointer ${
                    gridSnapValue === opt.val
                      ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                      : theme === 'LIGHT'
                        ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        : 'bg-zinc-900 border-zinc-805 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                  title={`Snap coordinates to ${opt.name} units`}
                >
                  {opt.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              {/* Straight line toggle */}
              <button
                type="button"
                onClick={() => setStraightLineMode(!straightLineMode)}
                className={`flex-1 py-1 px-1.5 rounded border text-[7.2px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                  straightLineMode
                    ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                    : theme === 'LIGHT'
                      ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}
                title="Force mouse/pointer inputs to draw straight vector wireframes"
              >
                <span>📐</span>
                <span>STRAIGHT MODE: {straightLineMode ? 'ON' : 'OFF'}</span>
              </button>

              {/* Show entity references backdrop toggle */}
              <button
                type="button"
                onClick={() => setShowSceneReferences(!showSceneReferences)}
                className={`flex-1 py-1 px-1.5 rounded border text-[7.2px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                  showSceneReferences
                    ? 'bg-purple-600/10 border-purple-500/45 text-purple-400'
                    : theme === 'LIGHT'
                      ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}
                title="Show translucent shadows and labels of 3D objects as backdrops inside the 2D drafting table"
              >
                <span>👁️</span>
                <span>3D SCENE REF: {showSceneReferences ? 'VISIBLE' : 'HIDDEN'}</span>
              </button>
            </div>
          </div>

          {/* Symmetry Mirror and Transform actions */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className={`font-bold uppercase tracking-tight ${theme==='LIGHT' ? 'text-zinc-700':'text-zinc-400'}`}>
                🪞 Symmetry Auto-Mirror
              </span>
              <span className="font-semibold text-purple-400 font-mono">
                {symmetricMirror === 'NONE' ? 'MUTABLE' : `AXIS: ${symmetricMirror}`}
              </span>
            </div>

            <div className="flex gap-1 col-span-2">
              {[
                { label: 'OFF', code: 'NONE' as const },
                { label: 'X-FLIP', code: 'X' as const },
                { label: 'Y-FLIP', code: 'Y' as const },
                { label: 'BOTH', code: 'BOTH' as const }
              ].map(mMode => (
                <button
                  key={`sym-${mMode.code}`}
                  type="button"
                  onClick={() => setSymmetricMirror(mMode.code)}
                  className={`flex-1 py-1 rounded border text-[7.5px] font-bold transition focus:outline-none cursor-pointer ${
                    symmetricMirror === mMode.code
                      ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                      : theme === 'LIGHT'
                        ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        : 'bg-zinc-900 border-zinc-805 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                  title={`Automatically duplicate every brush point drawn symmetrical to axis ${mMode.label}`}
                >
                  {mMode.label}
                </button>
              ))}
            </div>

            {/* Quick bulk mirror transformations */}
            <div className="flex items-center gap-2 pt-1 border-t border-zinc-500/10 mt-1">
              <span className="text-[7.5px] uppercase text-zinc-400 font-bold shrink-0">Bulk Layer Flip:</span>
              <button
                type="button"
                onClick={() => handleMirrorExistingStrokes('Y')}
                className={`flex-1 py-0.5 px-1 rounded border text-[6.8px] font-extrabold flex items-center justify-center gap-0.5 hover:bg-purple-500 hover:text-white transition cursor-pointer ${
                  theme === 'LIGHT' 
                    ? 'border-zinc-350 border-zinc-300 text-zinc-700 bg-white shadow-sm' 
                    : 'border-zinc-800 text-zinc-300 bg-zinc-900'
                }`}
                title="Duplicate and invert all existing vectors on this layer horizontally"
              >
                <span>Flip-Y (Horiz)</span>
              </button>

              <button
                type="button"
                onClick={() => handleMirrorExistingStrokes('X')}
                className={`flex-1 py-0.5 px-1 rounded border text-[6.8px] font-extrabold flex items-center justify-center gap-0.5 hover:bg-purple-500 hover:text-white transition cursor-pointer ${
                  theme === 'LIGHT' 
                    ? 'border-zinc-350 border-zinc-300 text-zinc-700 bg-white shadow-sm' 
                    : 'border-zinc-800 text-zinc-300 bg-zinc-900'
                }`}
                title="Duplicate and invert all existing vectors on this layer vertically"
              >
                <span>Flip-X (Vert)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  })();

  const depthStackPreview = (
    <div className={`rounded border p-3 shadow-md flex flex-col gap-2 shrink-0 transition-colors ${
      theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141419] border-[#2D2D33]/60'
    }`} id="drafting-isometric-stack">
      <div className={`flex justify-between items-center border-b pb-1.5 font-mono text-[9px] transition-colors ${
        theme === 'LIGHT' ? 'border-[#E5E5EA] text-zinc-650' : 'border-[#2D2D33]/40 text-[#A0A0AA]'
      }`}>
        <span className="uppercase text-[8px] tracking-wide font-extrabold flex items-center gap-1.5 text-purple-400">
          <Layers className="w-3.5 h-3.5 animate-pulse" />
          <span>Visual Depth Stack Preview</span>
        </span>
        <span className={`text-[7.5px] italic ${
          theme === 'LIGHT' ? 'text-zinc-500' : 'text-[#71717A]'
        }`}>Tactile workspace view (click sheets)</span>
      </div>
      
      <div className={`relative h-28 w-full flex items-center justify-center overflow-hidden border rounded-sm transition-colors ${
        theme === 'LIGHT' ? 'bg-[#FAFAF9] border-[#D1D1D6]' : 'bg-[#070709] border-[#212126]'
      }`}>
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#808080_1px,transparent_1px)] [background-size:12px_12px]" />
        
        {/* Exploded stack container with CSS 3D Transforms */}
        <div 
          className="relative w-40 h-20 select-none pointer-events-auto cursor-default"
          style={{
            transform: 'perspective(500px) rotateX(55deg) rotateZ(-35deg)',
            transformStyle: 'preserve-3d'
          }}
        >
          {[
            { id: 'foreground', zOffset: 20, color: '#10B981', label: 'FG (Overlay)', dotBg: 'bg-[#10B981]' },
            { id: 'gameplay', zOffset: 0, color: '#7C3AED', label: 'GP (Gameplay)', dotBg: 'bg-[#7C3AED]' },
            { id: 'background', zOffset: -20, color: '#EF4444', label: 'BG (Canvas)', dotBg: 'bg-[#EF4444]' }
          ].map((ly) => {
            const isActive = activeDrawingLayer === ly.id;
            const isVisible = layerVisibility[ly.id as 'background'|'gameplay'|'foreground'];
            const isLocked = layerLock[ly.id as 'background'|'gameplay'|'foreground'];
            const strokes = drawingStrokes.filter(s => s.layer === ly.id);
            const is43 = canvasAspectRatio === '4:3';
            const playWidth = is43 ? 24 : 32;
            const halfWidth = playWidth / 2;
            
            return (
              <div
                key={ly.id}
                onClick={() => useSpatialEditorStore.getState().setActiveDrawingLayer(ly.id as any)}
                className={`absolute inset-0 rounded border cursor-pointer select-none transition-all duration-300 flex items-center justify-center ${
                  isActive 
                    ? theme === 'LIGHT'
                      ? 'bg-purple-100/70 border-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.25)] z-20'
                      : 'bg-[#7C3AED]/12 border-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.3)] z-20' 
                    : theme === 'LIGHT'
                      ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 opacity-80 z-10'
                      : 'bg-black/50 hover:bg-[#1E1E24]/20 border-white/5 opacity-70 z-10'
                }`}
                style={{
                  transform: `translate3d(0px, 0px, ${isActive ? ly.zOffset + 6 : ly.zOffset}px)`,
                  transformStyle: 'preserve-3d',
                  boxShadow: isActive ? '0px 0px 15px rgba(124, 58, 237, 0.2)' : 'none'
                }}
                title={`Select layer: ${ly.label}`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded border border-dashed border-purple-400/40 animate-pulse pointer-events-none" />
                )}
                
                <div 
                  className="absolute top-1 left-2 font-mono text-[7px] font-bold uppercase select-none tracking-tight transition-colors flex items-center gap-1"
                  style={{
                    transform: 'rotateX(-20deg) rotateY(10deg)',
                    backfaceVisibility: 'hidden',
                    color: ly.color
                  }}
                >
                  <span className={`w-1 h-1 rounded-full ${ly.dotBg}`} />
                  <span>{ly.label}</span>
                  {isLocked && <Lock className="w-2 h-2 text-red-500" />}
                  {!isVisible && <EyeOff className="w-2 h-2 text-[#71717A]" />}
                </div>
                
                {isVisible && (
                  <svg className="w-full h-full p-2 pointer-events-none select-none opacity-80 animate-fade-in" viewBox={`0 0 ${playWidth} 18`}>
                    {strokes.map((stroke, sIdx) => {
                      const pts = stroke.points;
                      if (pts.length < 2) return null;
                      const dPath = `M ${pts.map(p => `${((p[0] + halfWidth) / playWidth) * playWidth} ${(1 - (p[1] + 9) / 18) * 18}`).join(' L ')}`;
                      return (
                        <path
                          key={stroke.uuid || sIdx}
                          d={dPath}
                          fill="none"
                          stroke={stroke.color}
                          strokeWidth={1.5}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>
                )}
                
                <span className="absolute bottom-1 right-2 text-[6px] font-mono font-bold select-none leading-none text-gray-500">
                  {strokes.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const handleDuplicateLayerStrokes = (targetLayer: 'background' | 'gameplay' | 'foreground') => {
    if (targetLayer === activeDrawingLayer) return;
    const currentLayerStrokes = drawingStrokes.filter(s => s.layer === activeDrawingLayer);
    if (currentLayerStrokes.length === 0) {
      alert(`There are no lines drawn on the active '${activeDrawingLayer}' layer to clone.`);
      return;
    }
    
    if (confirm(`Clone ALL (${currentLayerStrokes.length}) hand-drawn vector stroke segments in the active '${activeDrawingLayer}' layer over to the '${targetLayer}' layer?`)) {
      const duplicated = currentLayerStrokes.map(st => ({
        ...st,
        uuid: `stroke-${Date.now()}-${Math.floor(Math.random() * 1000000)}-clone`,
        layer: targetLayer
      }));
      setDrawingStrokes([...drawingStrokes, ...duplicated]);
    }
  };

  const layerManagerConsole = (
    <div className={`rounded border p-3.5 space-y-3 shadow-md shrink-0 transition-colors ${
      theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141419] border-[#2D2D33]/60'
    }`} id="drafting-layer-console">
      <div className={`flex items-center justify-between border-b pb-2 ${
        theme === 'LIGHT' ? 'border-[#E5E5EA]' : 'border-[#2D2D33]/50'
      }`}>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          <span>Drafting Layers</span>
        </span>

        <button
          type="button"
          onClick={() => setIsolateDrawingLayer(prev => !prev)}
          className={`text-[8.5px] font-mono px-2 py-0.5 rounded border transition cursor-pointer flex items-center gap-1.5 ${
            isolateDrawingLayer 
              ? 'bg-[#7C3AED]/20 border-purple-500 text-purple-700 dark:text-purple-300 font-extrabold' 
              : theme === 'LIGHT'
                ? 'bg-zinc-100 border-zinc-200 text-zinc-650 hover:bg-zinc-200 hover:text-zinc-900'
                : 'bg-[#1C1C24] border-transparent text-[#71717A] hover:bg-[#25252E] hover:text-white'
          }`}
          title="Make other layers completely invisible in 2D drafting sheet"
        >
          <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
          <span>{isolateDrawingLayer ? 'Layer Isolated' : 'Onion Skinning (On)'}</span>
        </button>
      </div>

      <div className="space-y-1.5">
        {[
          { id: 'foreground', name: 'Foreground Layer', z: 12, dotBg: 'bg-[#10B981]' },
          { id: 'gameplay', name: 'Gameplay Center', z: 0, dotBg: 'bg-[#7C3AED]' },
          { id: 'background', name: 'Background Canvas', z: -15, dotBg: 'bg-[#EF4444]' }
        ].map(ly => {
          const isActive = activeDrawingLayer === ly.id;
          const isVisible = layerVisibility[ly.id as 'background'|'gameplay'|'foreground'];
          const isLocked = layerLock[ly.id as 'background'|'gameplay'|'foreground'];
          const count = drawingStrokes.filter(s => s.layer === ly.id).length;

          return (
            <div 
              key={ly.id}
              className={`flex items-center justify-between p-2 rounded border transition ${
                isActive 
                  ? theme === 'LIGHT'
                    ? 'bg-purple-50 border-purple-300 text-purple-900'
                    : 'bg-[#7C3AED]/12 border-purple-500/50 text-white' 
                  : theme === 'LIGHT'
                    ? 'bg-[#F2F2F7] border-transparent text-zinc-700 hover:bg-[#E5E5EA]'
                    : 'bg-[#191921] border-transparent text-[#A0A0AA] hover:bg-[#20202A]'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  useSpatialEditorStore.getState().setActiveDrawingLayer(ly.id as any);
                }}
                className="flex-1 flex items-center gap-2 text-left cursor-pointer select-none"
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition ${
                  isActive 
                    ? theme === 'LIGHT' ? 'border-purple-500 bg-white' : 'border-purple-400 bg-purple-950/40 text-purple-300' 
                    : 'border-gray-700 bg-black/40'
                }`}>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />}
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className={`text-[10px] font-mono font-bold leading-none flex items-center gap-1.5 ${
                    isActive 
                      ? theme === 'LIGHT' ? 'text-purple-800' : 'text-purple-300'
                      : theme === 'LIGHT' ? 'text-zinc-800' : 'text-[#A0A0AA]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ly.dotBg}`} />
                    {ly.name}
                  </span>
                  <span className="text-[8px] font-mono text-gray-500 font-semibold">depth: Z = {ly.z} ({count} strokes)</span>
                </div>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    useSpatialEditorStore.getState().setLayerVisibility(ly.id as any, !isVisible);
                  }}
                  className={`p-1 rounded cursor-pointer transition ${
                    isVisible 
                      ? 'text-purple-500 hover:text-purple-700' 
                      : 'text-zinc-400 hover:text-zinc-650 bg-black/10 dark:bg-black/20'
                  }`}
                  title={isVisible ? 'Visible on Canvas' : 'Hidden on Canvas'}
                >
                  {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    useSpatialEditorStore.getState().setLayerLock(ly.id as any, !isLocked);
                  }}
                  className={`p-1 rounded cursor-pointer transition ${
                    isLocked 
                      ? 'text-amber-500 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/20' 
                      : 'text-zinc-400 hover:text-zinc-650'
                  }`}
                  title={isLocked ? 'Locked (Protected)' : 'Unlocked (Editable)'}
                >
                  {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Undo and Flush Actions */}
      <div className={`grid grid-cols-2 gap-1.5 pt-1.5 border-t ${
        theme === 'LIGHT' ? 'border-[#E5E5EA]' : 'border-[#2D2D33]/50'
      }`}>
        <button
          type="button"
          onClick={handleUndoLastStroke}
          disabled={drawingStrokes.filter(s => s.layer === activeDrawingLayer).length === 0}
          className={`py-1 px-2.5 rounded text-[9px] uppercase font-mono font-bold tracking-tight border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center justify-center gap-1 ${
            theme === 'LIGHT'
              ? 'bg-white border-[#D1D1D6] text-zinc-700 hover:bg-zinc-100'
              : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-gray-350'
          }`}
          title="Undo last pencil line on this active layer"
        >
          <Undo className="w-3.5 h-3.5" />
          <span>Undo Line</span>
        </button>

        <button
          type="button"
          onClick={handleClearLayer}
          disabled={drawingStrokes.filter(s => s.layer === activeDrawingLayer).length === 0}
          className={`py-1 px-2 rounded text-[9px] uppercase font-mono font-bold tracking-tight border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1 transition ${
            theme === 'LIGHT'
              ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              : 'bg-[#991b1b]/20 border-[#991b1b]/30 text-rose-300 hover:bg-[#991b1b]/30'
          }`}
          title="Clear all drawings on this active layer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Layer</span>
        </button>
      </div>

      {/* Clone current layer vectors to other layers */}
      <div className={`pt-2 border-t flex flex-col gap-1.5 ${
        theme === 'LIGHT' ? 'border-[#E5E5EA]' : 'border-[#2D2D33]/40'
      }`}>
        <span className="text-[8px] font-mono uppercase font-extrabold text-[#71717A]">Clone Active Vectors To:</span>
        <div className="grid grid-cols-2 gap-1.5">
          {(['background', 'gameplay', 'foreground'] as const).map(target => {
            if (target === activeDrawingLayer) return null;
            const targetLabel = target === 'background' ? 'To Background' : target === 'foreground' ? 'To Foreground' : 'To Gameplay';
            return (
              <button
                key={`clone-to-${target}`}
                type="button"
                onClick={() => handleDuplicateLayerStrokes(target)}
                className={`py-1 px-1.5 rounded border text-[8px] font-mono font-bold transition hover:bg-purple-600 hover:text-white cursor-pointer ${
                  theme === 'LIGHT'
                    ? 'bg-zinc-55 border-zinc-200 text-zinc-700 bg-zinc-50'
                    : 'bg-[#191921] border-[#2D2D33] text-zinc-300'
                }`}
                title={`Clone vector points to '${target}' plane`}
              >
                <span>{targetLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Onion skin opacities slider dashboard section */}
      <div className={`pt-2.5 border-t space-y-2 ${
        theme === 'LIGHT' ? 'border-[#E5E5EA]' : 'border-[#2D2D33]/40'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-mono uppercase font-extrabold text-[#71717A]">Trace Onion Opacities:</span>
          <span className="text-[7.5px] font-mono text-zinc-500">Separated Depth Levels</span>
        </div>
        
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[8px] font-mono">
            <span className="w-16 shrink-0 text-[#71717A] uppercase font-semibold">Background:</span>
            <input 
              type="range" 
              min="0.05" 
              max="1" 
              step="0.05" 
              value={bgDrawingOpacity} 
              onChange={(e) => setBgDrawingOpacity(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-700/60 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="w-7 text-right text-purple-400 font-extrabold">{Math.round(bgDrawingOpacity * 100)}%</span>
          </div>

          <div className="flex items-center gap-2 text-[8px] font-mono">
            <span className="w-16 shrink-0 text-[#71717A] uppercase font-semibold">Gameplay:</span>
            <input 
              type="range" 
              min="0.05" 
              max="1" 
              step="0.05" 
              value={gpDrawingOpacity} 
              onChange={(e) => setGpDrawingOpacity(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-700/60 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="w-7 text-right text-purple-400 font-extrabold">{Math.round(gpDrawingOpacity * 100)}%</span>
          </div>

          <div className="flex items-center gap-2 text-[8px] font-mono">
            <span className="w-16 shrink-0 text-[#71717A] uppercase font-semibold">Foreground:</span>
            <input 
              type="range" 
              min="0.05" 
              max="1" 
              step="0.05" 
              value={fgDrawingOpacity} 
              onChange={(e) => setFgDrawingOpacity(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-700/60 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="w-7 text-right text-purple-400 font-extrabold">{Math.round(fgDrawingOpacity * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );

  const onionSkinningTip = (
    <div className={`border p-2.5 rounded text-[8.5px] font-mono leading-relaxed flex items-start gap-1.5 shrink-0 transition-colors ${
      theme === 'LIGHT' ? 'bg-[#FAFAF9] border-[#D1D1D6] text-zinc-600' : 'bg-[#101014] border-[#2D2D33]/40 text-[#71717A]'
    }`} id="drafting-onion-tip">
      <span>💡</span>
      <p>
        <strong className={theme === 'LIGHT' ? 'text-zinc-900 font-bold' : 'text-gray-400 font-bold'}>Onion Skinning</strong> renders other layer depths faint-colored in the background so you can reference gameplay components. Toggle "Layer Isolated" to sketch on a completely blank canvas.
      </p>
    </div>
  );

  return (
    <div className="w-full h-full relative font-sans" id="spatial-canvas-viewport">
      <div className={`w-full h-full ${isSplitMode ? 'flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[#202025]' : ''}`}>
        
        {/* Left Side (or full screen): 3D Viewport component */}
        {!isFull2D && (
          <div className={`relative ${isSplitMode ? 'flex-[6] min-w-0 lg:w-0 h-1/2 lg:h-full flex flex-col' : 'w-full h-full'}`}>
          <Canvas
            shadows
            orthographic={cameraMode !== 'PERSPECTIVE'}
            camera={{
              position: [15, 15, 15],
              fov: 45,
              near: 0.1,
              far: 1000,
              zoom: cameraZoom
            }}
            gl={{ antialias: true }}
          >
            <color attach="background" args={['#141417']} />
            
            {/* Ambient & Directional Lights */}
            <ambientLight intensity={0.4} />
            <directionalLight
              position={[10, 20, 10]}
              intensity={1.2}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <pointLight position={[-10, 15, -10]} intensity={0.5} />

            {/* Floor and Dot grids */}
            <Grid
              position={[0, -2.5, 0]}
              args={[50, 50]}
              cellSize={1.0}
              cellColor="#2D2D33"
              sectionSize={5.0}
              sectionColor="#7C3AED"
              fadeDistance={50}
            />

            {/* Visual Guides */}
            <DepthLayerDividers />

            {/* Playfield Bounding Outlines */}
            {showGuideFrame && (
              <group>
                {layerVisibility.background && (
                  <Line
                    points={[
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), -9, -15],
                      [(canvasAspectRatio === '4:3' ? 12 : 16), -9, -15],
                      [(canvasAspectRatio === '4:3' ? 12 : 16), 9, -15],
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), 9, -15],
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), -9, -15]
                    ]}
                    color="#EF4444"
                    lineWidth={1.5}
                    dashed
                    dashScale={1}
                    dashSize={0.4}
                    gapSize={0.25}
                  />
                )}
                {layerVisibility.gameplay && (
                  <Line
                    points={[
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), -9, 0],
                      [(canvasAspectRatio === '4:3' ? 12 : 16), -9, 0],
                      [(canvasAspectRatio === '4:3' ? 12 : 16), 9, 0],
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), 9, 0],
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), -9, 0]
                    ]}
                    color="#7C3AED"
                    lineWidth={2.0}
                    dashed
                    dashScale={1}
                    dashSize={0.5}
                    gapSize={0.25}
                  />
                )}
                {layerVisibility.foreground && (
                  <Line
                    points={[
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), -9, 12],
                      [(canvasAspectRatio === '4:3' ? 12 : 16), -9, 12],
                      [(canvasAspectRatio === '4:3' ? 12 : 16), 9, 12],
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), 9, 12],
                      [-(canvasAspectRatio === '4:3' ? 12 : 16), -9, 12]
                    ]}
                    color="#10B981"
                    lineWidth={1.5}
                    dashed
                    dashScale={1}
                    dashSize={0.4}
                    gapSize={0.25}
                  />
                )}
              </group>
            )}

            {/* Trajectory path rendering */}
            <TrajectorySpline points={cameraTrajectory} />

            {/* Entities list renderer with Layer visibility filtering */}
            {Object.values(entities).map((ent) => {
              const isSelected = ent.uuid === selectedUuid;
              const layer = getEntityLayer(ent.transform.position[2]);

              // Hide layer elements if toggled off outside of the canvas
              if (!layerVisibility[layer]) return null;
              
              return (
                <group
                  key={ent.uuid}
                  position={ent.transform.position}
                  rotation={new THREE.Euler(...ent.transform.rotation)}
                  scale={ent.transform.scale}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Disable selecting if this whole layer has been locked
                    if (layerLock[layer]) return;
                    onSelectEntity(ent.uuid);
                  }}
                >
                  <EntityMesh entity={ent} isSelected={isSelected} />
                </group>
              );
            })}

            {/* Render Saved Freehand Drawing Lines */}
            {drawingStrokes.map((stroke, index) => {
              const depthZ = stroke.layer === 'background' ? -15 : stroke.layer === 'foreground' ? 12 : 0;
              if (!layerVisibility[stroke.layer]) return null;
              if (stroke.points.length < 2) return null;

              const isDashed = stroke.brushStyle === 'dash';
              const isNeon = stroke.brushStyle === 'neon';
              const isStar = stroke.brushStyle === 'star';

              if (isNeon) {
                return (
                  <group key={stroke.uuid || index}>
                    {/* Glowing outer neon base */}
                    <Line
                      points={stroke.points.map(pt => [pt[0], pt[1], depthZ])}
                      color={stroke.color}
                      lineWidth={stroke.width * 0.9}
                      transparent
                      opacity={0.65}
                    />
                    {/* Crisp core white filament */}
                    <Line
                      points={stroke.points.map(pt => [pt[0], pt[1], depthZ])}
                      color="#FFFFFF"
                      lineWidth={stroke.width * 0.25}
                    />
                  </group>
                );
              }

              if (isStar) {
                return (
                  <Line
                    key={stroke.uuid || index}
                    points={stroke.points.map(pt => [pt[0], pt[1], depthZ])}
                    color={stroke.color}
                    lineWidth={1.2}
                    dashed
                    dashSize={0.15}
                    gapSize={0.45}
                  />
                );
              }

              return (
                <Line
                  key={stroke.uuid || index}
                  points={stroke.points.map(pt => [pt[0], pt[1], depthZ])}
                  color={stroke.color}
                  lineWidth={stroke.width * 0.4}
                  dashed={isDashed}
                  dashSize={isDashed ? 0.35 : 0}
                  gapSize={isDashed ? 0.20 : 0}
                />
              );
            })}

            {/* Render Current Active Live Drawing Line */}
            {isDrawing && drawingTool === 'pencil' && currentStrokePoints.length >= 2 && !isSplitMode && (() => {
              const bType = drawingBrushStyle;
              const isDashed = bType === 'dash';
              const isNeon = bType === 'neon';
              const isStar = bType === 'star';

              if (isNeon) {
                return (
                  <group key="live-active-3d">
                    <Line
                      points={currentStrokePoints.map(pt => [pt[0], pt[1], activeZ])}
                      color={drawingColor}
                      lineWidth={drawingWidth * 0.9}
                      transparent
                      opacity={0.65}
                    />
                    <Line
                      points={currentStrokePoints.map(pt => [pt[0], pt[1], activeZ])}
                      color="#FFFFFF"
                      lineWidth={drawingWidth * 0.25}
                    />
                  </group>
                );
              }

              if (isStar) {
                return (
                  <Line
                    points={currentStrokePoints.map(pt => [pt[0], pt[1], activeZ])}
                    color={drawingColor}
                    lineWidth={1.2}
                    dashed
                    dashSize={0.15}
                    gapSize={0.45}
                  />
                );
              }

              return (
                <Line
                  points={currentStrokePoints.map(pt => [pt[0], pt[1], activeZ])}
                  color={drawingColor}
                  lineWidth={drawingWidth * 0.4}
                  dashed={isDashed}
                  dashSize={isDashed ? 0.35 : 0}
                  gapSize={isDashed ? 0.20 : 0}
                />
              );
            })()}

            {/* Large invisible Click Catcher Plane - Only active when not in 2D split interface */}
            {activeToolMode === 'DRAW' && (drawingTool === 'mesh' || !useLightboardSheet) && (
              <mesh
                position={[0, 0, activeZ]}
                onPointerDown={drawingTool === 'mesh' ? undefined : handlePointerDown}
                onPointerMove={drawingTool === 'mesh' ? handleDrawMove : handlePointerMove}
                onPointerUp={drawingTool === 'mesh' ? undefined : () => handlePointerUp()}
                onPointerOut={() => {
                  setHoverPoint(null);
                  if (drawingTool !== 'mesh') handlePointerUp();
                }}
                onClick={drawingTool === 'mesh' ? handleDrawClick : undefined}
              >
                <planeGeometry args={[120, 120]} />
                <meshBasicMaterial transparent opacity={0.0} depthWrite={false} />
              </mesh>
            )}

            {/* Responsive Hover Brush Ghost Preview */}
            {activeToolMode === 'DRAW' && hoverPoint && (drawingTool === 'mesh' || !useLightboardSheet) && (
              drawingTool === 'pencil' ? (
                <mesh position={hoverPoint}>
                  <ringGeometry args={[drawingWidth * 0.04, drawingWidth * 0.04 + 0.03, 32]} />
                  <meshBasicMaterial color={drawingColor} side={THREE.DoubleSide} transparent opacity={0.8} />
                </mesh>
              ) : drawingTool === 'eraser' ? (
                <mesh position={hoverPoint}>
                  <ringGeometry args={[(drawingWidth * 0.15 + 0.5) - 0.05, drawingWidth * 0.15 + 0.5, 32]} />
                  <meshBasicMaterial color="#EF4444" side={THREE.DoubleSide} transparent opacity={0.8} />
                </mesh>
              ) : (
                <group position={hoverPoint}>
                  <mesh>
                    {selectedBrush.type === 'SPHERE' ? <sphereGeometry args={[0.5, 16, 16]} /> :
                     selectedBrush.type === 'CAPSULE' ? <capsuleGeometry args={[0.3, 0.8, 4, 16]} /> :
                     selectedBrush.type === 'MESH' ? <torusKnotGeometry args={[0.4, 0.12, 32, 8]} /> :
                     <boxGeometry args={[1, 1, 1]} />}
                    <meshBasicMaterial 
                      color={selectedBrush.color} 
                      transparent 
                      opacity={0.5} 
                      wireframe
                    />
                  </mesh>
                  <mesh scale={[1.15, 1.15, 1.15]}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshBasicMaterial color={selectedBrush.color} transparent opacity={0.15} />
                  </mesh>
                </group>
              )
            )}

            {/* Node Transformation Gizmo wrapper (Disabled during active DRAW sessions or locked layers) */}
            {selectedEntity && activeToolMode !== 'SELECT' && activeToolMode !== 'DRAW' && !layerLock[getEntityLayer(selectedEntity.transform.position[2])] && (
              <TransformControls
                ref={transformRef}
                size={0.8}
                mode={
                  activeToolMode === 'TRANSLATE'
                    ? 'translate'
                    : activeToolMode === 'ROTATE'
                    ? 'rotate'
                    : 'scale'
                }
                position={selectedEntity.transform.position}
                onObjectChange={handleTransformEnd}
              />
            )}

            <OrbitControls 
              ref={orbitRef} 
              makeDefault 
              minDistance={2} 
              maxDistance={200}
              onEnd={() => {
                if (orbitRef.current) {
                  const tx = orbitRef.current.target.x;
                  const ty = orbitRef.current.target.y;
                  setCameraFocusSpot([tx, ty]);
                }
              }}
            />
            <MapCameraController mode={cameraMode} />
          </Canvas>



          {/* Mini Layer Key indicator (Hidden in split drafting mode to reduce overlay clutter) */}
          {!isSplitMode && (
            <div className={`absolute bottom-4 right-4 border px-3 py-2 rounded-sm text-[10px] font-mono select-none pointer-events-none flex flex-col gap-1 z-10 shadow-lg transition-colors ${
              theme === 'LIGHT' ? 'bg-white/95 border-[#E5E5EA] text-zinc-700 shadow-sm' : 'bg-[#1A1A1E]/95 border-[#2D2D33] text-[#A0A0AA]'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                <span className={theme === 'LIGHT' ? 'text-zinc-600' : 'text-[#A0A0AA]'}>Background (Z = -15) {!layerVisibility.background && '(MUTED)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                <span className={theme === 'LIGHT' ? 'text-zinc-600' : 'text-[#A0A0AA]'}>Gameplay (Z = 0) {!layerVisibility.gameplay && '(MUTED)'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span className={theme === 'LIGHT' ? 'text-zinc-600' : 'text-[#A0A0AA]'}>Foreground (Z = 12) {!layerVisibility.foreground && '(MUTED)'}</span>
              </div>
            </div>
          )}

          {/* Collapsible Camera Focus Spots Overlay Panel for the Artist Role */}
          {workspace === 'ARTIST' && (
            <div 
              className={`absolute top-4 right-4 ${isSpotsCollapsed ? 'w-44' : 'w-60'} border rounded-md shadow-2xl z-20 flex flex-col font-mono text-[11px] backdrop-blur-[4px] select-none transition-all duration-200 ${
                theme === 'LIGHT' ? 'border-[#E5E5EA] bg-white/95 text-zinc-805 text-zinc-800' : 'border-[#2D2D33] bg-[#141419]/95 text-white'
              }`}
              id="camera-spots-overlay-panel"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Header block */}
              <div 
                className={`flex items-center justify-between px-3 py-2 border-b font-sans font-bold select-none rounded-t-md cursor-pointer transition-colors ${
                  theme === 'LIGHT' ? 'border-[#E5E5EA] bg-[#F2F2F7] text-[#7C3AED]' : 'border-[#2D2D33] bg-[#0E0E12]/95 text-purple-400'
                }`}
                onClick={() => setIsSpotsCollapsed(!isSpotsCollapsed)}
                title="Click to collapse / expand camera spots"
              >
                <div className="flex items-center gap-1.5 uppercase text-[9px] tracking-widest font-extrabold">
                  <Camera className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
                  <span>Viewport Spots</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#7C3AED]/12 font-bold text-[#A855F7]">
                    {cameraSpots.length}
                  </span>
                  <span className="text-zinc-500 hover:text-[#7C3AED] text-[10px]">
                    {isSpotsCollapsed ? '▼' : '▲'}
                  </span>
                </div>
              </div>

              {!isSpotsCollapsed && (
                <>
                  {/* Scrollable locations checklist */}
                  <div className={`p-1.5 space-y-1 max-h-40 overflow-y-auto scrollbar-thin ${
                    theme === 'LIGHT' ? 'bg-white/95' : 'bg-[#141419]/95'
                  }`}>
                    {cameraSpots.length === 0 ? (
                      <p className="text-[9px] text-[#71717A] text-center font-mono py-4">No focus locations set</p>
                    ) : (
                      cameraSpots.map((item, idx) => {
                        const isFocussed = Math.abs((cameraFocusSpot?.[0] ?? 0) - item.spot[0]) < 0.1 && Math.abs((cameraFocusSpot?.[1] ?? 0) - item.spot[1]) < 0.1;
                        return (
                          <div
                            key={item.name || idx}
                            onClick={() => setCameraFocusSpot(item.spot)}
                            className={`group flex items-center justify-between px-2 py-1.5 rounded-[4px] border cursor-pointer transition-all ${
                              isFocussed
                                ? theme === 'LIGHT'
                                  ? 'bg-purple-100 border-purple-300 text-purple-800 font-bold shadow-sm'
                                  : 'bg-purple-950/40 border-purple-800/60 text-purple-300 font-bold shadow-sm'
                                : theme === 'LIGHT'
                                  ? 'bg-transparent border-transparent hover:bg-zinc-100 text-zinc-700'
                                  : 'bg-transparent border-transparent hover:bg-zinc-800/45 hover:border-zinc-805 text-zinc-400 hover:text-white'
                            }`}
                            title={`Jump camera target to [${item.spot[0]}, ${item.spot[1]}]`}
                          >
                            <div className="flex items-center gap-2">
                              <Navigation className={`w-3 h-3 transition-transform duration-200 ${isFocussed ? 'text-purple-400 rotate-45 scale-110' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] truncate leading-none font-sans font-bold">{item.name}</span>
                                <span className="text-[8px] mt-0.5 font-mono opacity-65">
                                  X:{item.spot[0].toFixed(1)} Y:{item.spot[1].toFixed(1)}
                                </span>
                              </div>
                            </div>

                            {/* Interactive remove spot toggle */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCameraSpot(item.name);
                              }}
                              className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 text-zinc-600 hover:text-rose-400 cursor-pointer`}
                              title={`Erase focus area: ${item.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Custom Spots interactive controller */}
                  <div className={`p-2.5 border-t rounded-b-md flex flex-col gap-2 ${
                    theme === 'LIGHT' ? 'bg-[#FAFAF9] border-[#E5E5EA]' : 'bg-[#0E0E12] border-[#2D2D33]'
                  }`}>
                    <div className="flex items-center justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                      <span>Pin New Focus Spot</span>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        <span className="lowercase font-normal text-right">target coordinate center</span>
                      </div>
                    </div>

                    {/* Focus spot coords fields with "Capture" quick trigger */}
                    <div className="flex items-center gap-2">
                      <div className={`flex-1 flex items-center justify-between px-2 py-1 rounded border font-mono text-[8px] leading-tight ${
                        theme === 'LIGHT' ? 'bg-white border-[#E5E5EA] text-[#55555C]' : 'bg-[#18181F] border-zinc-800 text-zinc-400'
                      }`}>
                        <span>Target: X:{cameraFocusSpot?.[0]?.toFixed(1) ?? "0.0"} Y:{cameraFocusSpot?.[1]?.toFixed(1) ?? "0.0"}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewSpotX(cameraFocusSpot?.[0] ?? 0);
                            setNewSpotY(cameraFocusSpot?.[1] ?? 0);
                          }}
                          className="text-purple-400 hover:text-white transition-colors bg-purple-500/10 hover:bg-purple-600 border border-purple-500/20 hover:border-transparent px-1.5 py-0.5 rounded-[3px] font-sans font-bold text-[7.5px] uppercase cursor-pointer"
                          title="Ingest current 3D Editor view target center"
                        >
                          🎯 Capture
                        </button>
                      </div>
                    </div>

                    {/* Handcraft precise numeric overrides */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7.5px] uppercase text-zinc-500 font-bold font-sans">Axis X</span>
                        <input
                          type="number"
                          step="0.5"
                          value={newSpotX}
                          onChange={(e) => setNewSpotX(parseFloat(e.target.value) || 0)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border focus:outline-none transition-colors ${
                            theme === 'LIGHT' 
                              ? 'bg-white border-[#E5E5EA] text-black focus:border-[#7C3AED]' 
                              : 'bg-[#16161C] border-[#222228] text-white focus:border-purple-500'
                          }`}
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7.5px] uppercase text-zinc-500 font-bold font-sans">Axis Y</span>
                        <input
                          type="number"
                          step="0.5"
                          value={newSpotY}
                          onChange={(e) => setNewSpotY(parseFloat(e.target.value) || 0)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border focus:outline-none transition-colors ${
                            theme === 'LIGHT' 
                              ? 'bg-white border-[#E5E5EA] text-black focus:border-[#7C3AED]' 
                              : 'bg-[#16161C] border-[#222228] text-white focus:border-purple-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Interactive Save row */}
                    <div className="flex gap-1.5 mt-0.5">
                      <input
                        type="text"
                        placeholder="Spot name..."
                        value={newSpotName}
                        maxLength={24}
                        onChange={(e) => setNewSpotName(e.target.value)}
                        className={`flex-1 px-2 py-1 rounded text-[9px] font-mono border focus:outline-none transition-all ${
                          theme === 'LIGHT' 
                            ? 'bg-white border-[#E5E5EA] text-black focus:border-[#7C3AED]' 
                            : 'bg-[#16161C] border-[#222228] text-white focus:border-purple-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = newSpotName.trim();
                          if (!trimmed) {
                            return;
                          }
                          addCameraSpot(trimmed, [newSpotX, newSpotY]);
                          setNewSpotName('');
                        }}
                        className="bg-[#7C3AED] hover:bg-[#8B5CF6] text-white text-[9px] font-sans font-bold px-3 py-1 rounded transition-colors cursor-pointer flex items-center justify-center gap-1 tracking-wide"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        )}

        {/* Right Side: High-Precision Layer Drafting Terminal Sheet */}
        {(isSplitMode || isFull2D) && (
          <div className={`${
            isFull2D ? 'w-full h-full' : 'flex-[4] min-w-0 lg:w-0 h-1/2 lg:h-full lg:min-h-0'
          } flex flex-col p-4 overflow-y-auto overflow-x-hidden scrollbar-thin transition-colors ${
            theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#0E0E12] border-[#2D2D33]/60'
          }`}>
            {isFull2D ? (
              /* High-fidelity 2-Column Drafting Studio Workstation */
              <div className="w-full flex-1 flex flex-col lg:flex-row gap-5 min-h-0 pointer-events-auto">
                {/* Left Panel: Big Drawing Board & Header Controls */}
                <div className="flex-1 flex flex-col space-y-3.5 min-w-0">
                  {headerPanel}
                  <div className="flex-1 flex items-center justify-center p-4 bg-black/10 dark:bg-black/40 rounded-lg border border-dashed border-purple-500/20 max-w-5xl w-full mx-auto">
                    <div className="w-full max-w-4xl">
                      {vectorSketchboard}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Isometric Depth stack preview and Layer Controllers */}
                <div className="w-full lg:w-80 lg:shrink-0 flex flex-col space-y-4 overflow-y-auto scrollbar-thin pr-1 justify-start">
                  {depthStackPreview}
                  {layerManagerConsole}
                  {onionSkinningTip}
                </div>
              </div>
            ) : (
              /* Compact Sidebar list for 3D/2D Split mode */
              <div className="w-full h-full flex flex-col space-y-3.5 pointer-events-auto">
                {headerPanel}
                {vectorSketchboard}
                {depthStackPreview}
                {layerManagerConsole}
                {onionSkinningTip}
              </div>
            )}

            {/* Legacy panel details wrapped inside isFalse condition */}
            {false && (
              <div>

            {/* 2. Interactive SVG Vector Canvas */}
            <div className="space-y-1.5 select-none">
              <div className="flex justify-between items-center text-[8.5px] font-mono text-[#71717A]">
                <span className={`uppercase text-[7.5px] tracking-wider font-extrabold ${
                  theme === 'LIGHT' ? 'text-zinc-800' : 'text-gray-300'
                }`}>
                  {canvasAspectRatio} Vector Sketchboard
                </span>
                {hoverCoords ? (
                  <span className="text-purple-400 font-semibold">
                    X: <span className="font-extrabold text-[#9562FF]">{hoverCoords[0]}</span> | Y: <span className="font-extrabold text-[#9562FF]">{hoverCoords[1]}</span>
                  </span>
                ) : (
                  <span>Hover grid to show coordinates</span>
                )}
              </div>

              {(() => {
                const is43 = canvasAspectRatio === '4:3';
                const playWidth = is43 ? 24 : 32;
                const halfWidth = playWidth / 2;
                return (
                  <div 
                    className={`relative ${
                      is43 ? 'aspect-[4/3]' : 'aspect-video'
                    } w-full rounded-md shadow-2xl overflow-hidden cursor-crosshair group flex items-center justify-center transition-all ${
                      theme === 'LIGHT' 
                        ? 'bg-[#FAFAF9] border border-purple-500/35 shadow-purple-900/5' 
                        : 'bg-[#08080A] border border-purple-500/25 hover:border-purple-500/40'
                    }`}
                    onPointerDown={handleOverlayPointerDown}
                    onPointerMove={handleOverlayPointerMove}
                    onPointerUp={handleOverlayPointerUp}
                    onPointerLeave={handleOverlayPointerLeave}
                  >
                    {/* Background grid indicators */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.14] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:16px_16px]" />
                    <div className="absolute inset-0 pointer-events-none opacity-[0.25] bg-[linear-gradient(to_right,#7C3AED_1.5px,transparent_1.5px),linear-gradient(to_bottom,#7C3AED_1.5px,transparent_1.5px)] bg-[size:64px_64px]" />

                    {/* Grid guidelines metrics indicator */}
                    <span className={`absolute bottom-1.5 right-2 pointer-events-none text-[7px] font-mono select-none uppercase font-bold text-right leading-tight ${
                      theme === 'LIGHT' ? 'text-zinc-500 font-medium' : 'text-gray-600'
                    }`}>
                      Playfield Limits<br />X: [{-halfWidth}, {halfWidth}] | Y: [-9, 9]
                    </span>

                    <span className="absolute top-1.5 right-2 pointer-events-none text-[8.5px] font-mono text-purple-400/95 font-bold tracking-wider select-none uppercase">
                      ✏️ {activeDrawingLayer.toUpperCase()} PLANE
                    </span>

                    {/* SVG Render Layer */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none select-none">
                      <defs>
                        <filter id="charcoal-filter-overlay" x="-20%" y="-20%" width="140%" height="140%">
                          <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="3" result="rough" />
                          <feDisplacementMap in="SourceGraphic" in2="rough" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
                        </filter>
                        <filter id="neon-glow-overlay" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="3.5" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Render existing strokes in system */}
                      {drawingStrokes.map((stroke, index) => {
                        const isCurrentLayer = stroke.layer === activeDrawingLayer;
                        if (isolateDrawingLayer && !isCurrentLayer) return null;

                        const pointsPath = stroke.points.map(pt => {
                          const px = ((pt[0] + halfWidth) / playWidth) * 100;
                          const py = (1 - (pt[1] + 9) / 18) * 100;
                          return `${px}% ${py}%`;
                        });
                        if (pointsPath.length < 2) return null;

                        const strokeOp = isCurrentLayer ? 0.95 : 0.15;
                        const bType = stroke.brushStyle || 'solid';
                        const dString = `M ${pointsPath.join(' L ')}`;

                        if (bType === 'neon') {
                          return (
                            <g key={stroke.uuid || index} opacity={strokeOp}>
                              <path
                                d={dString}
                                fill="none"
                                stroke={stroke.color}
                                strokeWidth={stroke.width * 3.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#neon-glow-overlay)"
                                opacity={0.65}
                              />
                              <path
                                d={dString}
                                fill="none"
                                stroke="#FFFFFF"
                                strokeWidth={stroke.width * 0.9}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={0.95}
                              />
                            </g>
                          );
                        }

                        if (bType === 'calligraphy') {
                          return (
                            <g key={stroke.uuid || index} opacity={strokeOp}>
                              <path
                                d={dString}
                                fill="none"
                                stroke={stroke.color}
                                strokeWidth={stroke.width * 1.5}
                                strokeLinecap="square"
                                strokeLinejoin="miter"
                                style={{ transform: 'translate(-0.12%, 0.1%)' }}
                              />
                              <path
                                d={dString}
                                fill="none"
                                stroke={stroke.color}
                                strokeWidth={stroke.width * 1.1}
                                strokeLinecap="square"
                                strokeLinejoin="miter"
                                style={{ transform: 'translate(0.12%, -0.1%)' }}
                                opacity={0.8}
                              />
                            </g>
                          );
                        }

                        if (bType === 'charcoal') {
                          return (
                            <path
                              key={stroke.uuid || index}
                              d={dString}
                              fill="none"
                              stroke={stroke.color}
                              strokeWidth={stroke.width * 2.1}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              filter="url(#charcoal-filter-overlay)"
                              opacity={strokeOp * 0.85}
                            />
                          );
                        }

                        if (bType === 'dash') {
                          return (
                            <path
                              key={stroke.uuid || index}
                              d={dString}
                              fill="none"
                              stroke={stroke.color}
                              strokeWidth={stroke.width * 1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray="6 5"
                              opacity={strokeOp}
                            />
                          );
                        }

                        if (bType === 'star') {
                          const stars: React.ReactNode[] = [];
                          stroke.points.forEach((pt, pIdx) => {
                            if (pIdx % 3 === 0 || pIdx === stroke.points.length - 1) {
                              const px = ((pt[0] + halfWidth) / playWidth) * 100;
                              const py = (1 - (pt[1] + 9) / 18) * 100;
                              const sizeX = (stroke.width * 0.25) + 0.6;
                              const sizeY = (stroke.width * 0.45) + 1.1;
                              const ptsAttr = `${px}%,${py - sizeY}% ${px + sizeX}%,${py}% ${px}%,${py + sizeY}% ${px - sizeX}%,${py}%`;
                              stars.push(
                                <polygon
                                  key={`star-overlay-${pIdx}`}
                                  points={ptsAttr}
                                  fill={stroke.color}
                                  opacity={strokeOp * 0.9}
                                />
                              );
                            }
                          });
                          return (
                            <g key={stroke.uuid || index}>
                              <path
                                d={dString}
                                fill="none"
                                stroke={stroke.color}
                                strokeWidth={1.0}
                                strokeDasharray="2 6"
                                opacity={strokeOp * 0.4}
                                strokeLinecap="round"
                              />
                              {stars}
                            </g>
                          );
                        }

                        return (
                          <path
                            key={stroke.uuid || index}
                            d={dString}
                            fill="none"
                            stroke={stroke.color}
                            strokeWidth={stroke.width * 1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={strokeOp}
                          />
                        );
                      })}

                      {/* Render current active drawing line */}
                      {isDrawing && currentStrokePoints.length >= 2 && (() => {
                        const pointsPath = currentStrokePoints.map(pt => {
                          const px = ((pt[0] + halfWidth) / playWidth) * 100;
                          const py = (1 - (pt[1] + 9) / 18) * 100;
                          return `${px}% ${py}%`;
                        });
                        const bType = drawingBrushStyle;
                        const dString = `M ${pointsPath.join(' L ')}`;

                        if (bType === 'neon') {
                          return (
                            <g key="live-active-overlay">
                              <path
                                d={dString}
                                fill="none"
                                stroke={drawingColor}
                                strokeWidth={drawingWidth * 3.5}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#neon-glow-overlay)"
                                opacity={0.65}
                              />
                              <path
                                d={dString}
                                fill="none"
                                stroke="#FFFFFF"
                                strokeWidth={drawingWidth * 0.9}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity={0.95}
                              />
                            </g>
                          );
                        }

                        if (bType === 'calligraphy') {
                          return (
                            <g key="live-active-overlay">
                              <path
                                d={dString}
                                fill="none"
                                stroke={drawingColor}
                                strokeWidth={drawingWidth * 1.5}
                                strokeLinecap="square"
                                strokeLinejoin="miter"
                                style={{ transform: 'translate(-0.12%, 0.1%)' }}
                              />
                              <path
                                d={dString}
                                fill="none"
                                stroke={drawingColor}
                                strokeWidth={drawingWidth * 1.1}
                                strokeLinecap="square"
                                strokeLinejoin="miter"
                                style={{ transform: 'translate(0.12%, -0.1%)' }}
                                opacity={0.8}
                              />
                            </g>
                          );
                        }

                        if (bType === 'charcoal') {
                          return (
                            <path
                              key="live-active-overlay"
                              d={dString}
                              fill="none"
                              stroke={drawingColor}
                              strokeWidth={drawingWidth * 2.1}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              filter="url(#charcoal-filter-overlay)"
                              opacity={0.8}
                            />
                          );
                        }

                        if (bType === 'dash') {
                          return (
                            <path
                              key="live-active-overlay"
                              d={dString}
                              fill="none"
                              stroke={drawingColor}
                              strokeWidth={drawingWidth * 1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray="6 5"
                            />
                          );
                        }

                        if (bType === 'star') {
                          const stars: React.ReactNode[] = [];
                          currentStrokePoints.forEach((pt, pIdx) => {
                            if (pIdx % 3 === 0 || pIdx === currentStrokePoints.length - 1) {
                              const px = ((pt[0] + halfWidth) / playWidth) * 100;
                              const py = (1 - (pt[1] + 9) / 18) * 100;
                              const sizeX = (drawingWidth * 0.25) + 0.6;
                              const sizeY = (drawingWidth * 0.45) + 1.1;
                              const ptsAttr = `${px}%,${py - sizeY}% ${px + sizeX}%,${py}% ${px}%,${py + sizeY}% ${px - sizeX}%,${py}%`;
                              stars.push(
                                <polygon
                                  key={`star-live-overlay-${pIdx}`}
                                  points={ptsAttr}
                                  fill={drawingColor}
                                  opacity={0.95}
                                />
                              );
                            }
                          });
                          return (
                            <g key="live-active-overlay">
                              <path
                                d={dString}
                                fill="none"
                                stroke={drawingColor}
                                strokeWidth={1.0}
                                strokeDasharray="2 6"
                                opacity={0.4}
                                strokeLinecap="round"
                              />
                              {stars}
                            </g>
                          );
                        }

                        return (
                          <path
                            key="live-active-overlay"
                            d={dString}
                            fill="none"
                            stroke={drawingColor}
                            strokeWidth={drawingWidth * 1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        );
                      })()}
                    </svg>
                  </div>
                );
              })()}
                 {/* 3. Interactive Exploded Isometric Layer Stack */}
            <div className={`rounded border p-3 shadow-md flex flex-col gap-2 shrink-0 transition-colors ${
              theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141419] border-[#2D2D33]/60'
            }`}>
              <div className={`flex justify-between items-center border-b pb-1.5 font-mono text-[9px] transition-colors ${
                theme === 'LIGHT' ? 'border-[#E5E5EA] text-zinc-650' : 'border-[#2D2D33]/40 text-[#A0A0AA]'
              }`}>
                <span className="uppercase text-[8px] tracking-wide font-extrabold flex items-center gap-1.5 text-purple-400">
                  <Layers className="w-3.5 h-3.5 animate-pulse" />
                  <span>Visual Depth Stack Preview</span>
                </span>
                <span className={`text-[7.5px] italic ${
                  theme === 'LIGHT' ? 'text-zinc-450 text-zinc-500' : 'text-[#71717A]'
                }`}>Tactile layout view (click sheets)</span>
              </div>
              
              <div className={`relative h-28 w-full flex items-center justify-center overflow-hidden border rounded-sm transition-colors ${
                theme === 'LIGHT' ? 'bg-[#FAFAF9] border-[#D1D1D6]' : 'bg-[#070709] border-[#212126]'
              }`}>
                <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#808080_1px,transparent_1px)] [background-size:12px_12px]" />
                
                {/* Exploded stack container with CSS 3D Transforms */}
                <div 
                  className="relative w-40 h-20 select-none pointer-events-auto cursor-default"
                  style={{
                    transform: 'perspective(500px) rotateX(55deg) rotateZ(-35deg)',
                    transformStyle: 'preserve-3d'
                  }}
                >
                  {[
                    { id: 'foreground', zOffset: 20, color: '#10B981', label: 'FG (Overlay)', dotBg: 'bg-[#10B981]' },
                    { id: 'gameplay', zOffset: 0, color: '#7C3AED', label: 'GP (Gameplay)', dotBg: 'bg-[#7C3AED]' },
                    { id: 'background', zOffset: -20, color: '#EF4444', label: 'BG (Canvas)', dotBg: 'bg-[#EF4444]' }
                  ].map((ly) => {
                    const isActive = activeDrawingLayer === ly.id;
                    const isVisible = layerVisibility[ly.id as 'background'|'gameplay'|'foreground'];
                    const isLocked = layerLock[ly.id as 'background'|'gameplay'|'foreground'];
                    const strokes = drawingStrokes.filter(s => s.layer === ly.id);
                    const is43 = canvasAspectRatio === '4:3';
                    const playWidth = is43 ? 24 : 32;
                    const halfWidth = playWidth / 2;
                    
                    return (
                      <div
                        key={ly.id}
                        onClick={() => useSpatialEditorStore.getState().setActiveDrawingLayer(ly.id as any)}
                        className={`absolute inset-0 rounded border cursor-pointer select-none transition-all duration-300 flex items-center justify-center ${
                          isActive 
                            ? theme === 'LIGHT'
                              ? 'bg-purple-100/70 border-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.25)] z-20'
                              : 'bg-[#7C3AED]/12 border-purple-500 shadow-[0_0_12px_rgba(124,58,237,0.3)] z-20' 
                            : theme === 'LIGHT'
                              ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 opacity-80 z-10'
                              : 'bg-black/50 hover:bg-[#1E1E24]/20 border-white/5 opacity-70 z-10'
                        }`}
                        style={{
                          transform: `translate3d(0px, 0px, ${isActive ? ly.zOffset + 6 : ly.zOffset}px)`,
                          transformStyle: 'preserve-3d',
                          boxShadow: isActive ? '0px 0px 15px rgba(124, 58, 237, 0.2)' : 'none'
                        }}
                        title={`Select layer: ${ly.label}`}
                      >
                        {/* Outline highlight if active */}
                        {isActive && (
                          <div className="absolute inset-0 rounded border border-dashed border-purple-400/40 animate-pulse pointer-events-none" />
                        )}
                        
                        {/* Layer schematic title tag */}
                        <div 
                          className="absolute top-1 left-2 font-mono text-[7px] font-bold uppercase select-none tracking-tight transition-colors flex items-center gap-1"
                          style={{
                            transform: 'rotateX(-20deg) rotateY(10deg)', // Face slightly back to match perspective
                            backfaceVisibility: 'hidden',
                            color: ly.color
                          }}
                        >
                          <span className={`w-1 h-1 rounded-full ${ly.dotBg}`} />
                          <span>{ly.label}</span>
                          {isLocked && <Lock className="w-2 h-2 text-red-500" />}
                          {!isVisible && <EyeOff className="w-2 h-2 text-[#71717A]" />}
                        </div>
                        
                        {/* Mini SVG path representation of the doodles inside the layer */}
                        {isVisible && (
                          <svg className="w-full h-full p-2 pointer-events-none select-none opacity-80 animate-fade-in" viewBox={`0 0 ${playWidth} 18`}>
                            {strokes.map((stroke, sIdx) => {
                              const pts = stroke.points;
                              if (pts.length < 2) return null;
                              const dPath = `M ${pts.map(p => `${((p[0] + halfWidth) / playWidth) * playWidth} ${(1 - (p[1] + 9) / 18) * 18}`).join(' L ')}`;
                              return (
                                <path
                                  key={stroke.uuid || sIdx}
                                  d={dPath}
                                  fill="none"
                                  stroke={stroke.color}
                                  strokeWidth={1.5}
                                  strokeLinecap="round"
                                />
                              );
                            })}
                          </svg>
                        )}
                        
                        {/* Show stroke count in the corner */}
                        <span className="absolute bottom-1 right-2 text-[6px] font-mono font-bold select-none leading-none text-gray-500">
                          {strokes.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>         </div>

            {/* 4. Outside Layer Manager Console Deck */}
            <div className={`rounded border p-3.5 space-y-3 shadow-md transition-colors ${
              theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141419] border-[#2D2D33]/60'
            }`}>
              <div className={`flex items-center justify-between border-b pb-2 ${
                theme === 'LIGHT' ? 'border-[#E5E5EA]' : 'border-[#2D2D33]/50'
              }`}>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Drafting Layers</span>
                </span>

                <button
                  type="button"
                  onClick={() => setIsolateDrawingLayer(prev => !prev)}
                  className={`text-[8.5px] font-mono px-2 py-0.5 rounded border transition cursor-pointer flex items-center gap-1.5 ${
                    isolateDrawingLayer 
                      ? 'bg-[#7C3AED]/20 border-purple-500 text-purple-700 dark:text-purple-300 font-extrabold' 
                      : theme === 'LIGHT'
                        ? 'bg-zinc-100 border-zinc-200 text-zinc-650 hover:bg-zinc-200 hover:text-zinc-900'
                        : 'bg-[#1C1C24] border-transparent text-[#71717A] hover:bg-[#25252E] hover:text-white'
                  }`}
                  title="Make other layers completely invisible in 2D drafting sheet"
                >
                  <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
                  <span>{isolateDrawingLayer ? 'Layer Isolated' : 'Onion Skinning (On)'}</span>
                </button>
              </div>

              {/* Layer details list */}
              <div className="space-y-1.5">
                {[
                  { id: 'foreground', name: 'Foreground Layer', z: 12, dotBg: 'bg-[#10B981]' },
                  { id: 'gameplay', name: 'Gameplay Center', z: 0, dotBg: 'bg-[#7C3AED]' },
                  { id: 'background', name: 'Background Canvas', z: -15, dotBg: 'bg-[#EF4444]' }
                ].map(ly => {
                  const isActive = activeDrawingLayer === ly.id;
                  const isVisible = layerVisibility[ly.id as 'background'|'gameplay'|'foreground'];
                  const isLocked = layerLock[ly.id as 'background'|'gameplay'|'foreground'];
                  const count = drawingStrokes.filter(s => s.layer === ly.id).length;

                  return (
                    <div 
                      key={ly.id}
                      className={`flex items-center justify-between p-2 rounded border transition ${
                        isActive 
                          ? theme === 'LIGHT'
                            ? 'bg-purple-50 border-purple-300 text-purple-900'
                            : 'bg-[#7C3AED]/12 border-purple-500/50 text-white' 
                          : theme === 'LIGHT'
                            ? 'bg-[#F2F2F7] border-transparent text-zinc-700 hover:bg-[#E5E5EA]'
                            : 'bg-[#191921] border-transparent text-[#A0A0AA] hover:bg-[#20202A]'
                      }`}
                    >
                      {/* Select Layer clicker */}
                      <button
                        type="button"
                        onClick={() => {
                          useSpatialEditorStore.getState().setActiveDrawingLayer(ly.id as any);
                        }}
                        className="flex-1 flex items-center gap-2 text-left cursor-pointer select-none"
                      >
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition ${
                          isActive 
                            ? theme === 'LIGHT' ? 'border-purple-500 bg-white' : 'border-purple-400 bg-purple-950/40 text-purple-300' 
                            : 'border-gray-700 bg-black/40'
                        }`}>
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />}
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[10px] font-mono font-bold leading-none flex items-center gap-1.5 ${
                            isActive 
                              ? theme === 'LIGHT' ? 'text-purple-800' : 'text-purple-300'
                              : theme === 'LIGHT' ? 'text-zinc-800' : 'text-[#A0A0AA]'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ly.dotBg}`} />
                            {ly.name}
                          </span>
                          <span className="text-[8px] font-mono text-gray-500 font-semibold">depth: Z = {ly.z} ({count} strokes)</span>
                        </div>
                      </button>

                      {/* Display toggle triggers */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            useSpatialEditorStore.getState().setLayerVisibility(ly.id as any, !isVisible);
                          }}
                          className={`p-1 rounded cursor-pointer transition ${
                            isVisible 
                              ? 'text-purple-500 hover:text-purple-700' 
                              : 'text-zinc-400 hover:text-zinc-650 bg-black/10 dark:bg-black/20'
                          }`}
                          title={isVisible ? 'Visible on Canvas' : 'Hidden on Canvas'}
                        >
                          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            useSpatialEditorStore.getState().setLayerLock(ly.id as any, !isLocked);
                          }}
                          className={`p-1 rounded cursor-pointer transition ${
                            isLocked 
                              ? 'text-amber-500 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/20' 
                              : 'text-zinc-400 hover:text-zinc-650'
                          }`}
                          title={isLocked ? 'Locked (Protected)' : 'Unlocked (Editable)'}
                        >
                          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Undo and Flush Actions */}
              <div className={`grid grid-cols-2 gap-1.5 pt-1.5 border-t ${
                theme === 'LIGHT' ? 'border-[#E5E5EA]' : 'border-[#2D2D33]/50'
              }`}>
                <button
                  type="button"
                  onClick={handleUndoLastStroke}
                  disabled={drawingStrokes.filter(s => s.layer === activeDrawingLayer).length === 0}
                  className={`py-1 px-2.5 rounded text-[9px] uppercase font-mono font-bold tracking-tight border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition flex items-center justify-center gap-1 ${
                    theme === 'LIGHT'
                      ? 'bg-white border-[#D1D1D6] text-zinc-700 hover:bg-zinc-100'
                      : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-gray-350'
                  }`}
                  title="Undo last pencil line on this active layer"
                >
                  <Undo className="w-3.5 h-3.5" />
                  <span>Undo Line</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearLayer}
                  disabled={drawingStrokes.filter(s => s.layer === activeDrawingLayer).length === 0}
                  className={`py-1 px-2 rounded text-[9px] uppercase font-mono font-bold tracking-tight border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1 transition ${
                    theme === 'LIGHT'
                      ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                      : 'bg-[#991b1b]/20 border-[#991b1b]/30 text-rose-300 hover:bg-[#991b1b]/30'
                  }`}
                  title="Clear all drawings on this active layer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Layer</span>
                </button>
              </div>
            </div>

            {/* Onion Skinning Explanation block */}
            <div className={`border p-2.5 rounded text-[8.5px] font-mono leading-relaxed flex items-start gap-1.5 transition-colors ${
              theme === 'LIGHT' ? 'bg-zinc-50 border-[#D1D1D6] text-zinc-605 text-zinc-600' : 'bg-[#101014] border-[#2D2D33]/40 text-[#71717A]'
            }`}>
              <span>💡</span>
              <p>
                <strong className={theme === 'LIGHT' ? 'text-zinc-850 text-zinc-900 font-bold' : 'text-gray-400 font-bold'}>Onion Skinning</strong> renders other layer depths faint-colored in the background so you can reference gameplay components. Toggle "Layer Isolated" to sketch on a completely blank canvas.
              </p>
            </div>

              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
