/**
 * @file src/components/InspectorPanel.tsx
 * @description Property inspector panel for the selected spatial entity.
 * Supports updating coordinates, colors, geometries, asset bindings, and animation parameters.
 */

import React from 'react';
import { useSpatialEditorStore } from '../app/store';
import { GeometryType, BehaviorType, Entity } from '../types';
import { Settings, HelpCircle, HardDrive, Move, Video } from 'lucide-react';

export default function InspectorPanel({ workspace = 'ARTIST', theme = 'DARK' }: { workspace?: 'ARTIST' | 'DEVELOPER'; theme?: 'LIGHT' | 'DARK' }) {
  const {
    entities,
    selectedUuid,
    updateEntityProperty,
    updateEntityTransform
  } = useSpatialEditorStore();

  const selectedEntity = selectedUuid ? entities[selectedUuid] : null;

  if (!selectedEntity) {
    return (
      <div className={`w-full h-full flex flex-col p-4 text-center justify-center items-center font-mono text-xs select-none transition-colors ${
        theme === 'LIGHT' ? 'bg-[#FFFFFF] border-l border-[#D1D1D6] text-gray-500' : 'bg-[#1A1A1E] border-l border-[#2D2D33] text-gray-500'
      }`}>
        <Settings className="w-8 h-8 text-gray-400 mb-2 animate-pulse" />
        <p className="max-w-[180px]">No node selected. Click an element on the grid or list to inspect its matrix in {workspace.toLowerCase()} mode.</p>
      </div>
    );
  }

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
      frameCount: 1,
      frameDuration: 0.083,
      loop: true,
      autoPlay: true
    };

    const nextConf = {
      ...currentConf,
      [field]: val
    };

    updateEntityProperty(selectedEntity.uuid, 'animationConfig', nextConf);
  };

  return (
    <div className={`w-full h-full flex flex-col font-sans text-xs select-none overflow-y-auto scrollbar-thin transition-colors ${
      theme === 'LIGHT' ? 'bg-[#FFFFFF] border-l border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#1A1A1E] border-l border-[#2D2D33] text-[#E0E0E6]'
    }`} id="inspector-panel">
      {/* Title Header matching Design HTML */}
      <div className={`px-3 py-1.5 border-b flex justify-between items-center shrink-0 transition-colors ${
        theme === 'LIGHT' ? 'bg-[#E5E5EA] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
      }`}>
        <span className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider">
          {workspace === 'ARTIST' ? 'Inspector' : 'Logic'}
        </span>
        <span className="text-[#71717A] text-[10px] cursor-default font-mono">...</span>
      </div>

      <div className="p-3 space-y-4">
        {/* Object Header matching Design HTML */}
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
          /* ========================================================= */
          /* ARTIST ROLE SPECIFIC VIEW: Layers, Colors, Sprite Config */
          /* ========================================================= */
          <div className="space-y-4">
            
            {/* Visual Depth Layering segment */}
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ 2.5D DEPTH LAYERS</div>
              
              <div className={`p-2.5 rounded border space-y-2.5 transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
              }`}>
                <p className={`text-[9px] leading-tight font-mono select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>
                  Setting the Z-depth automatically assigns the sprite layer: background (Z &lt; -10), gameplay stage (-10 to 10), or foreground overlay (Z &gt; 10).
                </p>

                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-sans ${theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-[#A0A0AA]'}`}>Layer depth (Z)</span>
                  <div className={`rounded px-2 py-1 flex items-center w-24 border transition-colors ${
                    theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
                  }`}>
                    <span className="text-[#7C3AED] mr-1.5 font-bold text-[9px]">Z</span>
                    <input
                      type="number"
                      step="1"
                      value={Number(selectedEntity.transform.position[2].toFixed(0))}
                      onChange={(e) => handleTransformChange('z', parseFloat(e.target.value) || 0)}
                      className={`bg-transparent text-right w-full font-mono text-[10px] focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-white'
                      }`}
                    />
                  </div>
                </div>

                <div className={`flex items-center justify-between text-[9px] font-mono py-1 border-t transition-colors ${
                  theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]/40'
                }`}>
                  <span className={`${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Active Sorting Layer:</span>
                  <span className="text-emerald-500 font-bold">
                    {selectedEntity.transform.position[2] < -10 ? 'BACKGROUND' : selectedEntity.transform.position[2] > 10 ? 'FOREGROUND' : 'GAMEPLAY'}
                  </span>
                </div>
              </div>
            </div>

            {/* Aesthetic Colors styling config */}
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ COLOR TAPPING</div>
              <div className={`flex items-center justify-between p-2 rounded border transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
              }`}>
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
                    className={`w-20 border px-1.5 py-0.5 rounded text-[10px] font-mono text-center transition-colors ${
                      theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#2D2D33] border-[#2D2D33] text-[#E0E0E6]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* 2D Sprite mapping/flipbook config */}
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ SPRITE FLIPBOOK</div>
              
              <div className={`p-2.5 rounded border space-y-2.5 transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
              }`}>
                <div>
                  <label className={`text-[9px] block mb-1 font-mono ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Spritesheet Pattern File</label>
                  <input
                    type="text"
                    value={selectedEntity.assetFilename || ''}
                    onChange={(e) => handleTextChange('assetFilename', e.target.value.trim() || null)}
                    placeholder="character_sheet.png"
                    className={`w-full px-2 py-1 rounded text-[11px] focus:outline-none focus:border-[#7C3AED] transition-colors ${
                      theme === 'LIGHT' 
                        ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' 
                        : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6] placeholder-[#71717A]'
                    }`}
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
                          type="number"
                          min="1"
                          value={selectedEntity.animationConfig?.frameCount ?? 1}
                          onChange={(e) => handleAnimationChange('frameCount', Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className={`w-full px-1 py-0.5 rounded text-[10px] font-mono focus:outline-none transition-colors ${
                            theme === 'LIGHT' 
                              ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' 
                              : 'bg-[#2D2D33] border border-[#232326] text-[#E0E0E6]'
                          }`}
                        />
                      </div>

                      <div>
                        <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Frame Time (s)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.001"
                          value={selectedEntity.animationConfig?.frameDuration ?? 0.083}
                          onChange={(e) => handleAnimationChange('frameDuration', Math.max(0.001, parseFloat(e.target.value) || 0.083))}
                          className={`w-full px-1 py-0.5 rounded text-[10px] font-mono focus:outline-none transition-colors ${
                            theme === 'LIGHT' 
                              ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' 
                              : 'bg-[#2D2D33] border border-[#232326] text-[#E0E0E6]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[9px]">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id="loop-anim"
                          checked={selectedEntity.animationConfig?.loop !== false}
                          onChange={(e) => handleAnimationChange('loop', e.target.checked)}
                          className="w-3 h-3 accent-[#7C3AED] rounded cursor-pointer"
                        />
                        <label htmlFor="loop-anim" className={`cursor-pointer ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>Repeat</label>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id="autoplay-anim"
                          checked={selectedEntity.animationConfig?.autoPlay !== false}
                          onChange={(e) => handleAnimationChange('autoPlay', e.target.checked)}
                          className="w-3 h-3 accent-[#7C3AED] rounded cursor-pointer"
                        />
                        <label htmlFor="autoplay-anim" className={`cursor-pointer ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>Autoplay</label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`text-[9px] text-center py-2 rounded border font-mono transition-colors ${
                    theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6] text-gray-400' : 'bg-[#141417] border-[#2D2D33]/40 text-[#71717A]'
                  }`}>
                    No active patterns bound. Default tint applied.
                  </div>
                )}
              </div>
            </div>

            <button className={`w-full py-1.5 border border-dashed text-[10px] rounded-sm mt-2 transition cursor-pointer font-semibold ${
              theme === 'LIGHT' 
                ? 'border-[#D1D1D6] text-[#55555C] hover:bg-[#F2F2F7] hover:text-[#1C1C1E]' 
                : 'border-[#2D2D33] text-[#71717A] hover:bg-[#252529] hover:text-[#E0E0E6]'
            }`}>
              Add Layer Component
            </button>
          </div>
        ) : (
          /* ========================================================= */
          /* DEVELOPER ROLE SPECIFIC VIEW: Physics, Colliders, Archetypes */
          /* ========================================================= */
          <div className="space-y-4">
            
            {/* Rigid colliders extrusion settings */}
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ PHYSICS EXTRUSION</div>
              
              <div className={`p-2.5 rounded border space-y-2.5 transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
              }`}>
                <div>
                  <label className={`text-[9px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Collision Profile</label>
                  <select
                    value={selectedEntity.type}
                    onChange={(e) => handleTextChange('type', e.target.value as GeometryType)}
                    className={`w-full px-1.5 py-1 rounded text-[10.5px] focus:outline-none shadow-sm font-mono transition-colors ${
                      theme === 'LIGHT' 
                        ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' 
                        : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6]'
                    }`}
                  >
                    <option value="BOX">BOX COLLIDER</option>
                    <option value="SPHERE">SPHERE RADIUS</option>
                    <option value="CAPSULE">CAPSULE CYLINDER</option>
                    <option value="MESH">CUSTOM CONVEX HULL</option>
                  </select>
                </div>

                {/* Scaled Bounds dimensions */}
                <div className="grid grid-cols-3 gap-1.5 font-mono">
                  <div>
                    <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Width</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(selectedEntity.transform.scale[0].toFixed(1))}
                      onChange={(e) => handleTransformChange('sx', parseFloat(e.target.value) || 1)}
                      className={`text-center w-full border focus:outline-none p-0.5 rounded text-[10px] transition-colors ${
                        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Height</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(selectedEntity.transform.scale[1].toFixed(1))}
                      onChange={(e) => handleTransformChange('sy', parseFloat(e.target.value) || 1)}
                      className={`text-center w-full border focus:outline-none p-0.5 rounded text-[10px] transition-colors ${
                        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <span className={`text-[8px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Depth</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(selectedEntity.transform.scale[2].toFixed(1))}
                      onChange={(e) => handleTransformChange('sz', parseFloat(e.target.value) || 1)}
                      className={`text-center w-full border focus:outline-none p-0.5 rounded text-[10px] transition-colors ${
                        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'
                      }`}
                    />
                  </div>
                </div>

                <div className={`flex items-center gap-1.5 pt-1 border-t transition-colors ${
                  theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]/40'
                }`}>
                  <input
                    type="checkbox"
                    id="isSensor-tick"
                    checked={selectedEntity.isSensor}
                    onChange={(e) => handleTextChange('isSensor', e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#7C3AED] rounded"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="isSensor-tick" className="text-[10px] flex items-center gap-1 cursor-pointer select-none font-bold">
                      <span className={theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-[#E0E0E6]'}>Sensor Overlap Mode</span>
                      <span title="Sensors ignore solid physical collision blocks and only emit overlap signals.">
                        <HelpCircle className="w-2.5 h-2.5 text-[#71717A]" />
                      </span>
                    </label>
                    <span className={`text-[8px] ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Turns solid boundaries into triggers.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Behavioral logic archetype */}
            <div className="space-y-2">
              <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ LOGIC ARCHETYPES</div>
              
              <div className={`p-2 rounded border transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
              }`}>
                <label className={`text-[9px] block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Logic Type</label>
                <select
                  value={selectedEntity.behavior}
                  onChange={(e) => handleTextChange('behavior', e.target.value as BehaviorType)}
                  className={`w-full px-1.5 py-1 rounded text-[10.5px] focus:outline-none shadow-sm font-mono transition-colors ${
                    theme === 'LIGHT' 
                      ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' 
                      : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6]'
                  }`}
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

            {/* Matrix transform variables */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className={`text-[10px] font-bold tracking-wider select-none ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>▼ SPATIAL MATRIX</div>
                <button
                  onClick={() => updateEntityTransform(selectedEntity.uuid, [0, 0, 0], [0, 0, 0], [1, 1, 1])}
                  className={`text-[9px] font-mono cursor-pointer transition-colors ${theme === 'LIGHT' ? 'text-[#7C3AED] hover:text-[#5B21B6]' : 'text-[#71717A] hover:text-white'}`}
                >
                  Reset Transform
                </button>
              </div>

              <div className={`p-2.5 rounded border space-y-2 font-mono transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
              }`}>
                {/* Position Cartesian coords X, Y */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded p-1 flex items-baseline border transition-colors ${
                    theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
                  }`}>
                    <span className="text-red-500 mr-1.5 font-bold select-none text-[8px]">X</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(selectedEntity.transform.position[0].toFixed(2))}
                      onChange={(e) => handleTransformChange('x', parseFloat(e.target.value) || 0)}
                      className={`bg-transparent text-right w-full font-mono text-[10px] focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-white'
                      }`}
                    />
                  </div>
                  <div className={`rounded p-1 flex items-baseline border transition-colors ${
                    theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
                  }`}>
                    <span className="text-emerald-500 mr-1.5 font-bold select-none text-[8px]">Y</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(selectedEntity.transform.position[1].toFixed(2))}
                      onChange={(e) => handleTransformChange('y', parseFloat(e.target.value) || 0)}
                      className={`bg-transparent text-right w-full font-mono text-[10px] focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-white'
                      }`}
                    />
                  </div>
                </div>

                {/* Rigid Rotation radians config */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[9px]">
                  <div className="flex flex-col">
                    <span className={`text-[8px] mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Pitch</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(selectedEntity.transform.rotation[0].toFixed(2))}
                      onChange={(e) => handleTransformChange('pitch', parseFloat(e.target.value) || 0)}
                      className={`text-center focus:outline-none p-0.5 rounded text-[9px] border transition-colors ${
                        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'
                      }`}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[8px] mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Yaw</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(selectedEntity.transform.rotation[1].toFixed(2))}
                      onChange={(e) => handleTransformChange('yaw', parseFloat(e.target.value) || 0)}
                      className={`text-center focus:outline-none p-0.5 rounded text-[9px] border transition-colors ${
                        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'
                      }`}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[8px] mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Roll</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(selectedEntity.transform.rotation[2].toFixed(2))}
                      onChange={(e) => handleTransformChange('roll', parseFloat(e.target.value) || 0)}
                      className={`text-center focus:outline-none p-0.5 rounded text-[9px] border transition-colors ${
                        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#141417] border-[#2D2D33] text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button className={`w-full py-1.5 border border-dashed text-[10px] rounded-sm mt-3 transition cursor-pointer font-semibold ${
              theme === 'LIGHT' 
                ? 'border-[#D1D1D6] text-[#55555C] hover:bg-[#F2F2F7] hover:text-[#1C1C1E]' 
                : 'border-[#2D2D33] text-[#71717A] hover:bg-[#252529] hover:text-[#E0E0E6]'
            }`}>
              Bake Physics Actor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
