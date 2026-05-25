import React, { useState, useEffect } from 'react';
import { useSpatialEditorStore } from './app/store';
import HierarchyPanel from './components/HierarchyPanel';
import InspectorPanel from './components/InspectorPanel';
import SpatialCreativeCanvas from './editor/SpatialCreativeCanvas';
import TimelineSeqEditor from './components/TimelineSeqEditor';
import MetronomeTerminal from './components/MetronomeTerminal';
import SimulationOverlay from './components/SimulationOverlay';
import EventBus from './engine/protocol/EventBus';
import SimulationCore from './engine/SimulationCore';
import { VeilProjectManifest } from './types';
import {
  Play,
  Square,
  Cpu,
  Monitor,
  Camera,
  Layers,
  Save,
  FolderOpen,
  ArrowRightLeft,
  Terminal,
  MousePointer,
  Move,
  RotateCw,
  Maximize2,
  Palette,
  Sun,
  Moon,
  Paintbrush,
  Frame,
  Pin,
  Download,
  Upload
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

  // Bind hotkeys for quick tool changes matching standard high-end modeling apps (W, E, R, T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent mapping intercepts when inside focus input blocks
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'q') setToolMode('SELECT');
      else if (key === 'w') setToolMode('TRANSLATE');
      else if (key === 'e') setToolMode('ROTATE');
      else if (key === 'r') setToolMode('SCALE');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setToolMode]);

  // Listen to simulation status events
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
    // Shutdown simulation loop and restore values
    SimulationCore.stop();
  };

  const handleSimulationToggle = () => {
    if (isSimulating) {
      handleStopSimulation();
    } else {
      handleCompileAndPlay();
    }
  };

  // Mock saving project file and trigger logs
  const handleSaveProject = () => {
    const data = {
      environment: useSpatialEditorStore.getState().environment,
      data: entities,
      timelineEvents: useSpatialEditorStore.getState().timelineEvents
    };
    
    // Simulate FS operations
    EventBus.emit('EXECUTE_EVENT', {
      type: 'SYSTEM_FS',
      action: 'MOCK_SAVE_SUCCESS',
      payload: { path: projectPath, sizeBytes: JSON.stringify(data).length }
    });
  };

  const handleRestoreProject = () => {
    // Force reset simulation
    if (isSimulating) {
      handleStopSimulation();
    }

    if (compiledManifest) {
      loadProjectManifest(compiledManifest);
      EventBus.emit('EXECUTE_EVENT', {
        type: 'SYSTEM_FS',
        action: 'MOCK_RESTORE_SUCCESS',
        payload: { path: projectPath }
      });
    } else {
      EventBus.emit('EXECUTE_EVENT', {
        type: 'SYSTEM_FS',
        action: 'MOCK_RESTORE_FAIL',
        payload: { error: 'No compiled manifest history to restore.' }
      });
    }
  };

  const handleExportScene = async () => {
    try {
      // 1. Compile state into the formal VeilProjectManifest
      const manifest = await triggerCompile();
      
      // 2. Format JSON beautifully
      const jsonStr = JSON.stringify(manifest, null, 2);
      
      // 3. Initiate browser anchor download stream
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `veil_scene_${Date.now()}_manifest.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // 4. Log the state success event
      EventBus.emit('EXECUTE_EVENT', {
        type: 'SYSTEM_FS',
        action: 'EXPORT_SUCCESS',
        payload: { filename: `veil_scene_${Date.now()}_manifest.json`, sizeBytes: jsonStr.length }
      });
    } catch (err: any) {
      console.error('Exporting manifest failed:', err);
      EventBus.emit('EXECUTE_EVENT', {
        type: 'SYSTEM_FS',
        action: 'EXPORT_FAILED',
        payload: { error: err.message || 'Failure during active compilation export.' }
      });
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
    // Reset target input to allow loading the same file again if refreshed
    e.target.value = '';
  };

  return (
    <div className={`w-screen h-screen flex flex-col font-sans overflow-hidden select-none transition-colors duration-200 ${
      theme === 'LIGHT' ? 'bg-[#F2F2F7] text-[#1C1C1E]' : 'bg-[#0F0F12] text-[#E0E0E6]'
    }`} id="veil-engine-studio-ide">
      
      {/* 1. TOP CONTROL BAR */}
      <header className={`h-9 flex items-center justify-between px-3 shrink-0 shadow-sm transition-colors ${
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
            <span className={`${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'} font-semibold`}>{projectPath}</span>
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

        {/* Core Editor Gizmos Toggles Menu */}
        <div className={`flex items-center border rounded overflow-hidden p-0.5 transition-colors ${
          theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
        }`} id="gizmo-mode-toggles-menu" title="Hotkeys: Q, W, E, R">
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
          }`} id="project-file-actions-toolbar">
            <button
              onClick={handleSaveProject}
              className={`p-1 rounded-sm transition cursor-pointer ${
                theme === 'LIGHT' ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]' : 'text-[#A0A0AA] hover:text-white hover:bg-[#2D2D33]'
              }`}
              title="Save project specs internally"
            >
              <Save className="w-3 h-3" />
            </button>
            <button
              onClick={handleRestoreProject}
              className={`p-1 rounded-sm transition cursor-pointer ${
                theme === 'LIGHT' ? 'text-[#55555C] hover:text-[#1C1C1E] hover:bg-[#E5E5EA]' : 'text-[#A0A0AA] hover:text-white hover:bg-[#2D2D33]'
              }`}
              title="Restore project manifest history internally"
            >
              <FolderOpen className="w-3 h-3" />
            </button>
            
            <div className={`w-[1px] h-3 mx-1 ${theme === 'LIGHT' ? 'bg-zinc-350 bg-zinc-300' : 'bg-[#2D2D33]'}`} />

            <button
              onClick={handleExportScene}
              className={`p-1 rounded-sm transition cursor-pointer flex items-center justify-center text-purple-400 hover:text-purple-300 hover:bg-purple-500/15`}
              title="Export Current Scene (Triggers a JSON manifest file download of hand-drawn lines & coordinates)"
              id="export-scene-manifest-btn"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <label
              className={`p-1 rounded-sm transition cursor-pointer flex items-center justify-center text-emerald-400 hover:text-emerald-350 hover:bg-emerald-500/15`}
              title="Import Scene (Uploads/restores a hand-drawn vector JSON manifest)"
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

          {/* Aspect Ratio Selector */}
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
          >
            {isSimulating ? <Square className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white" />}
            <span>{isSimulating ? 'STOP' : 'PLAY'}</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN ACTIVE WORKSPACE INTERFACES */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left column: Hierarchy list */}
        <aside className={`w-64 max-w-xs shrink-0 flex flex-col min-h-0 border-r transition-colors ${
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
        <aside className={`w-64 max-w-xs shrink-0 flex flex-col min-h-0 border-l transition-colors ${
          theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]'
        }`}>
          <InspectorPanel workspace={activeWorkspace} theme={theme} />
        </aside>
      </div>

      {/* 3. BOTTOM SEQUENCER & TERMINAL DECK */}
      <footer className={`h-56 border-t shrink-0 flex min-h-0 transition-colors ${
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
    </div>
  );
}

