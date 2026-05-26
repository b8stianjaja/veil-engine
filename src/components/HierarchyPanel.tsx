/**
 * @file src/components/HierarchyPanel.tsx
 * @description List hierarchy showing active entities, sorted into rendering layers for Artists or behavioral archetypes for Developers.
 * Allows instantiating/synthesizing new spatial nodes matching the current role.
 * UI/UX Consolidated: Tool configurations (Brushes, Camera Anchors) are offloaded to Inspector & Canvas.
 */

import React, { useState } from 'react';
import { useSpatialEditorStore } from '../app/store';
import { Entity, GeometryType, BehaviorType } from '../types';
import { Plus, Trash2, Box, Eye, EyeOff, Lock, Unlock, Paintbrush, Anchor, Sparkles, AlertOctagon, HelpCircle, Palette, Cpu, Layers } from 'lucide-react';

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
    setLayerVisibility,
    setLayerLock,
    setActiveDrawingLayer,
    activeToolMode,
    setToolMode,
    clearDrawingStrokes,
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
      {/* Header section */}
      <div className={`px-3 py-1.5 border-b flex justify-between items-center shrink-0 transition-colors ${
        theme === 'LIGHT' ? 'bg-[#E5E5EA] border-[#D1D1D6]' : 'bg-[#252529] border-[#2D2D33]'
      }`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-[#71717A]'}`}>
          {workspace === 'ARTIST' ? <Layers className="w-3.5 h-3.5 text-[#7C3AED]" /> : <Cpu className="w-3.5 h-3.5 text-[#7C3AED]" />}
          <span>{workspace === 'ARTIST' ? 'Spatial Layers' : 'Logic Schemas'}</span>
        </span>
        <span className="text-[#71717A] text-xs font-mono font-bold cursor-default select-none">+</span>
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
                      draggable={!layerLock.background}
                      onDragStart={(e) => handleDragStart(e, uuid)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, 'background', index, uuid)}
                      onDrop={(e) => handleDrop(e, 'background', index)}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm transition text-[11px] font-mono select-none relative ${
                        layerLock.background ? 'opacity-60 cursor-not-allowed' : 'cursor-grab'
                      } ${
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
                      onClick={() => !layerLock.background && setSelectedUuid(uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className="truncate">{ent.name}</span>
                        {layerLock.background && <Lock className="w-2 h-2 text-red-500 opacity-70 shrink-0" />}
                      </div>
                      {!layerLock.background && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEntity(uuid);
                          }}
                          className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
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
                      draggable={!layerLock.gameplay}
                      onDragStart={(e) => handleDragStart(e, uuid)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, 'gameplay', index, uuid)}
                      onDrop={(e) => handleDrop(e, 'gameplay', index)}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm transition text-[11px] font-mono select-none relative ${
                        layerLock.gameplay ? 'opacity-60 cursor-not-allowed' : 'cursor-grab'
                      } ${
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
                      onClick={() => !layerLock.gameplay && setSelectedUuid(uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className="truncate font-semibold">{ent.name}</span>
                        {layerLock.gameplay && <Lock className="w-2 h-2 text-red-500 opacity-70 shrink-0" />}
                      </div>
                      {!layerLock.gameplay && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEntity(uuid);
                          }}
                          className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
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
                      draggable={!layerLock.foreground}
                      onDragStart={(e) => handleDragStart(e, uuid)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, 'foreground', index, uuid)}
                      onDrop={(e) => handleDrop(e, 'foreground', index)}
                      className={`flex items-center justify-between px-1.5 py-1 rounded-sm transition text-[11px] font-mono select-none relative ${
                        layerLock.foreground ? 'opacity-60 cursor-not-allowed' : 'cursor-grab'
                      } ${
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
                      onClick={() => !layerLock.foreground && setSelectedUuid(uuid)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {renderIcon(ent.behavior)}
                        <span className="truncate">{ent.name}</span>
                        {layerLock.foreground && <Lock className="w-2 h-2 text-red-500 opacity-70 shrink-0" />}
                      </div>
                      {!layerLock.foreground && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEntity(uuid);
                          }}
                          className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
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
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500 cursor-pointer"
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
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500 cursor-pointer"
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
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-400 hover:text-red-500 cursor-pointer"
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

      {/* Role-Isolated Node Synthesis Footer Form */}
      <div className={`p-2.5 border-t transition-colors ${
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
              className={`flex-1 py-1 rounded-sm transition text-center cursor-pointer ${
                activeToolMode !== 'DRAW'
                  ? theme === 'LIGHT' ? 'bg-[#7C3AED]/15 text-[#7C3AED] font-bold shadow-sm' : 'bg-[#7C3AED]/20 text-[#D8B4FE] font-bold shadow-sm'
                  : theme === 'LIGHT' ? 'text-zinc-500 hover:text-black' : 'text-gray-400 hover:text-white'
              }`}
              title="Transform, translate, rotate, and scale nodes manually on the canvas"
            >
              Selection View
            </button>
            <button
              type="button"
              onClick={() => setToolMode('DRAW')}
              className={`flex-1 py-1 rounded-sm transition text-center cursor-pointer ${
                activeToolMode === 'DRAW'
                  ? 'bg-[#7C3AED] text-white font-bold shadow-sm animate-pulse'
                  : theme === 'LIGHT' ? 'text-zinc-600 hover:text-black' : 'text-gray-300 hover:text-white'
              }`}
              title="Activate the Paint Brush to draw directly onto the grid layers"
            >
              🎨 Paint Brush Mode
            </button>
          </div>
        )}

        {workspace === 'ARTIST' && activeToolMode === 'DRAW' ? (
          /* CONSOLIDATED DRAWING DECK: Points to Inspector */
          <div className={`animate-fade-in border p-3.5 rounded-sm space-y-2.5 text-center transition-colors ${
            theme === 'LIGHT'
              ? 'bg-[#F2F2F7] border-[#D1D1D6] text-zinc-700'
              : 'bg-[#131317] border-[#2D2D33] text-[#A0A0AA]'
          }`}>
            <Palette className={`w-6 h-6 mx-auto mb-1 ${theme === 'LIGHT' ? 'text-[#7C3AED]/70' : 'text-[#7C3AED]/50'}`} />
            
            <p className="text-[10px] font-mono leading-relaxed">
              Target Depth: <span className="text-[#7C3AED] font-bold uppercase">{activeDrawingLayer}</span>
            </p>
            
            <p className="text-[9px] font-sans opacity-90 px-2">
              Configure your pencil pigment, vector styles, stroke widths, and tool modes seamlessly inside the <strong className={theme === 'LIGHT' ? 'text-black' : 'text-white'}>Inspector Panel</strong>.
            </p>

            <button
              type="button"
              onClick={() => {
                if (confirm(`Clear all hand-drawn vectors on the '${activeDrawingLayer}' layer?`)) {
                  clearDrawingStrokes(activeDrawingLayer);
                }
              }}
              className={`w-full py-1.5 mt-2 text-[9px] uppercase font-mono font-bold tracking-tight border rounded cursor-pointer flex items-center justify-center gap-1.5 transition ${
                theme === 'LIGHT'
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  : 'bg-rose-950/40 text-rose-400 border-rose-900/50 hover:bg-rose-900/40'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>Flush Active Layer Vectors</span>
            </button>
          </div>
        ) : (
          /* TRADITIONAL FORM CONFIG FOR SELECTIVE AND TYPICAL GENERATIONS */
          <form onSubmit={handleAdd} className="space-y-2.5">
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
              className="w-full flex items-center justify-center gap-1.5 bg-[#7C3AED] hover:bg-[#8B5CF6] text-white font-semibold py-1 rounded-sm text-[10px] uppercase tracking-wider transition shadow-sm cursor-pointer border-none"
            >
              <Plus className="w-3 h-3" />
              <span>{workspace === 'ARTIST' ? 'Spawn Generator' : 'Instantiate Actor'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}