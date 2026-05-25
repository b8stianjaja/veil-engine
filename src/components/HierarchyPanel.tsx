/**
 * @file src/components/HierarchyPanel.tsx
 * @description List hierarchy showing active entities, sorted into rendering layers for Artists or behavioral archetypes for Developers.
 * Allows instantiating/synthesizing new spatial nodes matching the current role.
 */

import React, { useState } from 'react';
import { useSpatialEditorStore } from '../app/store';
import { Entity, GeometryType, BehaviorType } from '../types';
import { Plus, Trash2, Box, Eye, EyeOff, Lock, Unlock, Paintbrush, Anchor, Sparkles, AlertOctagon, HelpCircle, Palette, Cpu, Pencil, Eraser } from 'lucide-react';

const BRUSH_PRESETS = [
  { label: 'Hero Knight', type: 'BOX' as const, behavior: 'PLAYER' as const, color: '#10B981', assetFilename: 'hero_sprite_sheet.png' },
  { label: 'Runic Pillar', type: 'BOX' as const, behavior: 'STATIC' as const, color: '#EF4444', assetFilename: 'stone_pillar.png' },
  { label: 'Crystal Core', type: 'MESH' as const, behavior: 'ROTATOR' as const, color: '#A855F7', assetFilename: 'nexus_core.png' },
  { label: 'Gold Star', type: 'SPHERE' as const, behavior: 'COLLECTIBLE' as const, color: '#FBF236', assetFilename: 'star.png' },
  { label: 'Spike Trap', type: 'CAPSULE' as const, behavior: 'HAZARD' as const, color: '#9E0B0B', assetFilename: 'spikes.png' },
  { label: 'Scenic Tree', type: 'MESH' as const, behavior: 'STATIC' as const, color: '#F472B6', assetFilename: 'cherry_tree.png' },
];

export default function HierarchyPanel({ workspace = 'ARTIST', theme = 'DARK' }: { workspace?: 'ARTIST' | 'DEVELOPER'; theme?: 'LIGHT' | 'DARK' }) {
  const {
    entities,
    sortingLayers,
    selectedUuid,
    setSelectedUuid,
    addEntity,
    removeEntity,
    layerVisibility,
    layerLock,
    activeDrawingLayer,
    selectedBrush,
    setLayerVisibility,
    setLayerLock,
    setActiveDrawingLayer,
    setSelectedBrush,
    activeToolMode,
    setToolMode,
    drawingStrokes,
    drawingTool,
    drawingColor,
    drawingWidth,
    drawingBrushStyle,
    setDrawingBrushStyle,
    setDrawingTool,
    setDrawingColor,
    setDrawingWidth,
    clearDrawingStrokes,
    activeViewportCamera,
    setViewportCamera,
    showGuideFrame,
    setShowGuideFrame,
    cameraFocusZLocked,
    setCameraFocusZLocked,
    cameraFocusSpot,
    setCameraFocusSpot,
    cameraSpots,
    addCameraSpot,
    removeCameraSpot,
    reorderEntityLayer
  } = useSpatialEditorStore();

  // HTML5 Drag and Drop systems for Layer visual stacking reordering
  const [draggedUuid, setDraggedUuid] = useState<string | null>(null);
  const [dragOverUuid, setDragOverUuid] = useState<string | null>(null);
  const [dragOverLayer, setDragOverLayer] = useState<'background' | 'gameplay' | 'foreground' | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, uuid: string) => {
    e.dataTransfer.setData('text/plain', uuid);
    setDraggedUuid(uuid);
  };

  const handleDragEnd = () => {
    setDraggedUuid(null);
    setDragOverUuid(null);
    setDragOverLayer(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, layer: 'background' | 'gameplay' | 'foreground', index: number, itemUuid?: string) => {
    e.preventDefault();
    setDragOverLayer(layer);
    setDragOverIndex(index);
    if (itemUuid) {
      setDragOverUuid(itemUuid);
    } else {
      setDragOverUuid(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetLayer: 'background' | 'gameplay' | 'foreground', targetIndex: number) => {
    e.preventDefault();
    const uuid = e.dataTransfer.getData('text/plain') || draggedUuid;
    if (!uuid) return;

    let finalIndex = targetIndex;
    if (targetIndex === -1) {
      finalIndex = sortingLayers[targetLayer].length;
    }

    reorderEntityLayer(uuid, targetLayer, finalIndex);
    handleDragEnd();
  };

  const [newEntityName, setNewEntityName] = useState<string>('');
  const [newEntityType, setNewEntityType] = useState<GeometryType>('BOX');
  const [newEntityBehavior, setNewEntityBehavior] = useState<BehaviorType>('STATIC');
  
  // Dynamic camera anchor state properties
  const [newSpotName, setNewSpotName] = useState<string>('');
  const [newSpotX, setNewSpotX] = useState<number>(cameraFocusSpot?.[0] ?? 0);
  const [newSpotY, setNewSpotY] = useState<number>(cameraFocusSpot?.[1] ?? 0);

  React.useEffect(() => {
    if (cameraFocusSpot) {
      setNewSpotX(cameraFocusSpot[0]);
      setNewSpotY(cameraFocusSpot[1]);
    }
  }, [cameraFocusSpot]);
  
  // Artist-specific preset options for new canvas elements
  const [artistPreset, setArtistPreset] = useState<'SPRITE' | 'BACKGROUND' | 'DECORATION' | 'PARTICLE'>('SPRITE');
  const [artistColor, setArtistColor] = useState<string>('#3B82F6');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newEntityName.trim() || `${workspace === 'ARTIST' ? 'Sprite' : 'Actor'}_${Math.random().toString(36).substring(7).toUpperCase()}`;

    let behavior: BehaviorType = newEntityBehavior;
    let type: GeometryType = newEntityType;
    let color = artistColor;
    let zCoord = 0;

    if (workspace === 'ARTIST') {
      // Create defaults suited for designers
      if (artistPreset === 'BACKGROUND') {
        zCoord = -15; // Far Background
        behavior = 'STATIC';
        type = 'BOX';
      } else if (artistPreset === 'DECORATION') {
        zCoord = -5;
        behavior = 'STATIC';
        type = 'MESH';
      } else if (artistPreset === 'PARTICLE') {
        zCoord = 12; // Foreground overlay
        behavior = 'ROTATOR';
        type = 'SPHERE';
      } else {
        zCoord = 0; // Gameplay depth
        behavior = 'PLAYER';
        type = 'BOX';
      }
    } else {
      // Logic behavior rules for developers
      if (behavior === 'PLAYER') color = '#10B981';
      else if (behavior === 'ROTATOR') color = '#A855F7';
      else if (behavior === 'COLLECTIBLE') {
        zCoord = -12;
        color = '#FBF236';
      } else if (behavior === 'HAZARD') {
        zCoord = 12;
        color = '#EF4444';
      } else if (behavior === 'TRIGGER') {
        color = '#EAB308';
      }
    }

    const newEnt: Entity = {
      uuid: `uuid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      type,
      behavior,
      isSensor: ['COLLECTIBLE', 'HAZARD', 'TRIGGER'].includes(behavior),
      color,
      transform: {
        position: [(Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, zCoord],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      assetFilename: workspace === 'ARTIST' ? 'character_sheet.png' : null,
      animationConfig: workspace === 'ARTIST' ? {
        frameCount: 4,
        frameDuration: 0.1,
        loop: true,
        autoPlay: true
      } : null
    };

    addEntity(newEnt);
    setNewEntityName('');
  };

  const renderIcon = (behavior: BehaviorType) => {
    switch (behavior) {
      case 'PLAYER':
        return <Anchor className="w-3.5 h-3.5 text-emerald-500" />;
      case 'ROTATOR':
        return <Sparkles className="w-3.5 h-3.5 text-[#A855F7]" />;
      case 'COLLECTIBLE':
        return <Eye className="w-3.5 h-3.5 text-yellow-500" />;
      case 'HAZARD':
        return <AlertOctagon className="w-3.5 h-3.5 text-red-500" />;
      case 'TRIGGER':
        return <HelpCircle className="w-3.5 h-3.5 text-yellow-500" />;
      case 'STATIC':
      default:
        return <Box className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  // Grouping for Developer View: Group by Behavior Archetype
  const allNodes = Object.values(entities);
  const developerGroups = {
    kinematic: allNodes.filter(e => ['PLAYER', 'ROTATOR'].includes(e.behavior)),
    solidRigid: allNodes.filter(e => e.behavior === 'STATIC'),
    triggersAndSensors: allNodes.filter(e => ['COLLECTIBLE', 'HAZARD', 'TRIGGER'].includes(e.behavior))
  };

  return (
    <div className={`w-full h-full flex flex-col select-none transition-colors ${
      theme === 'LIGHT' ? 'bg-[#FFFFFF] text-[#1C1C1E]' : 'bg-[#1A1A1E] text-[#E0E0E6]'
    }`} id="hierarchy-panel">
      {/* Header section matching Design HTML */}
      <div className={`px-3 py-1.5 border-b flex justify-between items-center shrink-0 transition-colors ${
        theme === 'LIGHT' ? 'bg-[#E5E5EA] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
      }`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>
          {workspace === 'ARTIST' ? <Palette className="w-3 h-3 text-[#7C3AED]" /> : <Cpu className="w-3 h-3 text-[#7C3AED]" />}
          <span>{workspace === 'ARTIST' ? 'Layers' : 'Schemas'}</span>
        </span>
        <span className="text-[#71717A] text-xs font-mono font-bold font-semibold cursor-default select-none">+</span>
      </div>

      {/* Layer Groups / Archetypes Display */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3.5 pr-1 scrollbar-thin">
        {workspace === 'ARTIST' ? (
          /* ========================================================= */
          /* ARTIST WORKSPACE: GROUP BY GRAPHICAL LAYER (Z DEPTHS)     */
          /* ========================================================= */
          <>
            {/* Background Render Layer */}
            <div 
              onDragOver={(e) => handleDragOver(e, 'background', -1)}
              onDrop={(e) => handleDrop(e, 'background', -1)}
              className={`border rounded-sm transition-all p-1 md:p-1.5 ${
                dragOverLayer === 'background' && dragOverIndex === -1
                  ? 'border-purple-500 bg-[#7C3AED]/5 shadow-sm'
                  : 'border-transparent hover:border-purple-500/10'
              }`}
            >
              <div className={`flex items-center justify-between text-[9px] font-mono uppercase tracking-wider mb-1 px-1.5 py-1 rounded-sm transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] text-[#55555C]' : 'bg-[#252529] text-[#71717A]'
              }`}>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveDrawingLayer('background')}
                    className={`p-0.5 rounded cursor-pointer transition ${
                      activeDrawingLayer === 'background'
                        ? 'text-purple-500 bg-[#7C3AED]/20'
                        : 'text-gray-400 hover:text-purple-400'
                    }`}
                    title="Set Background as Active Paint Target"
                  >
                    <Paintbrush className="w-2.5 h-2.5" />
                  </button>
                  <span className={activeDrawingLayer === 'background' ? 'text-purple-400 font-bold' : ''}>Background Canvas</span>
                </div>
                
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <span className="opacity-75 font-bold mr-1">{sortingLayers.background.length}</span>
                  <button
                    onClick={() => setLayerVisibility('background', !layerVisibility.background)}
                    className="p-0.5 rounded text-gray-400 hover:text-white transition cursor-pointer"
                    title={layerVisibility.background ? "Mute/Hide layer elements" : "Unmute/Show layer elements"}
                  >
                    {layerVisibility.background ? <Eye className="w-2.5 h-2.5 text-emerald-500" /> : <EyeOff className="w-2.5 h-2.5 text-red-400" />}
                  </button>
                  <button
                    onClick={() => setLayerLock('background', !layerLock.background)}
                    className="p-0.5 rounded text-gray-400 hover:text-white transition cursor-pointer"
                    title={layerLock.background ? "Unlock layer adjustments" : "Lock layer adjustments"}
                  >
                    {layerLock.background ? <Lock className="w-2.5 h-2.5 text-red-500" /> : <Unlock className="w-2.5 h-2.5 text-gray-500 opacity-60" />}
                  </button>
                </div>
              </div>
              <div className="space-y-0.5 pl-1">
                {sortingLayers.background.map((uuid, index) => {
                  const ent = entities[uuid];
                  if (!ent) return null;
                  const isSelected = selectedUuid === uuid;
                  const isDragOverMe = dragOverUuid === uuid && dragOverLayer === 'background';
                  const isBeingDragged = draggedUuid === uuid;
                  return (
                    <div
                      key={uuid}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, uuid)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, 'background', index, uuid)}
                      onDrop={(e) => handleDrop(e, 'background', index)}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm cursor-grab transition text-[11px] font-mono select-none relative ${
                        isBeingDragged ? 'opacity-40 border border-dashed border-purple-500/30' : ''
                      } ${
                        isDragOverMe 
                          ? 'border-t-2 border-purple-500 bg-purple-500/15' 
                          : isSelected 
                            ? 'bg-[#7C3AED] text-white shadow-sm font-semibold' 
                            : theme === 'LIGHT' 
                              ? 'hover:bg-[#F2F2F7] text-[#55555C] hover:text-[#1C1C1E]' 
                              : 'hover:bg-[#2D2D33] text-[#A0A0AA] hover:text-[#E0E0E6]'
                      }`}
                      onClick={() => setSelectedUuid(uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className="truncate">{ent.name}</span>
                        {layerLock.background && <Lock className="w-2 h-2 text-red-500 opacity-70 shrink-0" />}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEntity(uuid);
                        }}
                        className={`p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500`}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
                {sortingLayers.background.length === 0 && (
                  <div className={`text-[9px] italic pl-2 py-0.5 ${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>No layers active</div>
                )}
              </div>
            </div>

            {/* Gameplay Render Layer */}
            <div 
              onDragOver={(e) => handleDragOver(e, 'gameplay', -1)}
              onDrop={(e) => handleDrop(e, 'gameplay', -1)}
              className={`border rounded-sm transition-all p-1 md:p-1.5 ${
                dragOverLayer === 'gameplay' && dragOverIndex === -1
                  ? 'border-purple-500 bg-[#7C3AED]/5 shadow-sm'
                  : 'border-transparent hover:border-purple-500/10'
              }`}
            >
              <div className={`flex items-center justify-between text-[9px] font-mono uppercase tracking-wider mb-1 px-1.5 py-1 rounded-sm transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] text-[#55555C]' : 'bg-[#252529] text-[#71717A]'
              }`}>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveDrawingLayer('gameplay')}
                    className={`p-0.5 rounded cursor-pointer transition ${
                      activeDrawingLayer === 'gameplay'
                        ? 'text-purple-500 bg-[#7C3AED]/20'
                        : 'text-gray-400 hover:text-purple-400'
                    }`}
                    title="Set Gameplay as Active Paint Target"
                  >
                    <Paintbrush className="w-2.5 h-2.5" />
                  </button>
                  <span className={activeDrawingLayer === 'gameplay' ? 'text-purple-400 font-bold' : ''}>Gameplay Center</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="opacity-75 font-bold mr-1">{sortingLayers.gameplay.length}</span>
                  <button
                    onClick={() => setLayerVisibility('gameplay', !layerVisibility.gameplay)}
                    className="p-0.5 rounded text-gray-400 hover:text-white transition cursor-pointer"
                    title={layerVisibility.gameplay ? "Mute Gameplay" : "Show Gameplay"}
                  >
                    {layerVisibility.gameplay ? <Eye className="w-2.5 h-2.5 text-emerald-500" /> : <EyeOff className="w-2.5 h-2.5 text-red-400" />}
                  </button>
                  <button
                    onClick={() => setLayerLock('gameplay', !layerLock.gameplay)}
                    className="p-0.5 rounded text-gray-400 hover:text-white transition cursor-pointer"
                    title={layerLock.gameplay ? "Unlock Gameplay" : "Lock Gameplay"}
                  >
                    {layerLock.gameplay ? <Lock className="w-2.5 h-2.5 text-red-500" /> : <Unlock className="w-2.5 h-2.5 text-gray-500 opacity-60" />}
                  </button>
                </div>
              </div>
              <div className="space-y-0.5 pl-1">
                {sortingLayers.gameplay.map((uuid, index) => {
                  const ent = entities[uuid];
                  if (!ent) return null;
                  const isSelected = selectedUuid === uuid;
                  const isDragOverMe = dragOverUuid === uuid && dragOverLayer === 'gameplay';
                  const isBeingDragged = draggedUuid === uuid;
                  return (
                    <div
                      key={uuid}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, uuid)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, 'gameplay', index, uuid)}
                      onDrop={(e) => handleDrop(e, 'gameplay', index)}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm cursor-grab transition text-[11px] font-mono select-none relative ${
                        isBeingDragged ? 'opacity-40 border border-dashed border-purple-500/30' : ''
                      } ${
                        isDragOverMe 
                          ? 'border-t-2 border-purple-500 bg-purple-500/15' 
                          : isSelected 
                            ? 'bg-[#7C3AED] text-white shadow-sm font-semibold' 
                            : theme === 'LIGHT' 
                              ? 'hover:bg-[#F2F2F7] text-[#55555C] hover:text-[#1C1C1E]' 
                              : 'hover:bg-[#2D2D33] text-[#A0A0AA] hover:text-[#E0E0E6]'
                      }`}
                      onClick={() => setSelectedUuid(uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className="truncate font-semibold">{ent.name}</span>
                        {layerLock.gameplay && <Lock className="w-2 h-2 text-red-500 opacity-70 shrink-0" />}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEntity(uuid);
                        }}
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
                {sortingLayers.gameplay.length === 0 && (
                  <div className={`text-[9px] italic pl-2 py-0.5 ${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>No center templates</div>
                )}
              </div>
            </div>

            {/* Foreground Render Layer */}
            <div 
              onDragOver={(e) => handleDragOver(e, 'foreground', -1)}
              onDrop={(e) => handleDrop(e, 'foreground', -1)}
              className={`border rounded-sm transition-all p-1 md:p-1.5 ${
                dragOverLayer === 'foreground' && dragOverIndex === -1
                  ? 'border-purple-500 bg-[#7C3AED]/5 shadow-sm'
                  : 'border-transparent hover:border-purple-500/10'
              }`}
            >
              <div className={`flex items-center justify-between text-[9px] font-mono uppercase tracking-wider mb-1 px-1.5 py-1 rounded-sm transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] text-[#55555C]' : 'bg-[#252529] text-[#71717A]'
              }`}>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveDrawingLayer('foreground')}
                    className={`p-0.5 rounded cursor-pointer transition ${
                      activeDrawingLayer === 'foreground'
                        ? 'text-purple-500 bg-[#7C3AED]/20'
                        : 'text-gray-400 hover:text-purple-400'
                    }`}
                    title="Set Foreground as Active Paint Target"
                  >
                    <Paintbrush className="w-2.5 h-2.5" />
                  </button>
                  <span className={activeDrawingLayer === 'foreground' ? 'text-purple-400 font-bold' : ''}>Foreground Overlays</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="opacity-75 font-bold mr-1">{sortingLayers.foreground.length}</span>
                  <button
                    onClick={() => setLayerVisibility('foreground', !layerVisibility.foreground)}
                    className="p-0.5 rounded text-gray-400 hover:text-white transition cursor-pointer"
                    title={layerVisibility.foreground ? "Mute Foreground" : "Show Foreground"}
                  >
                    {layerVisibility.foreground ? <Eye className="w-2.5 h-2.5 text-emerald-500" /> : <EyeOff className="w-2.5 h-2.5 text-red-400" />}
                  </button>
                  <button
                    onClick={() => setLayerLock('foreground', !layerLock.foreground)}
                    className="p-0.5 rounded text-gray-400 hover:text-white transition cursor-pointer"
                    title={layerLock.foreground ? "Unlock Foreground" : "Lock Foreground"}
                  >
                    {layerLock.foreground ? <Lock className="w-2.5 h-2.5 text-red-500" /> : <Unlock className="w-2.5 h-2.5 text-gray-500 opacity-60" />}
                  </button>
                </div>
              </div>
              <div className="space-y-0.5 pl-1">
                {sortingLayers.foreground.map((uuid, index) => {
                  const ent = entities[uuid];
                  if (!ent) return null;
                  const isSelected = selectedUuid === uuid;
                  const isDragOverMe = dragOverUuid === uuid && dragOverLayer === 'foreground';
                  const isBeingDragged = draggedUuid === uuid;
                  return (
                    <div
                      key={uuid}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, uuid)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, 'foreground', index, uuid)}
                      onDrop={(e) => handleDrop(e, 'foreground', index)}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm cursor-grab transition text-[11px] font-mono select-none relative ${
                        isBeingDragged ? 'opacity-40 border border-dashed border-purple-500/30' : ''
                      } ${
                        isDragOverMe 
                          ? 'border-t-2 border-purple-500 bg-purple-500/15' 
                          : isSelected 
                            ? 'bg-[#7C3AED] text-white shadow-sm font-semibold' 
                            : theme === 'LIGHT' 
                              ? 'hover:bg-[#F2F2F7] text-[#55555C] hover:text-[#1C1C1E]' 
                              : 'hover:bg-[#2D2D33] text-[#A0A0AA] hover:text-[#E0E0E6]'
                      }`}
                      onClick={() => setSelectedUuid(uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className="truncate">{ent.name}</span>
                        {layerLock.foreground && <Lock className="w-2 h-2 text-red-500 opacity-70 shrink-0" />}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEntity(uuid);
                        }}
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
                {sortingLayers.foreground.length === 0 && (
                  <div className={`text-[9px] italic pl-2 py-0.5 ${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>No foreground overlays</div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ========================================================= */
          /* DEVELOPER WORKSPACE: GROUP BY PHYSICS & BEHAVIOR CLASS   */
          /* ========================================================= */
          <>
            {/* Kinematic Controllers System */}
            <div>
              <div className={`flex items-center justify-between text-[9px] font-mono uppercase tracking-wider mb-1 px-1.5 py-0.5 rounded-sm transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] text-[#55555C]' : 'bg-[#252529] text-[#71717A]'
              }`}>
                <span>Kinematic (Actors)</span>
                <span className="opacity-75">{developerGroups.kinematic.length}</span>
              </div>
              <div className="space-y-0.5 pl-1">
                {developerGroups.kinematic.map((ent) => {
                  const isSelected = selectedUuid === ent.uuid;
                  return (
                    <div
                      key={ent.uuid}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm cursor-pointer transition text-[11px] font-mono ${
                        isSelected 
                          ? 'bg-[#7C3AED] text-white shadow-sm' 
                          : theme === 'LIGHT' 
                            ? 'hover:bg-[#F2F2F7] text-[#55555C] hover:text-[#1C1C1E]' 
                            : 'hover:bg-[#2D2D33] text-[#A0A0AA] hover:text-[#E0E0E6]'
                      }`}
                      onClick={() => setSelectedUuid(ent.uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className="truncate font-bold text-emerald-500">{ent.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEntity(ent.uuid);
                        }}
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
                {developerGroups.kinematic.length === 0 && (
                  <div className={`text-[9px] italic pl-2 py-0.5 ${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>No kinetic class actors</div>
                )}
              </div>
            </div>

            {/* Solid Rigid Body Colliders */}
            <div>
              <div className={`flex items-center justify-between text-[9px] font-mono uppercase tracking-wider mb-1 px-1.5 py-0.5 rounded-sm transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] text-[#55555C]' : 'bg-[#252529] text-[#71717A]'
              }`}>
                <span>Static (Obstacles)</span>
                <span className="opacity-75">{developerGroups.solidRigid.length}</span>
              </div>
              <div className="space-y-0.5 pl-1">
                {developerGroups.solidRigid.map((ent) => {
                  const isSelected = selectedUuid === ent.uuid;
                  return (
                    <div
                      key={ent.uuid}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm cursor-pointer transition text-[11px] font-mono ${
                        isSelected 
                          ? 'bg-[#7C3AED] text-white shadow-sm' 
                          : theme === 'LIGHT' 
                            ? 'hover:bg-[#F2F2F7] text-[#55555C] hover:text-[#1C1C1E]' 
                            : 'hover:bg-[#2D2D33] text-[#A0A0AA] hover:text-[#E0E0E6]'
                      }`}
                      onClick={() => setSelectedUuid(ent.uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className="truncate">{ent.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEntity(ent.uuid);
                        }}
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
                {developerGroups.solidRigid.length === 0 && (
                  <div className={`text-[9px] italic pl-2 py-0.5 ${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>No solid rigid bodies loaded</div>
                )}
              </div>
            </div>

            {/* Triggers, Sensors and Damage Zones */}
            <div>
              <div className={`flex items-center justify-between text-[9px] font-mono uppercase tracking-wider mb-1 px-1.5 py-0.5 rounded-sm transition-colors ${
                theme === 'LIGHT' ? 'bg-[#F2F2F7] text-[#55555C]' : 'bg-[#252529] text-[#71717A]'
              }`}>
                <span>Sensory & Event Triggers</span>
                <span className="opacity-75">{developerGroups.triggersAndSensors.length}</span>
              </div>
              <div className="space-y-0.5 pl-1">
                {developerGroups.triggersAndSensors.map((ent) => {
                  const isSelected = selectedUuid === ent.uuid;
                  return (
                    <div
                      key={ent.uuid}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm cursor-pointer transition text-[11px] font-mono ${
                        isSelected 
                          ? 'bg-[#7C3AED] text-white shadow-sm' 
                          : theme === 'LIGHT' 
                            ? 'hover:bg-[#F2F2F7] text-[#55555C] hover:text-[#1C1C1E]' 
                            : 'hover:bg-[#2D2D33] text-[#A0A0AA] hover:text-[#E0E0E6]'
                      }`}
                      onClick={() => setSelectedUuid(ent.uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className={`truncate font-semibold ${theme === 'LIGHT' ? 'text-yellow-600' : 'text-yellow-400'}`}>{ent.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEntity(ent.uuid);
                        }}
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
                {developerGroups.triggersAndSensors.length === 0 && (
                  <div className={`text-[9px] italic pl-2 py-0.5 ${theme === 'LIGHT' ? 'text-[#8E8E93]' : 'text-[#71717A]'}`}>No trigger metrics mapped</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* role-Isolated Node Synthesis Footer Form */}
      <form onSubmit={handleAdd} className={`p-2.5 border-t transition-colors ${
        theme === 'LIGHT' ? 'border-[#D1D1D6] bg-[#FFFFFF]' : 'border-[#2D2D33] bg-[#1A1A1E]'
      } space-y-2.5 shrink-0`}>
        
        {workspace === 'ARTIST' && (
          /* WORKSPACE MODE TOGGLES */
          <div className={`flex border rounded-sm p-0.5 overflow-hidden font-mono text-[9px] shrink-0 transition-colors ${
            theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#141417] border-[#2D2D33]'
          }`}>
            <button
              type="button"
              onClick={() => setToolMode('SELECT')}
              className={`flex-1 py-1 rounded-xs transition text-center cursor-pointer ${
                activeToolMode !== 'DRAW'
                  ? theme === 'LIGHT' ? 'bg-[#7C3AED]/15 text-[#7C3AED] font-bold' : 'bg-[#7C3AED]/20 text-[#D8B4FE] font-bold'
                  : theme === 'LIGHT' ? 'text-zinc-500 hover:text-black' : 'text-gray-400 hover:text-white'
              }`}
              title="Transform, translate, rotate, and scale nodes manually on the canvas"
            >
              Selection View
            </button>
            <button
              type="button"
              onClick={() => setToolMode('DRAW')}
              className={`flex-1 py-1 rounded-xs transition text-center cursor-pointer ${
                activeToolMode === 'DRAW'
                  ? 'bg-[#7C3AED] text-white font-bold animate-pulse'
                  : theme === 'LIGHT' ? 'text-zinc-650 hover:text-black' : 'text-gray-300 hover:text-white'
              }`}
              title="Activate the Paint Brush to draw directly onto the grid layers"
            >
              🎨 Paint Brush Mode
            </button>
          </div>
        )}

        {workspace === 'ARTIST' && activeToolMode === 'DRAW' ? (
          /* DESIGN DRAWING & SPAWNER DECK */
          <div className={`animate-fade-in border p-2 rounded-sm space-y-2.5 transition-colors ${
            theme === 'LIGHT'
              ? 'bg-[#F2F2F7] border-[#D1D1D6] text-zinc-800'
              : 'bg-[#131317] border-[#2D2D33] text-[#E0E0E6]'
          }`}>
            {/* Sub-mode Tab Switcher */}
            <div className={`flex p-0.5 rounded border text-[9px] font-mono transition-colors ${
              theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#222227] border-[#2D2D33]'
            }`}>
              <button
                type="button"
                onClick={() => setDrawingTool('pencil')}
                className={`flex-1 py-1 px-1 rounded-sm text-center font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  drawingTool !== 'mesh'
                    ? 'bg-[#7C3AED] text-white'
                    : theme === 'LIGHT' ? 'text-zinc-500 hover:text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Pencil className="w-2.5 h-2.5 text-purple-300" />
                <span>Pencil Draw</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawingTool('mesh')}
                className={`flex-1 py-1 px-1 rounded-sm text-center font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  drawingTool === 'mesh'
                    ? 'bg-[#7C3AED] text-white'
                    : theme === 'LIGHT' ? 'text-zinc-500 hover:text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Box className="w-2.5 h-2.5 text-emerald-400" />
                <span>Collider Brush</span>
              </button>
            </div>

            {drawingTool !== 'mesh' ? (
              /* PENCIL & ERASER STUDIO PANEL */
              <div className="space-y-2.5">
                {/* Pencil / Eraser Selector */}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDrawingTool('pencil')}
                    className={`flex-1 py-1.5 rounded-sm border flex items-center justify-center gap-1.5 text-[10px] font-bold cursor-pointer transition-colors ${
                      drawingTool === 'pencil'
                        ? theme === 'LIGHT'
                          ? 'bg-purple-100 border-purple-400 text-purple-700'
                          : 'bg-purple-600/30 border-purple-500 text-purple-300'
                        : theme === 'LIGHT'
                          ? 'bg-white border-[#D1D1D6] text-zinc-650 hover:bg-zinc-100'
                          : 'bg-[#222227] border-transparent text-[#A0A0AA] hover:bg-[#2A2A30]'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Pencil</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawingTool('eraser')}
                    className={`flex-1 py-1.5 rounded-sm border flex items-center justify-center gap-1.5 text-[10px] font-bold cursor-pointer transition-colors ${
                      drawingTool === 'eraser'
                        ? theme === 'LIGHT'
                          ? 'bg-rose-100 border-rose-400 text-rose-700'
                          : 'bg-rose-600/30 border-rose-500 text-rose-300'
                        : theme === 'LIGHT'
                          ? 'bg-white border-[#D1D1D6] text-zinc-650 hover:bg-zinc-100'
                          : 'bg-[#222227] border-transparent text-[#A0A0AA] hover:bg-[#2A2A30]'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Eraser</span>
                  </button>
                </div>

                {/* Color Swatch Panel */}
                {drawingTool === 'pencil' && (
                  <div className="space-y-1">
                    <label className={`text-[8px] font-mono uppercase tracking-wide block font-bold ${
                      theme === 'LIGHT' ? 'text-zinc-600' : 'text-[#71717A]'
                    }`}>Pick Color</label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        '#A855F7', // Deep Lavender
                        '#F87171', // Soft Red
                        '#FBBF24', // Sunshine Gold
                        '#60A5FA', // Sky Blue
                        '#34D399', // Cyber Mint
                        '#FFFFFF', // White Accent
                      ].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDrawingColor(c)}
                          className={`w-6 h-6 rounded-sm cursor-pointer transition-all border ${
                            theme === 'LIGHT' ? 'border-zinc-300' : 'border-gray-900'
                          } ${
                            drawingColor.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-purple-500 scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                      {/* Spectrum input */}
                      <input
                        type="color"
                        value={drawingColor}
                        onChange={(e) => setDrawingColor(e.target.value)}
                        className={`w-6 h-6 rounded-sm cursor-pointer bg-transparent p-0 border ${
                          theme === 'LIGHT' ? 'border-zinc-300' : 'border-gray-900'
                        }`}
                        title="Custom Color"
                      />
                    </div>
                  </div>
                )}

                {/* Stroke Thickness Slider */}
                <div className="space-y-1">
                  <div className={`flex justify-between text-[8px] font-mono uppercase font-bold ${
                    theme === 'LIGHT' ? 'text-zinc-600' : 'text-[#71717A]'
                  }`}>
                    <span>{drawingTool === 'pencil' ? 'Line Width' : 'Eraser Radius'}</span>
                    <span className="text-purple-600 dark:text-purple-400 font-extrabold">{drawingWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={drawingWidth}
                    onChange={(e) => setDrawingWidth(parseInt(e.target.value, 10))}
                    className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-[#7C3AED] ${
                      theme === 'LIGHT' ? 'bg-[#D1D1D6]' : 'bg-[#222227]'
                    }`}
                  />
                </div>

                {/* Visual Brush Selector */}
                {drawingTool === 'pencil' && (
                  <div className="space-y-1">
                    <div className={`flex justify-between text-[8px] font-mono uppercase font-bold ${
                      theme === 'LIGHT' ? 'text-[#1C1C1E]' : 'text-[#A0A0AA]'
                    }`}>
                      <span>Brush type stencil</span>
                      <span className="text-[#8B5CF6] font-extrabold">{drawingBrushStyle.toUpperCase()}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'solid', label: '✏️ Solid' },
                        { id: 'calligraphy', label: '✒️ Chisel' },
                        { id: 'neon', label: '✨ Neon' },
                        { id: 'charcoal', label: '🖍️ Crayon' },
                        { id: 'star', label: '⭐ Sparkle' },
                        { id: 'dash', label: '🏁 Dash' }
                      ].map((item) => {
                        const active = drawingBrushStyle === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setDrawingBrushStyle(item.id as any)}
                            className={`px-1 py-1 rounded-[3px] border text-[8px] font-mono font-bold transition-all text-center cursor-pointer ${
                              active
                                ? 'bg-purple-500/15 border-purple-500/60 text-purple-600 dark:text-purple-400 scale-[1.02]'
                                : theme === 'LIGHT'
                                  ? 'bg-[#F2F2F7] border-[#D1D1D6] text-zinc-700 hover:bg-[#E5E5EA]'
                                  : 'bg-[#18181A]/80 border-[#2D2D33]/60 text-[#A0A0AA] hover:bg-[#222227] hover:text-white'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Artist Workspace Drafting Guidance (Camera Locks & Presets) */}
                <div className={`p-2 rounded border space-y-2 transition-colors ${
                  theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#1C1C22] border-[#2D2D33]'
                }`}>
                  <span className={`text-[8px] font-mono uppercase tracking-wide block font-bold ${
                    theme === 'LIGHT' ? 'text-zinc-650' : 'text-[#71717A]'
                  }`}>Drafting View Alignment</span>
                  
                  <div className="flex flex-col gap-1.5 text-[10px]">
                    {/* Flat 2D Snap Toggle */}
                    <button
                      type="button"
                      onClick={() => setViewportCamera(activeViewportCamera === 'FLAT_2D' ? 'ISOMETRIC' : 'FLAT_2D')}
                      className={`py-1 px-2 rounded-sm border flex items-center justify-between font-bold cursor-pointer transition ${
                        activeViewportCamera === 'FLAT_2D'
                          ? theme === 'LIGHT'
                            ? 'bg-purple-100 border-[#7C3AED]/60 text-purple-750 text-purple-800'
                            : 'bg-purple-600/35 border-purple-500 text-purple-300'
                          : theme === 'LIGHT'
                            ? 'bg-[#F2F2F7] border-zinc-250 text-zinc-700 hover:bg-[#E5E5EA] hover:text-black'
                            : 'bg-[#222227] border-transparent text-[#A0A0AA] hover:bg-[#2A2A30] hover:text-[#FFFFFF]'
                      }`}
                    >
                      <span className="font-sans">2D Flat Mode (Pencil Focus)</span>
                      <span className={`font-mono text-[9px] px-1 py-0.5 rounded transition-colors ${
                        theme === 'LIGHT' ? 'bg-zinc-255 bg-black/5 text-zinc-600' : 'bg-black/40 text-gray-400'
                      }`}>
                        {activeViewportCamera === 'FLAT_2D' ? 'ACTIVE' : 'OFF'}
                      </span>
                    </button>

                    {/* Camera Z Lock Toggle */}
                    <button
                      type="button"
                      onClick={() => setCameraFocusZLocked(!cameraFocusZLocked)}
                      className={`py-1 px-2 rounded-sm border flex items-center justify-between font-bold cursor-pointer transition ${
                        cameraFocusZLocked
                          ? theme === 'LIGHT'
                            ? 'bg-purple-100 border-[#7C3AED]/60 text-purple-750 text-purple-800'
                            : 'bg-purple-600/35 border-purple-500 text-purple-300'
                          : theme === 'LIGHT'
                            ? 'bg-[#F2F2F7] border-zinc-250 text-zinc-700 hover:bg-[#E5E5EA] hover:text-black'
                            : 'bg-[#222227] border-transparent text-[#A0A0AA] hover:bg-[#2A2A30] hover:text-[#FFFFFF]'
                      }`}
                    >
                      <span className="font-sans">Lock Z-Depth Target Focus</span>
                      <span className={`font-mono text-[9px] px-1 py-0.5 rounded transition-colors ${
                        theme === 'LIGHT' ? 'bg-zinc-255 bg-black/5 text-zinc-600' : 'bg-black/40 text-gray-400'
                      }`}>
                        {cameraFocusZLocked ? 'LOCKED' : 'OFF'}
                      </span>
                    </button>

                    {/* Crop Guide Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowGuideFrame(!showGuideFrame)}
                      className={`py-1 px-2 rounded-sm border flex items-center justify-between font-bold cursor-pointer transition ${
                        showGuideFrame
                          ? theme === 'LIGHT'
                            ? 'bg-purple-100 border-[#7C3AED]/60 text-purple-750 text-purple-800'
                            : 'bg-purple-600/35 border-purple-500 text-purple-300'
                          : theme === 'LIGHT'
                            ? 'bg-[#F2F2F7] border-zinc-250 text-zinc-700 hover:bg-[#E5E5EA] hover:text-black'
                            : 'bg-[#222227] border-transparent text-[#A0A0AA] hover:bg-[#2A2A30] hover:text-[#FFFFFF]'
                      }`}
                    >
                      <span className="font-sans">Playfield Crop (16:9 bounds)</span>
                      <span className={`font-mono text-[9px] px-1 py-0.5 rounded transition-colors ${
                        theme === 'LIGHT' ? 'bg-zinc-255 bg-black/5 text-zinc-600' : 'bg-black/40 text-gray-400'
                      }`}>
                        {showGuideFrame ? 'SHOWING' : 'MUTED'}
                      </span>
                    </button>

                    {/* Camera Spot Anchor Presets */}
                    <div className={`pt-2 border-t space-y-2 transition-colors ${
                      theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]/65'
                    }`}>
                      <div className="flex justify-between items-center">
                        <label className="text-[7.5px] font-mono text-[#8B5CF6] uppercase tracking-wider font-bold block mb-0.5">📷 Scene Spot Anchors & Presets</label>
                        <span className="text-[7.5px] font-mono text-[#71717A]">({cameraSpots?.length || 0} registered)</span>
                      </div>

                      {/* Presets List */}
                      <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
                        {(cameraSpots || []).map((s) => {
                          const isActive = cameraFocusSpot && cameraFocusSpot[0] === s.spot[0] && cameraFocusSpot[1] === s.spot[1];
                          return (
                            <div
                              key={s.name}
                              className={`flex items-center justify-between rounded-sm border transition overflow-hidden ${
                                isActive
                                  ? theme === 'LIGHT'
                                    ? 'bg-purple-100 border-[#7C3AED]/65 text-purple-800 font-bold'
                                    : 'bg-[#7C3AED]/20 border-purple-500 text-purple-300 font-bold'
                                  : theme === 'LIGHT'
                                    ? 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-100 hover:text-black'
                                    : 'bg-[#1F1F24] border-transparent text-gray-400 hover:bg-[#25252A] hover:text-[#FFFFFF]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setCameraFocusSpot(s.spot)}
                                className="flex-1 py-1 px-1.5 cursor-pointer text-left truncate text-[8.5px] leading-tight"
                                title={`Focus on: ${s.name} [${s.spot[0]}, ${s.spot[1]}]`}
                              >
                                📍 {s.name}
                              </button>
                              
                              {/* Delete only if custom/non-essential or allow all to be deleted for full user freedom */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCameraSpot(s.name);
                                }}
                                className={`px-1 py-1 hover:bg-red-500/20 text-gray-500 hover:text-red-650 dark:hover:text-red-400 font-mono text-[8px] cursor-pointer self-stretch flex items-center justify-center transition border-l ${
                                  theme === 'LIGHT' ? 'border-[#D1D1D6]' : 'border-[#2D2D33]/40'
                                }`}
                                title="Remove Spot Anchor"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Anchor Creator Widget */}
                      <div className={`p-2 rounded border space-y-2 mt-1 transition-colors ${
                        theme === 'LIGHT' ? 'bg-white border-[#D1D1D6]' : 'bg-[#141418] border-[#2D2D33]/60'
                      }`}>
                        <span className={`text-[8px] font-mono uppercase tracking-widest block font-bold ${
                          theme === 'LIGHT' ? 'text-zinc-600' : 'text-gray-400'
                        }`}>Assemble New Camera Spot</span>
                        
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            placeholder="Spot label (e.g. Boss Room)"
                            value={newSpotName}
                            onChange={(e) => setNewSpotName(e.target.value)}
                            className={`w-full border rounded px-1.5 py-0.5 text-[9px] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] focus:ring-offset-0 focus:border-[#7C3AED] font-mono transition-colors ${
                              theme === 'LIGHT'
                                ? 'bg-[#F2F2F7] border-[#D1D1D6] text-black placeholder-zinc-400'
                                : 'bg-[#1A1A20] border-[#2D2D33] text-white placeholder-gray-600'
                            }`}
                          />
                          
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className={`flex items-center gap-1 border rounded px-1 py-0.5 font-mono text-[9px] transition-colors ${
                              theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#1A1A20] border-[#2D2D33]'
                            }`}>
                              <span className="text-red-500 font-bold">X</span>
                              <input
                                type="number"
                                step="0.5"
                                value={newSpotX}
                                onChange={(e) => setNewSpotX(parseFloat(e.target.value) || 0)}
                                className={`bg-transparent w-full text-right p-0 focus:outline-none font-bold ${
                                  theme === 'LIGHT' ? 'text-black' : 'text-white'
                                }`}
                              />
                            </div>
                            <div className={`flex items-center gap-1 border rounded px-1 py-0.5 font-mono text-[9px] transition-colors ${
                              theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#1A1A20] border-[#2D2D33]'
                            }`}>
                              <span className="text-emerald-500 font-bold">Y</span>
                              <input
                                type="number"
                                step="0.5"
                                value={newSpotY}
                                onChange={(e) => setNewSpotY(parseFloat(e.target.value) || 0)}
                                className={`bg-transparent w-full text-right p-0 focus:outline-none font-bold ${
                                  theme === 'LIGHT' ? 'text-black' : 'text-white'
                                }`}
                              />
                            </div>
                          </div>

                          <div className="flex gap-1">
                            {/* Grab Current Coordinates utility helper */}
                            <button
                              type="button"
                              onClick={() => {
                                setNewSpotX(cameraFocusSpot ? cameraFocusSpot[0] : 0);
                                setNewSpotY(cameraFocusSpot ? cameraFocusSpot[1] : 0);
                              }}
                              className={`flex-1 border text-[8px] py-1 rounded cursor-pointer transition font-mono ${
                                theme === 'LIGHT'
                                  ? 'bg-white border-[#D1D1D6] text-zinc-700 hover:bg-[#F2F2F7]'
                                  : 'bg-[#1D1D22] border-[#2D2D33] text-[#A0A0AA] hover:bg-[#25252D]'
                              }`}
                            >
                              🎯 Capture Current
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const nameTrimmed = newSpotName.trim();
                                if (!nameTrimmed) {
                                  alert('Please enter a spot label name first.');
                                  return;
                                }
                                addCameraSpot(nameTrimmed, [newSpotX, newSpotY]);
                                setNewSpotName('');
                              }}
                              className="flex-1 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white text-[8px] py-1 rounded font-bold transition cursor-pointer font-mono shadow-sm"
                            >
                              ⚓ Drop Anchor
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions: Clear drawing buffer */}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Clear all pencil drawings on the '${activeDrawingLayer}' layer?`)) {
                      clearDrawingStrokes(activeDrawingLayer);
                    }
                  }}
                  className={`w-full py-1 text-[8.5px] uppercase font-mono font-bold tracking-tight border rounded cursor-pointer flex items-center justify-center gap-1 border-solid transition ${
                    theme === 'LIGHT'
                      ? 'bg-rose-50 border-rose-250 text-rose-700 hover:bg-rose-100'
                      : 'bg-rose-950/40 text-rose-400 border-rose-900/50 hover:bg-rose-900/40'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear {activeDrawingLayer} drawings</span>
                </button>
              </div>
            ) : (
              /* SOLID OBJECT MESH PLACER */
              <div className="space-y-2">
                <div className="text-[8px] font-mono text-[#A0A0AA] font-bold flex justify-between uppercase">
                  <span>active paint brush</span>
                  <span className="text-purple-400 font-bold">{selectedBrush.behavior}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[9px]">
                  {BRUSH_PRESETS.map((bp) => {
                    const isSelected = selectedBrush.behavior === bp.behavior && selectedBrush.type === bp.type;
                    return (
                      <button
                        key={bp.label}
                        type="button"
                        onClick={() => setSelectedBrush({
                          type: bp.type,
                          behavior: bp.behavior,
                          color: bp.color,
                          assetFilename: bp.assetFilename
                        })}
                        className={`flex items-center gap-1.5 p-1 rounded-sm border cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#7C3AED] border-[#7C3AED] text-white font-bold shadow'
                            : 'bg-[#222227] border-transparent text-[#A0A0AA] hover:bg-[#2A2A30] hover:text-[#FFFFFF]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: bp.color }} />
                        <span className="truncate">{bp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="text-[7.5px] font-mono text-gray-500 bg-black/20 p-1.5 rounded text-center leading-normal">
              Active layer: <span className="text-purple-400 font-bold">{activeDrawingLayer.toUpperCase()}</span>. Pencil strokes are projected into 2.5D coordinate space.
            </div>
          </div>
        ) : (
          /* TRADITIONAL FORM CONFIG FOR SELECTIVE AND TYPICAL GENERATIONS */
          <>
            <label className={`text-[9px] font-mono uppercase block font-bold ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>
              {workspace === 'ARTIST' ? 'Add Artboard Element' : 'Instantiate Behavior Node'}
            </label>
            
            <input
              type="text"
              value={newEntityName}
              onChange={(e) => setNewEntityName(e.target.value)}
              placeholder={workspace === 'ARTIST' ? "Element name (e.g., Tree)..." : "Behavior id..."}
              className={`w-full px-2 py-1 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-[#7C3AED] focus:ring-offset-0 focus:border-[#7C3AED] font-mono transition-colors ${
                theme === 'LIGHT' 
                  ? 'bg-[#F2F2F7] border border-[#D1D1D6] text-[#1C1C1E] placeholder-gray-400' 
                  : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6] placeholder-[#71717A]'
              }`}
            />

            {workspace === 'ARTIST' ? (
              /* PRESETS FORM FOR ARTISTS */
              <div className="grid grid-cols-2 gap-1.5 font-sans">
                <div>
                  <label className={`text-[8px] font-mono block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Asset Type</label>
                  <select
                    value={artistPreset}
                    onChange={(e) => setArtistPreset(e.target.value as any)}
                    className={`w-full px-1 py-0.5 rounded text-[10px] focus:outline-none font-semibold ${
                      theme === 'LIGHT' 
                        ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' 
                        : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6]'
                    }`}
                  >
                    <option value="SPRITE">Active Sprite</option>
                    <option value="BACKGROUND">Background Mesh</option>
                    <option value="DECORATION">Scenic Prop</option>
                    <option value="PARTICLE">Fore Overlay</option>
                  </select>
                </div>
                <div>
                  <label className={`text-[8px] font-mono block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Layer Tint</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={artistColor}
                      onChange={(e) => setArtistColor(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-none bg-transparent p-0 shrink-0"
                    />
                    <span className={`text-[8px] font-mono ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#A0A0AA]'}`}>{artistColor}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* CONFIG FORM FOR DEVELOPERS */
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className={`text-[8px] font-mono block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Rigid Profile</label>
                  <select
                    value={newEntityType}
                    onChange={(e) => setNewEntityType(e.target.value as GeometryType)}
                    className={`w-full px-1 py-0.5 rounded text-[10px] focus:outline-none font-mono ${
                      theme === 'LIGHT' 
                        ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' 
                        : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6]'
                    }`}
                  >
                    <option value="BOX">BOX_COLL</option>
                    <option value="SPHERE">SPHERE_RAD</option>
                    <option value="CAPSULE">CAPS_CYL</option>
                    <option value="MESH">CONVEX_HULL</option>
                  </select>
                </div>

                <div>
                  <label className={`text-[8px] font-mono block mb-0.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>Logic Class</label>
                  <select
                    value={newEntityBehavior}
                    onChange={(e) => setNewEntityBehavior(e.target.value as BehaviorType)}
                    className={`w-full px-1 py-0.5 rounded text-[10px] focus:outline-none font-mono ${
                      theme === 'LIGHT' 
                        ? 'bg-white border border-[#D1D1D6] text-[#1C1C1E]' 
                        : 'bg-[#2D2D33] border border-[#2D2D33] text-[#E0E0E6]'
                    }`}
                  >
                    <option value="STATIC">STATIC</option>
                    <option value="PLAYER">PLAYER</option>
                    <option value="ROTATOR">ROTATOR</option>
                    <option value="COLLECTIBLE">COLLECTIBLE</option>
                    <option value="HAZARD">HAZARD</option>
                    <option value="TRIGGER">TRIGGER</option>
                  </select>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white font-semibold py-1 rounded-sm text-[10px] uppercase tracking-wider transition shadow-sm cursor-pointer border-none"
            >
              <Plus className="w-3 h-3" />
              <span>{workspace === 'ARTIST' ? 'Spawn Generator' : 'Instantiate Actor'}</span>
            </button>
          </>
        )}
      </form>
    </div>
  );
}
