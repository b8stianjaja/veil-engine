/**
 * @file src/components/TimelineSeqEditor.tsx
 * @description Highly Polished, Highly Interactive Timeline & Keyframe Sequence Editor.
 * Supports complete CRUD for Sequences, Tracks, and Keyframes, with interactive click-to-place timeline actions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSpatialEditorStore } from '../app/store';
import { TimelineSequence, TimelineTrack, TimelineKeyframe } from '../types';
import EventBus from '../engine/protocol/EventBus';
import AnimationDirector from '../engine/systems/AnimationDirector';
import { 
  Play, Pause, RotateCcw, Clapperboard, Plus, Trash2, 
  Settings, Clock, Key, Eye, ToggleLeft, Layers 
} from 'lucide-react';

interface TimelineSeqEditorProps {
  theme?: 'LIGHT' | 'DARK';
}

export default function TimelineSeqEditor({ theme = 'DARK' }: TimelineSeqEditorProps) {
  const { timelineEvents, setTimelineEvents, entities } = useSpatialEditorStore();
  const [activeSeqIndex, setActiveSeqIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeFrameOutputs, setActiveFrameOutputs] = useState<Record<string, number>>({});

  // CRUD Interface details
  const [showNewSeqForm, setShowNewSeqForm] = useState<boolean>(false);
  const [newSeqName, setNewSeqName] = useState<string>('');
  const [newSeqDuration, setNewSeqDuration] = useState<number>(3.0);

  const [showNewTrackForm, setShowNewTrackForm] = useState<boolean>(false);
  const [newTrackTarget, setNewTrackTarget] = useState<string>('');
  const [newTrackType, setNewTrackType] = useState<'SPRITE_FRAME' | 'GSAP_TWEEN' | 'TRIGGER'>('SPRITE_FRAME');
  const [newTrackChannel, setNewTrackChannel] = useState<'position2d' | 'scale2d' | 'opacity' | ''>('');

  // Selected Keyframe Inspector States
  const [selectedKeyframe, setSelectedKeyframe] = useState<{
    trackIdx: number;
    kfIdx: number;
  } | null>(null);

  const activeSeq = timelineEvents[activeSeqIndex] || timelineEvents[0];

  // Sequencer playback ticker refs
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Sync frames from engine ticks
  useEffect(() => {
    const handleSpriteUpdate = (data: Record<string, any>) => {
      setActiveFrameOutputs(prev => ({ ...prev, ...data }));
    };

    EventBus.on('BATCH_SPRITE_UPDATE', handleSpriteUpdate);
    return () => {
      EventBus.off('BATCH_SPRITE_UPDATE', handleSpriteUpdate);
    };
  }, []);

  // Update indices safely if sequences get updated
  useEffect(() => {
    if (activeSeqIndex >= timelineEvents.length && timelineEvents.length > 0) {
      setActiveSeqIndex(0);
    }
  }, [timelineEvents, activeSeqIndex]);

  const handlePlayToggle = () => {
    if (!activeSeq) return;

    if (!isPlaying) {
      setIsPlaying(true);
      lastTickRef.current = performance.now();
      AnimationDirector.playSequence(activeSeq.id, timelineEvents);
      loopSequencer();
    } else {
      setIsPlaying(false);
      AnimationDirector.stopSequence(activeSeq.id);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    AnimationDirector.reset();
    setActiveFrameOutputs({});
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const loopSequencer = () => {
    const active = AnimationDirector['activeSequences'].has(activeSeq?.id);
    if (!active && !isPlaying) {
      setIsPlaying(false);
      return;
    }

    const now = performance.now();
    const dt = (now - lastTickRef.current) / 1000.0;
    lastTickRef.current = now;

    // Evaluate animation director
    AnimationDirector.tick(dt);

    const instance = AnimationDirector['activeSequences'].get(activeSeq?.id);
    if (instance) {
      setCurrentTime(instance.elapsedTime);
      animationFrameRef.current = requestAnimationFrame(loopSequencer);
    } else {
      setIsPlaying(false);
      setCurrentTime(activeSeq ? activeSeq.duration : 0);
    }
  };

  // Create Sequence Action
  const handleCreateSequence = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSeqName.trim() || 'New Animation';
    const duration = Math.max(0.5, newSeqDuration || 3.0);
    const newSeq: TimelineSequence = {
      id: `seq-${Date.now()}`,
      name,
      duration,
      tracks: []
    };

    const nextEvents = [...timelineEvents, newSeq];
    setTimelineEvents(nextEvents);
    setActiveSeqIndex(nextEvents.length - 1);
    
    // Reset inputs
    setNewSeqName('');
    setShowNewSeqForm(false);
    setSelectedKeyframe(null);
  };

  // Delete Sequence Action
  const handleDeleteActiveSequence = () => {
    if (timelineEvents.length <= 1) {
      alert("At least one timeline sequencer block is required.");
      return;
    }
    if (!activeSeq) return;
    if (confirm(`Are you sure you want to delete the sequencer: '${activeSeq.name}'?`)) {
      handleReset();
      const updated = timelineEvents.filter((_, idx) => idx !== activeSeqIndex);
      setTimelineEvents(updated);
      setActiveSeqIndex(0);
      setSelectedKeyframe(null);
    }
  };

  // Update Active Sequence parameters
  const updateSequenceProperty = (key: 'name' | 'duration', val: any) => {
    if (!activeSeq) return;
    const nextEvents = [...timelineEvents];
    const updateTarget = { ...nextEvents[activeSeqIndex] };
    if (key === 'duration') {
      updateTarget.duration = Math.max(0.1, parseFloat(val) || 1.0);
    } else {
      updateTarget.name = val;
    }
    nextEvents[activeSeqIndex] = updateTarget;
    setTimelineEvents(nextEvents);
  };

  // Create Track Action
  const handleCreateTrack = () => {
    if (!activeSeq) return;
    const targetUuid = newTrackTarget || Object.keys(entities)[0];
    if (!targetUuid) {
      alert("Add at least one sprite/rigid entity to compile animation tracks.");
      return;
    }

    const newTrack: TimelineTrack = {
      trackType: newTrackType,
      targetUuid,
      ...(newTrackType === 'GSAP_TWEEN' ? { channel: newTrackChannel || 'position2d' } : {}),
      keyframes: [
        { time: 0.0, value: 0 }
      ]
    };

    // Add default GSAP config if applicable
    if (newTrackType === 'GSAP_TWEEN') {
      newTrack.timelineData = {
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 1.5,
        yoyo: true,
        repeat: -1
      };
    }

    const nextEvents = [...timelineEvents];
    const sequence = { ...nextEvents[activeSeqIndex] };
    sequence.tracks = [...sequence.tracks, newTrack];
    nextEvents[activeSeqIndex] = sequence;
    
    setTimelineEvents(nextEvents);
    setShowNewTrackForm(false);
    setSelectedKeyframe(null);
  };

  // Delete Track Action
  const handleDeleteTrack = (trackIdx: number) => {
    if (!activeSeq) return;
    const nextEvents = [...timelineEvents];
    const sequence = { ...nextEvents[activeSeqIndex] };
    sequence.tracks = sequence.tracks.filter((_, idx) => idx !== trackIdx);
    nextEvents[activeSeqIndex] = sequence;
    
    setTimelineEvents(nextEvents);
    setSelectedKeyframe(null);
  };

  // Click on Timeline rail container to place a Keyframe
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>, trackIdx: number) => {
    if (isPlaying) return; // Prevent placing keys during performance ticks
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const clickTime = parseFloat((percent * activeSeq.duration).toFixed(2));

    const nextEvents = [...timelineEvents];
    const sequence = { ...nextEvents[activeSeqIndex] };
    const track = { ...sequence.tracks[trackIdx] };
    const kfs = [...(track.keyframes || [])];

    // Build keyframe with default parameters based on type
    let val: any = 0;
    let action: string | undefined = undefined;
    if (track.trackType === 'TRIGGER') {
      action = 'ALERT';
      val = '';
    }

    const newKf: TimelineKeyframe = {
      time: clickTime,
      value: val,
      ...(action ? { action, payload: { message: 'Alert Trigger!' } } : {})
    };

    kfs.push(newKf);
    kfs.sort((a, b) => a.time - b.time);

    track.keyframes = kfs;
    sequence.tracks[trackIdx] = track;
    nextEvents[activeSeqIndex] = sequence;

    setTimelineEvents(nextEvents);

    // Auto-select the newly created keyframe
    const newIdx = kfs.findIndex(k => k.time === clickTime);
    setSelectedKeyframe({ trackIdx, kfIdx: newIdx });
  };

  // Keyframe Editing Actions (Direct bindings)
  const handleUpdateSelectedKeyframe = (field: 'time' | 'value' | 'action', inputVal: any) => {
    if (!selectedKeyframe || !activeSeq) return;
    const { trackIdx, kfIdx } = selectedKeyframe;
    const nextEvents = [...timelineEvents];
    const sequence = { ...nextEvents[activeSeqIndex] };
    const track = { ...sequence.tracks[trackIdx] };
    const kfs = [...(track.keyframes || [])];
    const targetKf = { ...kfs[kfIdx] };

    if (field === 'time') {
      const parsedTime = Math.min(activeSeq.duration, Math.max(0, parseFloat(inputVal) || 0));
      targetKf.time = parsedTime;
    } else if (field === 'value') {
      targetKf.value = isNaN(parseInt(inputVal, 10)) ? inputVal : parseInt(inputVal, 10);
    } else if (field === 'action') {
      targetKf.action = inputVal;
    }

    kfs[kfIdx] = targetKf;
    // Resort and find new index
    kfs.sort((a, b) => a.time - b.time);
    const updatedIndex = kfs.findIndex(k => k.time === targetKf.time && k.value === targetKf.value);

    track.keyframes = kfs;
    sequence.tracks[trackIdx] = track;
    nextEvents[activeSeqIndex] = sequence;

    setTimelineEvents(nextEvents);
    setSelectedKeyframe({ trackIdx, kfIdx: updatedIndex >= 0 ? updatedIndex : 0 });
  };

  // Delete keyframe
  const handleDeleteSelectedKeyframe = () => {
    if (!selectedKeyframe || !activeSeq) return;
    const { trackIdx, kfIdx } = selectedKeyframe;
    const nextEvents = [...timelineEvents];
    const sequence = { ...nextEvents[activeSeqIndex] };
    const track = { ...sequence.tracks[trackIdx] };
    const kfs = (track.keyframes || []).filter((_, idx) => idx !== kfIdx);

    track.keyframes = kfs;
    sequence.tracks[trackIdx] = track;
    nextEvents[activeSeqIndex] = sequence;

    setTimelineEvents(nextEvents);
    setSelectedKeyframe(null);
  };

  if (timelineEvents.length === 0) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center font-mono text-[10px] p-6 ${
        theme === 'LIGHT' ? 'text-gray-500 bg-[#E5E5EA]' : 'text-[#71717A] bg-[#141418]'
      }`}>
        <Clapperboard className="w-8 h-8 text-gray-500 mb-2 animate-pulse" />
        <span>No keyframe timelines mapped.</span>
        <button 
          onClick={() => {
            const nextEvents = [{
              id: 'seq-init',
              name: 'Idle Setup Loop',
              duration: 3.0,
              tracks: []
            }];
            setTimelineEvents(nextEvents);
          }}
          className="mt-3 bg-[#7C3AED] hover:bg-purple-600 px-3 py-1.5 rounded text-white text-[10px] font-sans transition cursor-pointer"
        >
          Initialize Timeline
        </button>
      </div>
    );
  }

  const selectedKfObject = selectedKeyframe && activeSeq
    ? activeSeq.tracks[selectedKeyframe.trackIdx]?.keyframes?.[selectedKeyframe.kfIdx]
    : null;

  return (
    <div className={`w-full h-full flex flex-col select-none transition-colors border-t overflow-hidden ${
      theme === 'LIGHT' 
        ? 'bg-[#FFFFFF] border-[#D1D1D6] text-[#1C1C1E]' 
        : 'bg-[#0B0B0D] border-[#2D2D33] text-[#E0E0E6]'
    }`} id="timeline-sequencer-hud">
      
      {/* 1. CONTROL HEADER BAR */}
      <div className={`flex items-center justify-between px-3 py-2 shrink-0 border-b transition-colors  ${
        theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#141418] border-[#2D2D33]'
      }`}>
        
        {/* Left Side: Sequence Selection dropdown and settings info */}
        <div className="flex items-center gap-2.5">
          <Clapperboard className="w-4 h-4 text-[#8B5CF6]" />
          
          <div className="flex items-center gap-1.5 font-mono">
            {/* Sequence Dropdown picker */}
            <select
              value={activeSeqIndex}
              onChange={(e) => {
                setActiveSeqIndex(parseInt(e.target.value, 10));
                setSelectedKeyframe(null);
                handleReset();
              }}
              className={`text-[11px] font-bold px-1.5 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7C3AED] transition-colors ${
                theme === 'LIGHT' 
                  ? 'bg-white border border-[#D1D1D6] text-black' 
                  : 'bg-[#1C1C24] border border-[#2D2D33] text-[#E0E0E6]'
              }`}
            >
              {timelineEvents.map((seq, idx) => (
                <option key={seq.id} value={idx}>{seq.name}</option>
              ))}
            </select>

            <span className="text-[#71717A] text-[9px]">/</span>
            
            {/* Speed config */}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" />
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="20"
                value={activeSeq?.duration || 3.0}
                onChange={(e) => updateSequenceProperty('duration', e.target.value)}
                className={`w-10 bg-transparent text-center focus:outline-none focus:border-purple-500 border-b border-transparent font-bold text-[10px] ${
                  theme === 'LIGHT' ? 'text-black' : 'text-white'
                }`}
                title="Duration of this animation loop (seconds)"
              />
              <span className="text-[9px] text-[#71717A]">s</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Add Sequence Panel Toggle */}
            <button
              onClick={() => {
                setShowNewSeqForm(!showNewSeqForm);
                setShowNewTrackForm(false);
              }}
              className={`p-1 rounded cursor-pointer hover:bg-purple-900/20 text-[#A855F7] transition ${
                showNewSeqForm ? 'bg-[#7C3AED]/20 border border-purple-500' : 'border border-transparent'
              }`}
              title="Create New Animation Loop Sequence"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            
            {/* Delete active Sequence */}
            <button
              onClick={handleDeleteActiveSequence}
              className="p-1 rounded cursor-pointer hover:bg-red-950/40 text-red-400 transition"
              title="Delete Active Sequence Loop"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* HUD Indicator: Show Playhead location */}
        <div className="flex items-center gap-2">
          
          {/* Timeline counter indicator */}
          <div className={`border px-2.5 py-0.5 rounded text-[10px] font-mono font-extrabold flex items-center gap-1.5 shadow-sm transition-colors ${
            theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-black' : 'bg-[#0E0E12] border-[#2D2D33] text-[#E0E0E6]'
          }`}>
            <span className="text-[#71717A] text-[8px] tracking-wider uppercase">Active Frame Playhead</span>
            <span className="text-purple-400 font-bold tracking-tight">{currentTime.toFixed(2)}s</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">{activeSeq?.duration.toFixed(1)}s</span>
          </div>

          {/* Player controls */}
          <div className="flex items-center gap-1 text-[10px]">
            <button
              onClick={handlePlayToggle}
              className={`px-2.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 transition cursor-pointer shadow-sm text-white ${
                isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-[#7C3AED] hover:bg-[#8B5CF6]'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3 h-3 text-white fill-white" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-white fill-white" />
                  <span>SIMULATE</span>
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className={`p-1 rounded border transition cursor-pointer ${
                theme === 'LIGHT' 
                  ? 'bg-white hover:bg-gray-100 border-[#D1D1D6] text-black' 
                  : 'bg-[#1C1C24] hover:bg-[#25252F] border-[#2D2D33] text-gray-400'
              }`}
              title="Reset timeline sequence back to zero start points"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. LOWER SECTIONS WRAPPER */}
      <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-[#202025]">
        
        {/* Left Side: Loop creation form / Track additions / Tracks list HUD */}
        <div className="w-64 max-w-xs shrink-0 flex flex-col min-h-0 bg-[#0A0A0C]">
          
          {/* New Sequence Input Dialog Drawer wrapper */}
          {showNewSeqForm && (
            <form onSubmit={handleCreateSequence} className="p-2.5 border-b border-purple-900/30 bg-purple-950/10 space-y-2 animate-fade-in font-mono shrink-0">
              <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest block">Assemble Loop Track</span>
              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Idle Breathe, Jump Up..."
                  value={newSeqName}
                  onChange={(e) => setNewSeqName(e.target.value)}
                  className="w-full bg-black/40 border border-[#2D2D33] rounded px-2 py-0.5 text-[10px] text-white focus:outline-none"
                  required
                />
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-gray-500">Duration (s)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={newSeqDuration}
                    onChange={(e) => setNewSeqDuration(parseFloat(e.target.value) || 3.0)}
                    className="w-12 bg-black/40 border border-[#2D2D33] text-right rounded px-1 text-[10px] text-white focus:outline-none"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-[9px] py-1 rounded font-bold cursor-pointer"
                  >
                    Create Sequence
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewSeqForm(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 text-[9px] px-2 py-1 rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* New Track Dialog Drawer wrapper */}
          {showNewTrackForm && (
            <div className="p-2.5 border-b border-purple-900/30 bg-purple-950/10 space-y-2 animate-fade-in font-mono shrink-0">
              <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest block">Configure Animation Channel</span>
              
              <div className="space-y-1.5 text-[9.5px]">
                <div>
                  <span className="text-gray-500 block mb-0.5">Anim Target entity node</span>
                  <select
                    value={newTrackTarget}
                    onChange={(e) => setNewTrackTarget(e.target.value)}
                    className="w-full bg-[#141418] border border-[#2D2D33] rounded p-1 text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose node --</option>
                    {Object.values(entities).map((entity) => (
                      <option key={entity.uuid} value={entity.uuid}>{entity.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-gray-500 block mb-0.5">Track Type channel</span>
                  <select
                    value={newTrackType}
                    onChange={(e) => {
                      setNewTrackType(e.target.value as any);
                      if (e.target.value !== 'GSAP_TWEEN') {
                        setNewTrackChannel('');
                      } else {
                        setNewTrackChannel('scale2d');
                      }
                    }}
                    className="w-full bg-[#141418] border border-[#2D2D33] rounded p-1 text-white focus:outline-none cursor-pointer"
                  >
                    <option value="SPRITE_FRAME">SPRITE FLIPBOOK INDEX SWAP</option>
                    <option value="GSAP_TWEEN">GSAP INTERPOLATION TWEEN</option>
                    <option value="TRIGGER">METRONOME BROADCAST TRIGGER</option>
                  </select>
                </div>

                {newTrackType === 'GSAP_TWEEN' && (
                  <div>
                    <span className="text-gray-500 block mb-0.5">GSAP channel vector</span>
                    <select
                      value={newTrackChannel}
                      onChange={(e) => setNewTrackChannel(e.target.value as any)}
                      className="w-full bg-[#141418] border border-[#2D2D33] rounded p-1 text-white focus:outline-none cursor-pointer"
                    >
                      <option value="scale2d">SCALE REBOUNDS (scale2d)</option>
                      <option value="position2d">SPATIAL HEIGHT TRANSITS (position2d)</option>
                      <option value="opacity">OPACITY VISIBILITY FADES (opacity)</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={handleCreateTrack}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-1 rounded font-bold cursor-pointer text-[10px]"
                  >
                    Insert Track Unit
                  </button>
                  <button
                    onClick={() => setShowNewTrackForm(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 px-2 py-1 rounded cursor-pointer text-[10px]"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Option actions to add Animation Track */}
          <div className="p-2 border-b border-[#2D2D33]/60 flex justify-between items-center bg-[#101014] shrink-0">
            <span className="text-[8.5px] font-mono text-gray-400 uppercase tracking-widest font-bold">Sequencer Channels</span>
            <button
              onClick={() => {
                setShowNewTrackForm(!showNewTrackForm);
                setShowNewSeqForm(false);
              }}
              className="flex items-center gap-1 text-[9px] bg-[#7C3AED]/20 hover:bg-[#762EF0] text-[#E0E0E6] px-2 py-0.5 border border-purple-500/40 rounded-sm cursor-pointer font-bold transition"
            >
              <Plus className="w-3 h-3" />
              <span>Channel</span>
            </button>
          </div>

          {/* Quick Info text block */}
          <div className="flex-1 p-3 text-[9px] font-mono leading-relaxed select-none text-[#71717A]/80 flex flex-col justify-between">
            <div className="space-y-2">
              <p>🎭 <span className="text-purple-400 font-bold">Veil Animator Stage</span>. Timeline sequences manage coordinate tweens and rigid body sprite swaps during compile output.</p>
              <p>💡 <span className="text-emerald-400">Pro-Tip</span>: Click directly inside any grid channel tracking to drop animation points on the playhead!</p>
            </div>
            
            <div className="text-[8.5px] italic border-t border-[#2D2D33]/40 pt-2 text-[#71717A]">
              Active target keys sync with AnimationDirector evaluation sweeps.
            </div>
          </div>
        </div>

        {/* Middle/Center Column: Scaled Time Track rows & interactive timeline */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0E0E12] overflow-y-auto scrollbar-thin divide-y divide-[#2D2D33]/40">
          
          {activeSeq.tracks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-500 font-mono text-[10px]">
              <Layers className="w-6 h-6 text-purple-900 mb-2" />
              <p>No active animation track channels configured in this sequence loop.</p>
              <button
                onClick={() => {
                  setShowNewTrackForm(true);
                  if (Object.keys(entities).length > 0) {
                    setNewTrackTarget(Object.keys(entities)[0]);
                  }
                }}
                className="mt-2.5 bg-[#7C3AED]/20 hover:bg-[#7C3AED]/40 hover:text-white border border-[#7C3AED]/50 text-[#C084FC] px-2.5 py-1 text-[9px] rounded-sm transition cursor-pointer"
              >
                + Drop New Entity Animation Lane
              </button>
            </div>
          ) : (
            activeSeq.tracks.map((track, trackIdx) => {
              const target = entities[track.targetUuid];
              const targetName = target ? target.name : `Node:${track.targetUuid.substring(0, 6)}`;

              return (
                <div key={trackIdx} className="grid grid-cols-12 py-2 px-3 items-center text-[10.5px]">
                  {/* Unit Label Header */}
                  <div className="col-span-3 flex flex-col gap-0.5 pr-2 border-r border-[#2D2D33]/40">
                    <div className="flex items-center justify-between gap-1.5 pr-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`px-1 py-0.5 rounded-sm text-[8px] font-mono leading-none border uppercase ${
                          track.trackType === 'SPRITE_FRAME' 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' 
                            : track.trackType === 'GSAP_TWEEN' 
                              ? 'bg-purple-950/40 text-purple-400 border-purple-900/50' 
                              : 'bg-amber-950/40 text-amber-400 border-amber-900/50'
                        }`}>
                          {track.trackType === 'SPRITE_FRAME' ? 'SPRITE' : track.trackType === 'GSAP_TWEEN' ? 'TWEEN' : 'EVENT'}
                        </span>
                        <span className="truncate font-mono font-bold text-white text-[9.5px]" title={targetName}>
                          {targetName}
                        </span>
                      </div>

                      {/* Remove track button */}
                      <button
                        onClick={() => handleDeleteTrack(trackIdx)}
                        className="text-gray-500 hover:text-red-400 p-0.5 rounded transition cursor-pointer"
                        title="Remove channel track"
                      >
                        ×
                      </button>
                    </div>

                    {track.trackType === 'SPRITE_FRAME' && target?.assetFilename && (
                      <span className="text-[8px] truncate font-mono text-gray-500">
                        sheet: {target.assetFilename}
                      </span>
                    )}

                    {track.trackType === 'GSAP_TWEEN' && track.channel && (
                      <span className="text-[8px] text-[#A855F7] font-semibold font-mono font-bold">
                        Vector: {track.channel}
                      </span>
                    )}
                  </div>

                  {/* Interactive Slider representation with grid nodes */}
                  <div className="col-span-9 relative px-2">
                    <div 
                      onClick={(e) => handleTrackClick(e, trackIdx)}
                      className={`relative h-10 border rounded group cursor-crosshair flex items-center transition-colors ${
                        theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6]' : 'bg-[#0E0E11] border-[#2D2D33]'
                      }`}
                      title="Click directly here to drop a structural keyframe!"
                    >
                      {/* Interactive grid backdrop indicators */}
                      <div className="absolute inset-0 flex justify-between px-2 text-[7px] font-mono select-none pointer-events-none items-center text-gray-700/30">
                        <span>0.0s</span>
                        <span>0.5s</span>
                        <span>1.0s</span>
                        <span>1.5s</span>
                        <span>2.0s</span>
                        <span>2.5s</span>
                        <span>Maxs</span>
                      </div>

                      {/* Current playhead tracer */}
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-purple-500 shadow-sm shadow-[#8B5CF6] transition-all z-10 pointer-events-none"
                        style={{ left: `${(currentTime / activeSeq.duration) * 100}%` }}
                      />

                      {/* Monitor label output showing the evaluated state indices */}
                      {track.trackType === 'SPRITE_FRAME' && activeFrameOutputs[track.targetUuid] !== undefined && (
                        <div className="absolute bottom-1 right-2 text-[8px] font-mono px-1 rounded-sm border text-emerald-400 bg-emerald-950/40 border-emerald-900/60 font-bold">
                          ACTIVE INDX: {activeFrameOutputs[track.targetUuid]}
                        </div>
                      )}

                      {/* Keyframe nodes rendered as diamonds */}
                      {track.keyframes?.map((kf, kfIdx) => {
                        const percent = (kf.time / activeSeq.duration) * 100;
                        const isThisSelected = selectedKeyframe && selectedKeyframe.trackIdx === trackIdx && selectedKeyframe.kfIdx === kfIdx;
                        
                        return (
                          <div
                            key={kfIdx}
                            onClick={(e) => {
                              e.stopPropagation(); // Block placing a key on click
                              setSelectedKeyframe({ trackIdx, kfIdx });
                            }}
                            className={`absolute w-2.5 h-2.5 rotate-45 transform -translate-x-1/2 cursor-pointer z-20 shadow-md transition-transform hover:scale-125 ${
                              isThisSelected 
                                ? 'bg-amber-400 border border-white scale-110 shadow-amber-500/50' 
                                : 'bg-[#8B5CF6] hover:bg-[#A855F7]'
                            }`}
                            style={{ left: `${percent}%` }}
                            title={`Keypoint index: #${kfIdx} | Time: ${kf.time.toFixed(2)}s | Value: ${kf.value ?? kf.action}`}
                          />
                        );
                      })}

                      {/* Tween path timeline block indicator */}
                      {track.trackType === 'GSAP_TWEEN' && track.timelineData && (
                        <div className="absolute left-[8px] right-[8px] h-1.5 bg-gradient-to-r from-purple-500/10 to-purple-500/30 rounded-full border-b border-purple-500/20 flex items-center justify-center font-mono text-[7px] text-purple-400">
                          GSAP Wave: {track.timelineData.duration || 1.5}s loop active 
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Mini Inline Keyframe parameters editor */}
        <div className="w-72 shrink-0 flex flex-col min-h-0 bg-[#0E0E12] p-3 font-mono">
          <div className="border-b border-[#2D2D33]/60 pb-1.5 mb-2.5 flex justify-between items-center bg-[#0C0C10] -mx-3 -mt-3 px-3 py-2 shrink-0">
            <span className="text-[8.5px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
              <Key className="w-3.5 h-3.5" />
              <span>Keypoint Inspector</span>
            </span>
            {selectedKeyframe && (
              <span className="text-[8px] text-[#71717A]">
                Track: #{selectedKeyframe.trackIdx + 1}
              </span>
            )}
          </div>

          {selectedKfObject && selectedKeyframe ? (
            <div className="space-y-3 flex-1 flex flex-col justify-between">
              
              <div className="space-y-3">
                <div className="bg-[#14141A] p-2 rounded border border-[#2D2D33]/60 text-[9px] space-y-1">
                  <span className="text-gray-500 uppercase font-semibold text-[8px] tracking-wide">Summary Coordinates</span>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sequence index:</span>
                    <span className="text-white">#{selectedKeyframe.kfIdx}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Time-stamp location:</span>
                    <span className="text-amber-300 font-bold">{selectedKfObject.time}s</span>
                  </div>
                </div>

                {/* Keypoint Time input slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[8px] text-gray-500 uppercase">
                    <span>Keyframe Time Marker</span>
                    <span className="text-white font-mono font-bold">{selectedKfObject.time.toFixed(2)}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max={activeSeq.duration}
                      step="0.05"
                      value={selectedKfObject.time}
                      onChange={(e) => handleUpdateSelectedKeyframe('time', parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max={activeSeq.duration}
                      value={Number(selectedKfObject.time.toFixed(2))}
                      onChange={(e) => handleUpdateSelectedKeyframe('time', parseFloat(e.target.value) || 0)}
                      className="w-12 bg-[#1A1A22] border border-[#2D2D33] text-right rounded p-0.5 text-[9px] text-white font-bold"
                    />
                  </div>
                </div>

                {/* Configuration Input based on model tracks */}
                <div className="space-y-1.5">
                  <span className="text-[8px] text-gray-500 uppercase block">Trigger Attributes</span>

                  {/* If Sprite track: swap value */}
                  {activeSeq.tracks[selectedKeyframe.trackIdx].trackType === 'SPRITE_FRAME' && (
                    <div className="space-y-1">
                      <span className="text-[8px] text-purple-400 block font-mono">Cell Grid Index (integer)</span>
                      <input
                        type="number"
                        min="0"
                        max="64"
                        value={selectedKfObject.value || 0}
                        onChange={(e) => handleUpdateSelectedKeyframe('value', e.target.value)}
                        className="w-full bg-[#1A1A22] border border-[#2D2D33] rounded p-1 text-[10px] text-white focus:outline-none"
                      />
                    </div>
                  )}

                  {/* If Trigger track */}
                  {activeSeq.tracks[selectedKeyframe.trackIdx].trackType === 'TRIGGER' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <span className="text-[8px] text-yellow-500 block font-mono">Metronome command</span>
                        <select
                          value={selectedKfObject.action || 'ALERT'}
                          onChange={(e) => handleUpdateSelectedKeyframe('action', e.target.value)}
                          className="w-full bg-[#1A1A22] border border-[#2D2D33] rounded p-1 text-[10px] text-white focus:outline-none cursor-pointer"
                        >
                          <option value="ALERT">ALERT MODAL DIALOGUE</option>
                          <option value="CONSOLE">CONSOLE TELEMETRY LINE</option>
                          <option value="RESTART">AUTO REBOOT SIMULATION</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] text-gray-500 block font-mono">Action Value payload</span>
                        <input
                          type="text"
                          value={selectedKfObject.value || ''}
                          onChange={(e) => handleUpdateSelectedKeyframe('value', e.target.value)}
                          placeholder="e.g. Danger Room activated!"
                          className="w-full bg-[#1A1A22] border border-[#2D2D33] rounded p-1 text-[10px] text-white focus:outline-none placeholder-gray-600"
                        />
                      </div>
                    </div>
                  )}

                  {activeSeq.tracks[selectedKeyframe.trackIdx].trackType === 'GSAP_TWEEN' && (
                    <div className="text-[8.5px] italic text-[#71717A] leading-relaxed bg-[#1A1A22] border border-[#2D2D33]/60 p-2 rounded">
                      GSAP parameters are compiled dynamically and run in a continuous loop. Add timeline keyframe anchors to synchronize discrete flipbooks inside the loop!
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-[#2D2D33]/60 gap-1.5 flex shrink-0">
                <button
                  type="button"
                  onClick={handleDeleteSelectedKeyframe}
                  className="flex-1 py-1 font-sans text-[10px] bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded cursor-pointer font-bold transition flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>Delete Keyframe</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedKeyframe(null)}
                  className="px-2 py-1 font-sans text-[10px] bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded cursor-pointer transition text-center"
                >
                  Deselect
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-4 text-[9px] text-zinc-500 border border-dashed border-[#2D2D33]/40 rounded">
              <Key className="w-5 h-5 text-zinc-600 mb-1.5" />
              <span>No active keyframe selected. Click or drop any solid marker on the track timeline path.</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
