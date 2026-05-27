/**
 * @file src/App.tsx
 * @description Master IDE Viewport Container.
 * Manages Workspace state, Global Tool Hotkeys, Native File System I/O bindings, 
 * and controls the lifecycle bounds of the SpatialCreativeCanvas vs the SimulationOverlay.
 */

import React, { useState, useEffect } from 'react';
import { useSpatialEditorStore } from './app/store';
import HierarchyPanel from './components/HierarchyPanel';
import InspectorPanel from './components/InspectorPanel';
import BehaviorTreePanel from './components/BehaviorTreePanel';
import AssetLibraryPanel from './components/AssetLibraryPanel';
import SpatialCreativeCanvas from './editor/SpatialCreativeCanvas';
import TimelineSeqEditor from './components/TimelineSeqEditor';
import MetronomeTerminal from './components/MetronomeTerminal';
import SimulationOverlay from './components/SimulationOverlay';
import EventBus from './engine/protocol/EventBus';
import SimulationCore from './engine/SimulationCore';
import { VeilProjectManifest } from './types';
import {
  Play, Square, Cpu, Camera, Layers, Save, FolderOpen,
  MousePointer, Move, RotateCw, Maximize2, Palette, Sun, Moon,
  Paintbrush, Frame, Pin, Download, Upload, GitBranch, Package
} from 'lucide-react';

export default function App() {
  const {
    entities,
    selectedUuid,
    activeToolMode,
    activeViewportCamera,
    cameraZoom,
    isCompiling,
    projectPath,
    triggerCompile,
    setSelectedUuid,
    setToolMode,
    setViewportCamera,
    updateEntityTransform,
    loadProjectManifest,
    setProjectPath,
    showGuideFrame,
    cameraFocusZLocked,
    setShowGuideFrame,
    setCameraFocusZLocked,
    canvasAspectRatio,
    setCanvasAspectRatio
  } = useSpatialEditorStore();

  const [activeWorkspace, setActiveWorkspace] = useState<'ARTIST' | 'DEVELOPER'>('ARTIST');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isBehaviorTreePanelOpen, setIsBehaviorTreePanelOpen] = useState(false);
  const [isAssetLibraryPanelOpen, setIsAssetLibraryPanelOpen] = useState(false);

  const [theme, setTheme] = useState<'DARK' | 'LIGHT'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('veil_editor_theme');
      if (saved === 'LIGHT' || saved === 'DARK') return saved;
    }
    return 'DARK';
  });

  useEffect(() => {
    localStorage.setItem('veil_editor_theme', theme);
  }, [theme]);
  
  const [compiledManifest, setCompiledManifest] = useState<VeilProjectManifest | null>(null);
  
  // Custom camera trajectory coordinates (Bezier Spline Control Points)
  const [cameraTrajectory] = useState<[number, number, number][]>([
    [0, 10, 25],
    [8, 12, 10],
    [-8, 6, -10]
  ]);

  // =========================================================
  // GLOBAL HOTKEY ISOLATION MATRIX
  // =========================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent mapping intercepts when inside focus input blocks
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement || document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      // Global shortcuts (work even during simulation)
      const key = e.key.toLowerCase();
      
      // Ctrl+Shift+T: Toggle Behavior Tree Panel
      if (e.ctrlKey && e.shiftKey && key === 't') {
        e.preventDefault();
        setIsBehaviorTreePanelOpen(!isBehaviorTreePanelOpen);
        return;
      }
      
      // Ctrl+Shift+A: Toggle Asset Library Panel
      if (e.ctrlKey && e.shiftKey && key === 'a') {
        e.preventDefault();
        setIsAssetLibraryPanelOpen(!isAssetLibraryPanelOpen);
        return;
      }

      // If the simulation is running, strictly disable editor hotkeys to prevent WASD conflicts
      if (isSimulating) {
        if (e.key === 'Escape') {
          handleStopSimulation();
        }
        return;
      }

      if (key === 'q') setToolMode('SELECT');
      else if (key === 'w') setToolMode('TRANSLATE');
      else if (key === 'e') setToolMode('ROTATE');
      else if (key === 'r') setToolMode('SCALE');
      else if (key === 'Escape') setSelectedUuid(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSimulating, setToolMode, setSelectedUuid, isBehaviorTreePanelOpen, isAssetLibraryPanelOpen]);

  // Listen to simulation status events from core
  useEffect(() => {
    const handleStarted = () => setIsSimulating(true);
    const handleStopped = () => setIsSimulating(false);

    EventBus.on('SIMULATION_STARTED', handleStarted);
    EventBus.on('SIMULATION_STOPPED', handleStopped);

    return () => {
      EventBus.off('SIMULATION_STARTED', handleStarted);
      EventBus.off('SIMULATION_STOPPED', handleStopped);
    };
  }, []);

  const handleCompileAndPlay = async () => {
    EventBus.emit('EXECUTE_EVENT', {
      type: 'STAGE_ACTION',
      action: 'COMPILE_BOOT_TRIGGERED',
      payload: { path: projectPath }
    });

    // Compile 3D coordinates layout down to 2D layered structure via BakeProcessor
    const manifest = await triggerCompile();
    setCompiledManifest(manifest);

    // Boot the 60Hz metronome simulation
    SimulationCore.start(manifest);
  };

  const handleStopSimulation = () => {
    SimulationCore.stop();
  };

  const handleSimulationToggle = () => {
    if (isSimulating) {
      handleStopSimulation();
    } else {
      handleCompileAndPlay();
    }
  };

  // =========================================================
  // NATIVE DESKTOP FS INTEGRATION (Tauri / Chrome API)
  // =========================================================
  
  const handleSaveProject = async () => {
    const state = useSpatialEditorStore.getState();
    const projectData = {
      version: "Veil-Studio-1.0",
      environment: state.environment,
      entities: state.entities,
      sortingLayers: state.sortingLayers,
      timelineEvents: state.timelineEvents,
      drawingStrokes: state.drawingStrokes
    };

    const jsonStr = JSON.stringify(projectData, null, 2);

    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: projectPath || 'my_scene.veil',
          types: [{ description: 'Veil Engine Project', accept: { 'application/json': ['.veil', '.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        
        setProjectPath(handle.name);
      } else {
        // Fallback for isolated web environments
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = projectPath || 'my_scene.veil';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      EventBus.emit('EXECUTE_EVENT', {
        type: 'SYSTEM_FS',
        action: 'PROJECT_SAVE_SUCCESS',
        payload: { sizeBytes: jsonStr.length }
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save project:', err);
      }
    }
  };

  const handleRestoreProject = async () => {
    if (isSimulating) handleStopSimulation();

    try {
      if ('showOpenFilePicker' in window) {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'Veil Engine Project', accept: { 'application/json': ['.veil', '.json'] } }]
        });
        const file = await handle.getFile();
        const text = await file.text();
        const parsed = JSON.parse(text);
        
        loadProjectManifest(parsed);
        setProjectPath(handle.name);

        EventBus.emit('EXECUTE_EVENT', {
          type: 'SYSTEM_FS',
          action: 'PROJECT_LOAD_SUCCESS',
          payload: { filename: handle.name }
        });
      } else {
        // Fallback file input trigger for isolated web
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.veil,.json';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              const parsed = JSON.parse(ev.target?.result as string);
              loadProjectManifest(parsed);
              setProjectPath(file.name);
            } catch (err) {
              alert('Failed to parse Veil Project file.');
            }
          };
          reader.readAsText(file);
        };
        input.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load project:', err);
      }
    }
  };

  const handleExportScene = async () => {
    try {
      const manifest = await triggerCompile();
      const jsonStr = JSON.stringify(manifest, null, 2);
      
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `veil_manifest_${Date.now()}.json`,
          types: [{ description: 'Veil Compiled Manifest', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `veil_manifest_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      EventBus.emit('EXECUTE_EVENT', {
        type: 'SYSTEM_FS',
        action: 'EXPORT_SUCCESS',
        payload: { sizeBytes: jsonStr.length }
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Exporting manifest failed:', err);
        EventBus.emit('EXECUTE_EVENT', {
          type: 'SYSTEM_FS',
          action: 'EXPORT_FAILED',
          payload: { error: err.message || 'Failure during active compilation export.' }
        });
      }
    }
  };

  const handleImportSceneFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        loadProjectManifest(parsed);
        EventBus.emit('EXECUTE_EVENT', {
          type: 'SYSTEM_FS',
          action: 'LOAD_SUCCESS',
          payload: { filename: file.name }
        });
      } catch (err: any) {
        alert('Could not parse the selected JSON workspace file. Please make sure it is a valid VeilProjectManifest file.');
        EventBus.emit('EXECUTE_EVENT', {
          type: 'SYSTEM_FS',
          action: 'LOAD_FAILED',
          payload: { error: 'Invalid JSON manifest parsing signature.' }
        });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset target
  };

  return (
    <div className={`w-screen h-screen flex flex-col font-sans overflow-hidden select-none transition-colors duration-200 ${
      theme === 'LIGHT' ? 'bg-[#F2F2F7] text-[#1C1C1E]' : 'bg-[#0F0F12] text-[#E0E0E6]'
    }`} id="veil-engine-studio-ide">
      
      {/* 1. TOP CONTROL BAR */}
      <header className={`h-9 flex items-center justify-between px-3 shrink-0 shadow-sm transition-colors z-50 ${
        theme === 'LIGHT' ? 'bg-[#E5E5EA] border-b border-[#D1D1D6]' : 'bg-[#1A1A1E] border-b border-[#2D2D33]'
      }`}>
        
        {/* Project Name and Paths */}
        <div className="flex items-center gap-2 select-none">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
            theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
          }`}>
            <Cpu className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
              theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-[#E0E0E6]'
            }`}>VEIL ENGINE</span>
          </div>
          <div className={`h-4 w-[1px] ${theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#2D2D33]'}`} />
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className={`${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'} font-semibold`}>{projectPath || 'untitled.veil'}</span>
            <span className={`${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>&gt;</span>
            <span className="text-[#7C3AED] font-bold">scene_layout_3d</span>
          </div>
        </div>

        {/* Workspace Controller Role decoupled viewswitcher tabs */}
        <div className={`flex items-center border rounded overflow-hidden p-0.5 transition-colors ${
          theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
        }`} id="workspace-switching-tabs">
          <button
            onClick={() => setActiveWorkspace('ARTIST')}
            className={`px-3 py-0.5 flex items-center gap-1 text-[10px] font-sans font-bold transition rounded-sm cursor-pointer ${
              activeWorkspace === 'ARTIST' 
                ? 'bg-[#7C3AED] text-white shadow-sm' 
                : theme === 'LIGHT' 
                  ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]' 
                  : 'text-[#A0A0AA] hover:text-[#E0E0E6] hover:bg-[#252529]'
            }`}
          >
            <Palette className="w-3 h-3 text-purple-400" />
            <span>Artist</span>
          </button>
          <button
            onClick={() => {
              setActiveWorkspace('DEVELOPER');
              if (activeToolMode === 'DRAW') {
                setToolMode('SELECT');
              }
            }}
            className={`px-3 py-0.5 flex items-center gap-1 text-[10px] font-sans font-bold transition rounded-sm cursor-pointer ${
              activeWorkspace === 'DEVELOPER' 
                ? 'bg-[#7C3AED] text-white shadow-sm' 
                : theme === 'LIGHT' 
                  ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]' 
                  : 'text-[#A0A0AA] hover:text-[#E0E0E6] hover:bg-[#252529]'
            }`}
          >
            <Cpu className="w-3 h-3 text-emerald-500" />
            <span>Developer</span>
          </button>
        </div>

        {/* Core Editor Gizmos Toggles Menu (Disabled during simulation) */}
        <div className={`flex items-center border rounded overflow-hidden p-0.5 transition-colors ${
          theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
        } ${isSimulating ? 'opacity-40 pointer-events-none' : ''}`} id="gizmo-mode-toggles-menu" title="Hotkeys: Q, W, E, R">
          {(['SELECT', 'TRANSLATE', 'ROTATE', 'SCALE', 'DRAW'] as const)
            .filter((mode) => mode !== 'DRAW' || activeWorkspace === 'ARTIST')
            .map((mode) => {
              const label = mode === 'SELECT' ? 'Q' : mode === 'TRANSLATE' ? 'W' : mode === 'ROTATE' ? 'E' : mode === 'SCALE' ? 'R' : 'Paint';
              const IconComponent = mode === 'SELECT' ? MousePointer : mode === 'TRANSLATE' ? Move : mode === 'ROTATE' ? RotateCw : mode === 'SCALE' ? Maximize2 : Paintbrush;
              return (
                <button
                  key={mode}
                  onClick={() => setToolMode(mode)}
                  className={`px-2 py-0.5 flex items-center gap-1 text-[10px] font-mono font-semibold transition rounded-sm cursor-pointer ${
                    activeToolMode === mode 
                      ? 'bg-[#7C3AED] text-white shadow-sm font-bold' 
                      : theme === 'LIGHT' 
                        ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]' 
                        : 'text-[#A0A0AA] hover:text-white hover:bg-[#252529]'
                  }`}
                  title={`${mode} Mode`}
                >
                  <IconComponent className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              );
            })}
        </div>

        {/* View Camera Controllers & Simulated operations */}
        <div className="flex items-center gap-1.5 md:gap-3">
          
          {/* Theme Switcher Button (Comfort/Midnight) */}
          <button
            onClick={() => setTheme(prev => prev === 'DARK' ? 'LIGHT' : 'DARK')}
            className={`p-1 rounded border transition cursor-pointer ${
              theme === 'LIGHT' 
                ? 'bg-white border-[#D1D1D6] text-[#FF9500] hover:bg-[#F2F2F7]' 
                : 'bg-[#141417] border-[#2D2D33] text-amber-300 hover:bg-[#252529]'
            }`}
            title={theme === 'LIGHT' ? 'Switch to Midnight View' : 'Switch to Comfortable Light View'}
          >
            {theme === 'LIGHT' ? <Moon className="w-3.5 h-3.5 fill-[#FF9500]" /> : <Sun className="w-3.5 h-3.5 fill-amber-300" />}
          </button>

          <div className={`h-4 w-[1px] ${theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#2D2D33]'}`} />

          {/* Project File Actions */}
          <div className={`flex items-center border rounded overflow-hidden p-0.5 transition-colors ${
            theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#252529]/60 border-[#2D2D33]'
          } ${isSimulating ? 'opacity-40 pointer-events-none' : ''}`} id="project-file-actions-toolbar">
            <button
              onClick={handleSaveProject}
              className={`p-1 rounded-sm transition cursor-pointer ${
                theme === 'LIGHT' ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]' : 'text-[#A0A0AA] hover:text-white hover:bg-[#2D2D33]'
              }`}
              title="Save project file (.veil)"
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={handleRestoreProject}
              className={`p-1 rounded-sm transition cursor-pointer ${
                theme === 'LIGHT' ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]' : 'text-[#A0A0AA] hover:text-white hover:bg-[#2D2D33]'
              }`}
              title="Open project file (.veil)"
            >
              <FolderOpen className="w-3 h-3" />
            </button>
            
            <div className={`w-[1px] h-3 mx-1 ${theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#2D2D33]'}`} />

            <button
              onClick={handleExportScene}
              className="p-1 rounded-sm transition cursor-pointer flex items-center justify-center text-purple-400 hover:text-purple-300 hover:bg-purple-500/15"
              title="Compile & Export Scene Manifest JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <label
              className="p-1 rounded-sm transition cursor-pointer flex items-center justify-center text-emerald-400 hover:text-emerald-350 hover:bg-emerald-500/15"
              title="Import compiled Scene Manifest JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportSceneFile} 
                className="hidden" 
              />
            </label>
          </div>

          <div className={`h-4 w-[1px] ${theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#2D2D33]'}`} />

          {/* Camera alignment */}
          <div className={`flex border rounded overflow-hidden p-0.5 transition-colors ${
            theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
          }`}>
            {(['ISOMETRIC', 'PERSPECTIVE', 'DIMETRIC', 'FLAT_2D'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewportCamera(mode)}
                className={`px-2 py-0.5 text-[9px] font-mono tracking-tighter transition rounded-sm cursor-pointer ${
                  activeViewportCamera === mode 
                    ? theme === 'LIGHT' 
                      ? 'bg-[#E5E5EA] text-[#7C3AED] font-bold border border-[#D1D1D6]' 
                      : 'bg-[#252529] text-[#7C3AED] font-bold border border-[#2D2D33]' 
                    : 'text-[#71717A] hover:text-[#E0E0E6]'
                }`}
                title={mode === 'FLAT_2D' ? 'Lock 2D flat workspace projection' : `${mode} spatial view`}
              >
                {mode === 'FLAT_2D' ? '2D FLAT' : mode}
              </button>
            ))}
          </div>

          <div className={`h-4 w-[1px] ${theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#2D2D33]'}`} />

          {/* Panel Toggles */}
          <div className={`flex border rounded overflow-hidden p-0.5 transition-colors ${
            theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
          }`} title="Toggle panels (Ctrl+Shift+T, Ctrl+Shift+A)">
            <button
              onClick={() => setIsBehaviorTreePanelOpen(!isBehaviorTreePanelOpen)}
              className={`p-1 rounded-sm transition cursor-pointer ${
                isBehaviorTreePanelOpen
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/50'
                  : theme === 'LIGHT'
                    ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]'
                    : 'text-[#A0A0AA] hover:text-white hover:bg-[#252529]'
              }`}
              title="Behavior Trees (Ctrl+Shift+T)"
            >
              <GitBranch className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsAssetLibraryPanelOpen(!isAssetLibraryPanelOpen)}
              className={`p-1 rounded-sm transition cursor-pointer ${
                isAssetLibraryPanelOpen
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/50'
                  : theme === 'LIGHT'
                    ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]'
                    : 'text-[#A0A0AA] hover:text-white hover:bg-[#252529]'
              }`}
              title="Asset Library (Ctrl+Shift+A)"
            >
              <Package className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className={`h-4 w-[1px] ${theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#2D2D33]'}`} />
          <div className={`flex border rounded overflow-hidden p-0.5 transition-colors ${
            theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
          }`}
          title="Viewport Aspects format preset (e.g. 4:3 retrograde or 16:9 widescreen layout check)"
          >
            {(['16:9', '4:3'] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setCanvasAspectRatio(ratio)}
                className={`px-1.5 py-0.5 text-[9px] font-mono tracking-tighter transition rounded-sm cursor-pointer ${
                  canvasAspectRatio === ratio 
                    ? theme === 'LIGHT' 
                      ? 'bg-purple-100 text-[#7C3AED] font-bold' 
                      : 'bg-purple-950/40 text-purple-300 font-bold' 
                    : 'text-[#71717A] hover:text-[#E0E0E6]'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          <div className={`h-4 w-[1px] ${theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#2D2D33]'}`} />

          {/* Canvas visual guides & camera locked targets */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowGuideFrame(!showGuideFrame)}
              className={`p-1 rounded border transition cursor-pointer flex items-center justify-center ${
                showGuideFrame
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-400'
                  : theme === 'LIGHT'
                    ? 'bg-white border-[#D1D1D6] text-[#71717A] hover:bg-[#F2F2F7]'
                    : 'bg-[#141417] border-[#2D2D33] text-[#71717A] hover:bg-[#252529]'
              }`}
              title={`Toggle ${canvasAspectRatio} Playfield Outlines (Crop Check)`}
            >
              <Frame className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setCameraFocusZLocked(!cameraFocusZLocked)}
              className={`p-1 rounded border transition cursor-pointer flex items-center justify-center ${
                cameraFocusZLocked
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-400'
                  : theme === 'LIGHT'
                    ? 'bg-white border-[#D1D1D6] text-[#71717A] hover:bg-[#F2F2F7]'
                    : 'bg-[#141417] border-[#2D2D33] text-[#71717A] hover:bg-[#252529]'
              }`}
              title="Toggle Target Lock to Active Layer Depth Plane"
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className={`h-4 w-[1px] ${theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#2D2D33]'}`} />

          {/* Primary Compiler Activation Key */}
          <button
            onClick={handleSimulationToggle}
            disabled={isCompiling}
            className={`flex items-center gap-1 px-3 py-1 rounded text-[10px] font-mono font-bold tracking-wider transition cursor-pointer ${
              isSimulating
                ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                : 'bg-[#7C3AED] hover:bg-[#8B5CF6] text-white shadow-sm'
            }`}
            title={isSimulating ? 'Stop runtime (ESC)' : 'Compile & Play'}
          >
            {isSimulating ? <Square className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white" />}
            <span>{isSimulating ? 'STOP' : 'PLAY'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN ACTIVE WORKSPACE INTERFACES */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left column: Hierarchy list */}
        <aside className={`w-64 max-w-xs shrink-0 flex flex-col min-h-0 border-r transition-colors z-40 ${
          theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]'
        }`}>
          <HierarchyPanel workspace={activeWorkspace} theme={theme} />
        </aside>

        {/* Middle core editor workspace viewer */}
        <main className={`flex-1 flex flex-col relative min-w-0 transition-colors ${
          theme === 'LIGHT' ? 'bg-[#E5E5EA]' : 'bg-[#0F0F12]'
        }`}>
          {isSimulating ? (
            // Simulation execution HUD
            <div className="p-3 w-full h-full flex items-center justify-center">
              <div className="w-full max-w-3xl h-full flex flex-col justify-center">
                <SimulationOverlay manifest={compiledManifest} theme={theme} workspace={activeWorkspace} />
              </div>
            </div>
          ) : (
            // Standard 3D Spatial designer Viewport
            <div className="w-full h-full relative">
              <SpatialCreativeCanvas
                entities={entities}
                selectedUuid={selectedUuid}
                activeToolMode={activeToolMode}
                cameraMode={activeViewportCamera}
                cameraZoom={cameraZoom}
                onSelectEntity={setSelectedUuid}
                onUpdateTransform={updateEntityTransform}
                cameraTrajectory={cameraTrajectory}
                workspace={activeWorkspace}
                theme={theme}
              />
              {/* Overlaid Compass banner */}
              <div className={`absolute top-3 left-3 border px-2.5 py-1.5 rounded font-mono select-none pointer-events-none z-10 shadow-lg ${
                theme === 'LIGHT' ? 'bg-white/95 border-[#D1D1D6]' : 'bg-[#1A1A1E]/95 border-[#2D2D33]'
              }`}>
                <div className="flex items-center gap-1.5 text-[9px] uppercase font-semibold text-[#7C3AED]">
                  <Camera className="w-3 h-3" />
                  <span>3D Layout Engine</span>
                </div>
                <div className={`text-[8px] font-mono mt-0.5 ${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>
                  Scale: 1 Unit spacing
                </div>
              </div>

              {isCompiling && (
                <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center text-center select-none animate-fade-in ${
                  theme === 'LIGHT' ? 'bg-[#F2F2F7]/95' : 'bg-[#0F0F12]/85 backdrop-blur-[2px]'
                }`}>
                  <Cpu className="w-8 h-8 text-[#7C3AED] animate-spin mb-3" />
                  <p className="font-mono text-[10px] uppercase text-[#7C3AED] tracking-widest font-bold">COMPILING MANIFEST</p>
                  <p className={`text-[9px] mt-1.5 font-mono max-w-[280px] ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>
                    Baking coordinates and physical collider structures...
                  </p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right column: Inspect variables panel */}
        <aside className={`w-64 max-w-xs shrink-0 flex flex-col min-h-0 border-l transition-colors z-40 ${
          theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]'
        }`}>
          <InspectorPanel workspace={activeWorkspace} theme={theme} />
        </aside>
      </div>

      {/* 3. BOTTOM SEQUENCER & TERMINAL DECK */}
      <footer className={`h-56 border-t shrink-0 flex min-h-0 transition-colors z-40 ${
        theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#1A1A1E] border-[#2D2D33]'
      }`}>
        {activeWorkspace === 'ARTIST' ? (
          <div className="w-full flex flex-col min-h-0 animate-fade-in">
            <TimelineSeqEditor theme={theme} />
          </div>
        ) : (
          <div className="w-full flex flex-col min-h-0 animate-fade-in">
            <MetronomeTerminal theme={theme} />
          </div>
        )}
      </footer>

      {/* Behavior Tree Panel Overlay */}
      <BehaviorTreePanel 
        isOpen={isBehaviorTreePanelOpen}
        onClose={() => setIsBehaviorTreePanelOpen(false)}
      />

      {/* Asset Library Panel Overlay */}
      <AssetLibraryPanel 
        isOpen={isAssetLibraryPanelOpen}
        onClose={() => setIsAssetLibraryPanelOpen(false)}
      />
    </div>
  );
}