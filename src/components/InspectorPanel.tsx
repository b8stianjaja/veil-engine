/**
 * @file src/components/InspectorPanel.tsx
 * @description Property inspector panel for the selected spatial entity.
 * Supports updating coordinates, colors, geometries, asset bindings, and animation parameters.
 * Automatically falls back to Global Environment or Vector Brush consoles when no entity is selected.
 */

import React from 'react';
import { useSpatialEditorStore } from '../app/store';
import { GeometryType, BehaviorType, Entity } from '../types';
import { 
  Settings, HelpCircle, Move, Video, 
  Palette, Eraser, PenTool, Hexagon, 
  Cpu, MonitorPlay, Pipette
} from 'lucide-react';

export default function InspectorPanel({ workspace = 'ARTIST', theme = 'DARK' }: { workspace?: 'ARTIST' | 'DEVELOPER'; theme?: 'LIGHT' | 'DARK' }) {
  const {
    entities,
    selectedUuid,
    updateEntityProperty,
    updateEntityTransform,
    activeToolMode,
    drawingTool, setDrawingTool,
    drawingColor, setDrawingColor,
    drawingWidth, setDrawingWidth,
    drawingBrushStyle, setDrawingBrushStyle,
    selectedBrush, setSelectedBrush,
    environment, updateEnvironment,
    drawingStrokes
  } = useSpatialEditorStore();

  const selectedEntity = selectedUuid ? entities[selectedUuid] : null;

  // =========================================================
  // IDLE STATES: Vector Brush Console & Environment Console
  // =========================================================
  if (!selectedEntity) {
    // ARTIST BRUSH CONSOLE (Active when DRAW mode is selected)
    if (workspace === 'ARTIST' && activeToolMode === 'DRAW') {
      return (
        <div className={`w-full h-full flex flex-col font-sans text-xs select-none overflow-y-auto scrollbar-thin transition-colors ${
          theme === 'LIGHT' ? 'bg-[#FFFFFF] border-l border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#1A1A1E] border-l border-[#2D2D33] text-[#E0E0E6]'
        }`}>
          <div className={`px-3 py-1.5 border-b flex items-center justify-between shrink-0 transition-colors ${
            theme === 'LIGHT' ? 'bg-[#E5E5EA] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
          }`}>
            <span className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              Vector Brush Console
            </span>
          </div>

          <div className="p-3 space-y-5">
            {/* 1. Active Tool Toggle */}
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ ACTIVE TOOL</div>
              <div className={`flex rounded border overflow-hidden p-0.5 transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
              }`}>
                {(['pencil', 'eraser', 'mesh'] as const).map(tool => (
                  <button
                    key={tool}
                    onClick={() => setDrawingTool(tool)}
                    className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold uppercase transition rounded-sm ${
                      drawingTool === tool 
                        ? 'bg-[#7C3AED] text-white shadow-sm' 
                        : theme === 'LIGHT' 
                          ? 'text-[#55555C] hover:bg-[#E5E5EA]' 
                          : 'text-[#71717A] hover:bg-[#252529] hover:text-[#E0E0E6]'
                    }`}
                  >
                    {tool === 'pencil' && <PenTool className="w-3 h-3" />}
                    {tool === 'eraser' && <Eraser className="w-3 h-3" />}
                    {tool === 'mesh' && <Hexagon className="w-3 h-3" />}
                    {tool}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Style Selector (Disabled if not pencil) */}
            <div className={`space-y-2 transition-opacity ${drawingTool !== 'pencil' ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              <div className={`text-[10px] font-bold tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ VECTOR STYLE</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['solid', 'calligraphy', 'charcoal', 'neon', 'star', 'dash'] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => setDrawingBrushStyle(style)}
                    className={`py-1.5 text-[9px] font-mono font-bold uppercase border rounded transition ${
                      drawingBrushStyle === style 
                        ? theme === 'LIGHT' ? 'bg-purple-100 border-[#7C3AED] text-[#7C3AED]' : 'bg-purple-900/40 border-purple-500 text-purple-300'
                        : theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#55555C] hover:bg-[#F2F2F7]' : 'bg-[#141417] border-[#2D2D33] text-[#71717A] hover:bg-[#252529]'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Pigment & Width (Disabled for Eraser) */}
            <div className={`space-y-4 transition-opacity ${drawingTool === 'eraser' ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              <div className="space-y-2">
                <div className={`text-[10px] font-bold tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ PIGMENT COLOR</div>
                <div className={`flex items-center justify-between p-2 rounded border transition-colors ${
                  theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
                }`}>
                  <Pipette className={`w-4 h-4 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`} />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={drawingColor}
                      onChange={(e) => setDrawingColor(e.target.value)}
                      className="w-6 h-6 rounded bg-transparent border-none cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={drawingColor}
                      onChange={(e) => setDrawingColor(e.target.value)}
                      className={`w-20 border px-1.5 py-1 rounded text-[10px] font-mono text-center transition-colors ${
                        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={`text-[10px] font-bold tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ STROKE WIDTH</div>
                  <span className="text-[10px] font-mono text-[#7C3AED] font-bold">{drawingWidth.toFixed(1)} px</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" max="15" step="0.1" 
                  value={drawingWidth} 
                  onChange={(e) => setDrawingWidth(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#7C3AED] bg-zinc-700/60"
                />
              </div>
            </div>

            {/* 4. Mesh Placement Settings (Active only when Tool === Mesh) */}
            {drawingTool === 'mesh' && (
              <div className="space-y-2 pt-2 border-t border-purple-500/20 animate-fade-in">
                <div className={`text-[10px] font-bold tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ COMPONENT STAMP</div>
                <div className={`p-2.5 rounded border space-y-2.5 transition-colors ${
                  theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
                }`}>
                  <select
                    value={selectedBrush.behavior}
                    onChange={(e) => setSelectedBrush({ ...selectedBrush, behavior: e.target.value as BehaviorType })}
                    className={`w-full px-1.5 py-1 rounded text-[10px] focus:outline-none shadow-sm font-mono transition-colors ${
                      theme === 'LIGHT' ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border border-[#2D2D33] text-white'
                    }`}
                  >
                    <option value="STATIC">STATIC SOLID</option>
                    <option value="PLAYER">PLAYER CONTROL</option>
                    <option value="ROTATOR">ROTATION MECHANICS</option>
                    <option value="COLLECTIBLE">COLLECTIBLE STAR</option>
                    <option value="HAZARD">SPIKE DAMAGE ZONE</option>
                    <option value="TRIGGER">METRONOME EVENT</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // DEVELOPER ENVIRONMENT CONSOLE
    if (workspace === 'DEVELOPER') {
      return (
        <div className={`w-full h-full flex flex-col font-sans text-xs select-none overflow-y-auto scrollbar-thin transition-colors ${
          theme === 'LIGHT' ? 'bg-[#FFFFFF] border-l border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#1A1A1E] border-l border-[#2D2D33] text-[#E0E0E6]'
        }`}>
          <div className={`px-3 py-1.5 border-b flex items-center justify-between shrink-0 transition-colors ${
            theme === 'LIGHT' ? 'bg-[#E5E5EA] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
          }`}>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Environment Matrix
            </span>
          </div>

          <div className="p-3 space-y-5">
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ GLOBAL CLEAR COLOR</div>
              <div className={`flex items-center justify-between p-2 rounded border transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
              }`}>
                <input
                  type="color"
                  value={environment.clearColor}
                  onChange={(e) => updateEnvironment({ clearColor: e.target.value })}
                  className="w-6 h-6 rounded bg-transparent border-none cursor-pointer p-0"
                />
                <input
                  type="text"
                  value={environment.clearColor}
                  onChange={(e) => updateEnvironment({ clearColor: e.target.value })}
                  className={`w-24 border px-2 py-1 rounded text-[10px] font-mono text-center transition-colors ${
                    theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className={`text-[10px] font-bold tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ CAMERA FOV</div>
                <span className="text-[10px] font-mono text-emerald-500 font-bold">{environment.fov.toFixed(0)}°</span>
              </div>
              <div className={`p-3 rounded border transition-colors ${theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'}`}>
                <input 
                  type="range" 
                  min="20" max="110" step="1" 
                  value={environment.fov} 
                  onChange={(e) => updateEnvironment({ fov: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-500 bg-zinc-700/60"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-emerald-500/20">
              <div className={`text-[10px] font-bold tracking-wider ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ MANIFEST SUMMARY</div>
              <div className={`p-3 rounded border font-mono text-[9px] space-y-2 transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6] text-[#55555C]' : 'bg-[#141417] border-[#2D2D33] text-[#A0A0AA]'
              }`}>
                <div className="flex justify-between"><span>Physical Nodes:</span> <span className="text-white font-bold">{Object.keys(entities).length}</span></div>
                <div className="flex justify-between"><span>Vector Strokes:</span> <span className="text-white font-bold">{drawingStrokes.length}</span></div>
                <div className="flex justify-between"><span>Target Aspect:</span> <span className="text-emerald-400 font-bold">16:9 HD</span></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default Fallback
    return (
      <div className={`w-full h-full flex flex-col p-4 text-center justify-center items-center font-mono text-xs select-none transition-colors ${
        theme === 'LIGHT' ? 'bg-[#FFFFFF] border-l border-[#D1D1D6] text-gray-500' : 'bg-[#1A1A1E] border-l border-[#2D2D33] text-gray-500'
      }`}>
        <Settings className="w-8 h-8 text-gray-400 mb-2 animate-pulse" />
        <p className="max-w-[180px]">No node selected. Click an element to inspect its matrix in {workspace.toLowerCase()} mode.</p>
      </div>
    );
  }

  // =========================================================
  // ACTIVE ENTITY STATE (Existing Handlers and UI)
  // =========================================================
  const handleTextChange = (key: keyof Entity, val: any) => {
    updateEntityProperty(selectedEntity.uuid, key, val);
  };

  const handleTransformChange = (
    axis: 'x' | 'y' | 'z' | 'pitch' | 'yaw' | 'roll' | 'sx' | 'sy' | 'sz',
    val: number
  ) => {
    const pos = [...selectedEntity.transform.position] as [number, number, number];
    const rot = [...selectedEntity.transform.rotation] as [number, number, number];
    const scl = [...selectedEntity.transform.scale] as [number, number, number];

    if (axis === 'x') pos[0] = val;
    else if (axis === 'y') pos[1] = val;
    else if (axis === 'z') pos[2] = val;
    else if (axis === 'pitch') rot[0] = val;
    else if (axis === 'yaw') rot[1] = val;
    else if (axis === 'roll') rot[2] = val;
    else if (axis === 'sx') scl[0] = Math.max(0.01, val);
    else if (axis === 'sy') scl[1] = Math.max(0.01, val);
    else if (axis === 'sz') scl[2] = Math.max(0.01, val);

    updateEntityTransform(selectedEntity.uuid, pos, rot, scl);
  };

  const handleAnimationChange = (field: string, val: any) => {
    const currentConf = selectedEntity.animationConfig || {
      frameCount: 1, frameDuration: 0.083, loop: true, autoPlay: true
    };
    updateEntityProperty(selectedEntity.uuid, 'animationConfig', { ...currentConf, [field]: val });
  };

  return (
    <div className={`w-full h-full flex flex-col font-sans text-xs select-none overflow-y-auto scrollbar-thin transition-colors ${
      theme === 'LIGHT' ? 'bg-[#FFFFFF] border-l border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#1A1A1E] border-l border-[#2D2D33] text-[#E0E0E6]'
    }`} id="inspector-panel">
      <div className={`px-3 py-1.5 border-b flex justify-between items-center shrink-0 transition-colors ${
        theme === 'LIGHT' ? 'bg-[#E5E5EA] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
      }`}>
        <span className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider">
          {workspace === 'ARTIST' ? 'Inspector' : 'Logic'}
        </span>
        <span className="text-[#71717A] text-[10px] cursor-default font-mono">...</span>
      </div>

      <div className="p-3 space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0"></div>
          <input
            type="text"
            value={selectedEntity.name}
            onChange={(e) => handleTextChange('name', e.target.value)}
            className={`text-xs px-2 py-1 w-full rounded font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#7C3AED] transition-colors ${
              theme === 'LIGHT' ? 'bg-[#F2F2F7] border border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#2D2D33] border-none text-white'
            }`}
          />
        </div>

        {workspace === 'ARTIST' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ 2.5D DEPTH LAYERS</div>
              <div className={`p-2.5 rounded border space-y-2.5 transition-colors ${theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'}`}>
                <p className={`text-[9px] leading-tight font-mono select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>
                  Setting the Z-depth automatically assigns the sprite layer: background (Z &lt; -10), gameplay stage (-10 to 10), or foreground overlay (Z &gt; 10).
                </p>
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-sans ${theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-[#A0A0AA]'}`}>Layer depth (Z)</span>
                  <div className={`rounded px-2 py-1 flex items-center w-24 border transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'}`}>
                    <span className="text-[#7C3AED] mr-1.5 font-bold text-[9px]">Z</span>
                    <input
                      type="number" step="1"
                      value={Number(selectedEntity.transform.position[2].toFixed(0))}
                      onChange={(e) => handleTransformChange('z', parseFloat(e.target.value) || 0)}
                      className={`bg-transparent text-right w-full font-mono text-[10px] focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-white'}`}
                    />
                  </div>
                </div>
                <div className={`flex items-center justify-between text-[9px] font-mono py-1 border-t transition-colors ${theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]/40'}`}>
                  <span className={`${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Active Sorting Layer:</span>
                  <span className="text-emerald-500 font-bold">
                    {selectedEntity.transform.position[2] < -10 ? 'BACKGROUND' : selectedEntity.transform.position[2] > 10 ? 'FOREGROUND' : 'GAMEPLAY'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ COLOR TAPPING</div>
              <div className={`flex items-center justify-between p-2 rounded border transition-colors ${theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'}`}>
                <span className={`text-[9px] font-mono ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Mesh Render Tint</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={selectedEntity.color}
                    onChange={(e) => handleTextChange('color', e.target.value)}
                    className="w-5 h-5 rounded bg-transparent border-none cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={selectedEntity.color}
                    onChange={(e) => handleTextChange('color', e.target.value)}
                    className={`w-20 border px-1.5 py-0.5 rounded text-[10px] font-mono text-center transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#2D2D33] border-[#2D2D33] text-[#E0E0E6]'}`}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ SPRITE FLIPBOOK</div>
              <div className={`p-2.5 rounded border space-y-2.5 transition-colors ${theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'}`}>
                <div>
                  <label className={`text-[9px] block mb-1 font-mono ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Spritesheet Pattern File</label>
                  <input
                    type="text"
                    value={selectedEntity.assetFilename || ''}
                    onChange={(e) => handleTextChange('assetFilename', e.target.value.trim() || null)}
                    placeholder="character_sheet.png"
                    className={`w-full px-2 py-1 rounded text-[11px] focus:outline-none focus:border-[#7C3AED] transition-colors ${theme === 'LIGHT' ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6] placeholder-[#71717A]'}`}
                  />
                </div>
                {selectedEntity.assetFilename ? (
                  <div className={`space-y-2 border-t pt-2 transition-colors ${theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]/50'}`}>
                    <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#7C3AED] uppercase font-semibold">
                      <Video className="w-2.5 h-2.5" />
                      <span>Flipbook Settings</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Total Frames</span>
                        <input
                          type="number" min="1"
                          value={selectedEntity.animationConfig?.frameCount ?? 1}
                          onChange={(e) => handleAnimationChange('frameCount', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className={`w-full px-1 py-0.5 rounded text-[10px] font-mono focus:outline-none transition-colors ${theme === 'LIGHT' ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#2D2D33] border border-[#232326] text-[#E0E0E6]'}`}
                        />
                      </div>
                      <div>
                        <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Frame Time (s)</span>
                        <input
                          type="number" step="0.01" min="0.001"
                          value={selectedEntity.animationConfig?.frameDuration ?? 0.083}
                          onChange={(e) => handleAnimationChange('frameDuration', Math.max(0.001, parseFloat(e.target.value) || 0.083))}
                          className={`w-full px-1 py-0.5 rounded text-[10px] font-mono focus:outline-none transition-colors ${theme === 'LIGHT' ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#2D2D33] border border-[#232326] text-[#E0E0E6]'}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[9px]">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox" id="loop-anim"
                          checked={selectedEntity.animationConfig?.loop !== false}
                          onChange={(e) => handleAnimationChange('loop', e.target.checked)}
                          className="w-3 h-3 accent-[#7C3AED] rounded cursor-pointer"
                        />
                        <label htmlFor="loop-anim" className={`cursor-pointer ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>Repeat</label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox" id="autoplay-anim"
                          checked={selectedEntity.animationConfig?.autoPlay !== false}
                          onChange={(e) => handleAnimationChange('autoPlay', e.target.checked)}
                          className="w-3 h-3 accent-[#7C3AED] rounded cursor-pointer"
                        />
                        <label htmlFor="autoplay-anim" className={`cursor-pointer ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>Autoplay</label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`text-[9px] text-center py-2 rounded border font-mono transition-colors ${theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6] text-gray-400' : 'bg-[#141417] border-[#2D2D33]/40 text-[#71717A]'}`}>
                    No active patterns bound. Default tint applied.
                  </div>
                )}
              </div>
            </div>

            <button className={`w-full py-1.5 border border-dashed text-[10px] rounded-sm mt-2 transition cursor-pointer font-semibold ${theme === 'LIGHT' ? 'border-[#D1D1D6] text-[#55555C] hover:bg-[#F2F2F7] hover:text-[#1C1C1E]' : 'border-[#2D2D33] text-[#71717A] hover:bg-[#252529] hover:text-[#E0E0E6]'}`}>
              Add Layer Component
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ PHYSICS EXTRUSION</div>
              <div className={`p-2.5 rounded border space-y-2.5 transition-colors ${theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'}`}>
                <div>
                  <label className={`text-[9px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Collision Profile</label>
                  <select
                    value={selectedEntity.type}
                    onChange={(e) => handleTextChange('type', e.target.value as GeometryType)}
                    className={`w-full px-1.5 py-1 rounded text-[10.5px] focus:outline-none shadow-sm font-mono transition-colors ${theme === 'LIGHT' ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6]'}`}
                  >
                    <option value="BOX">BOX COLLIDER</option>
                    <option value="SPHERE">SPHERE RADIUS</option>
                    <option value="CAPSULE">CAPSULE CYLINDER</option>
                    <option value="MESH">CUSTOM CONVEX HULL</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-mono">
                  <div>
                    <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Width</span>
                    <input type="number" step="0.1" value={Number(selectedEntity.transform.scale[0].toFixed(1))} onChange={(e) => handleTransformChange('sx', parseFloat(e.target.value) || 1)} className={`text-center w-full border focus:outline-none p-0.5 rounded text-[10px] transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'}`} />
                  </div>
                  <div>
                    <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Height</span>
                    <input type="number" step="0.1" value={Number(selectedEntity.transform.scale[1].toFixed(1))} onChange={(e) => handleTransformChange('sy', parseFloat(e.target.value) || 1)} className={`text-center w-full border focus:outline-none p-0.5 rounded text-[10px] transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'}`} />
                  </div>
                  <div>
                    <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Depth</span>
                    <input type="number" step="0.1" value={Number(selectedEntity.transform.scale[2].toFixed(1))} onChange={(e) => handleTransformChange('sz', parseFloat(e.target.value) || 1)} className={`text-center w-full border focus:outline-none p-0.5 rounded text-[10px] transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'}`} />
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 pt-1 border-t transition-colors ${theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]/40'}`}>
                  <input type="checkbox" id="isSensor-tick" checked={selectedEntity.isSensor} onChange={(e) => handleTextChange('isSensor', e.target.checked)} className="w-3.5 h-3.5 accent-[#7C3AED] rounded" />
                  <div className="flex flex-col">
                    <label htmlFor="isSensor-tick" className="text-[10px] flex items-center gap-1 cursor-pointer select-none font-bold">
                      <span className={theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-[#E0E0E6]'}>Sensor Overlap Mode</span>
                      <span title="Sensors ignore solid physical collision blocks and only emit overlap signals."><HelpCircle className="w-2.5 h-2.5 text-[#71717A]" /></span>
                    </label>
                    <span className={`text-[8px] ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Turns solid boundaries into triggers.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ LOGIC ARCHETYPES</div>
              <div className={`p-2 rounded border transition-colors ${theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'}`}>
                <label className={`text-[9px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Logic Type</label>
                <select
                  value={selectedEntity.behavior}
                  onChange={(e) => handleTextChange('behavior', e.target.value as BehaviorType)}
                  className={`w-full px-1.5 py-1 rounded text-[10.5px] focus:outline-none shadow-sm font-mono transition-colors ${theme === 'LIGHT' ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6]'}`}
                >
                  <option value="STATIC">STATIC SOLID</option>
                  <option value="PLAYER">PLAYER CONTROL (WASD)</option>
                  <option value="ROTATOR">ROTATION MECHANICS</option>
                  <option value="COLLECTIBLE">COLLECTIBLE STAR</option>
                  <option value="HAZARD">SPIKE DAMAGE ZONE</option>
                  <option value="TRIGGER">METRONOME LOGIC EVENT</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ SPATIAL MATRIX</div>
                <button onClick={() => updateEntityTransform(selectedEntity.uuid, [0, 0, 0], [0, 0, 0], [1, 1, 1])} className={`text-[9px] font-mono cursor-pointer transition-colors ${theme === 'LIGHT' ? 'text-[#7C3AED] hover:text-[#5B21B6]' : 'text-[#71717A] hover:text-white'}`}>
                  Reset Transform
                </button>
              </div>
              <div className={`p-2.5 rounded border space-y-2 font-mono transition-colors ${theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'}`}>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded p-1 flex items-baseline border transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'}`}>
                    <span className="text-red-500 mr-1.5 font-bold select-none text-[8px]">X</span>
                    <input type="number" step="0.1" value={Number(selectedEntity.transform.position[0].toFixed(2))} onChange={(e) => handleTransformChange('x', parseFloat(e.target.value) || 0)} className={`bg-transparent text-right w-full font-mono text-[10px] focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-white'}`} />
                  </div>
                  <div className={`rounded p-1 flex items-baseline border transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'}`}>
                    <span className="text-emerald-500 mr-1.5 font-bold select-none text-[8px]">Y</span>
                    <input type="number" step="0.1" value={Number(selectedEntity.transform.position[1].toFixed(2))} onChange={(e) => handleTransformChange('y', parseFloat(e.target.value) || 0)} className={`bg-transparent text-right w-full font-mono text-[10px] focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-white'}`} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[9px]">
                  <div className="flex flex-col">
                    <span className={`text-[8px] mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Pitch</span>
                    <input type="number" step="0.1" value={Number(selectedEntity.transform.rotation[0].toFixed(2))} onChange={(e) => handleTransformChange('pitch', parseFloat(e.target.value) || 0)} className={`text-center focus:outline-none p-0.5 rounded text-[9px] border transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[8px] mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Yaw</span>
                    <input type="number" step="0.1" value={Number(selectedEntity.transform.rotation[1].toFixed(2))} onChange={(e) => handleTransformChange('yaw', parseFloat(e.target.value) || 0)} className={`text-center focus:outline-none p-0.5 rounded text-[9px] border transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[8px] mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Roll</span>
                    <input type="number" step="0.1" value={Number(selectedEntity.transform.rotation[2].toFixed(2))} onChange={(e) => handleTransformChange('roll', parseFloat(e.target.value) || 0)} className={`text-center focus:outline-none p-0.5 rounded text-[9px] border transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'}`} />
                  </div>
                </div>
              </div>
            </div>

            <button className={`w-full py-1.5 border border-dashed text-[10px] rounded-sm mt-3 transition cursor-pointer font-semibold ${theme === 'LIGHT' ? 'border-[#D1D1D6] text-[#55555C] hover:bg-[#F2F2F7] hover:text-[#1C1C1E]' : 'border-[#2D2D33] text-[#71717A] hover:bg-[#252529] hover:text-[#E0E0E6]'}`}>
              Bake Physics Actor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}