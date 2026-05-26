/**
 * @file src/components/SimulationOverlay.tsx
 * @description Renders the compiled 2D hand-drawn sprite runtime environment.
 * Maps coordinates, layers (bg, gp, fg), live health indicators, dialogue screens, and scoring.
 * ENHANCED: Utilizes a Unified Master requestAnimationFrame Loop for perfectly smooth, tear-free particle and camera physics.
 */

import React, { useState, useEffect, useRef } from 'react';
import EventBus from '../engine/protocol/EventBus';
import { VeilProjectManifest } from '../types';
import { ShieldAlert, Trophy, Award, Keyboard, Compass } from 'lucide-react';
import { HeroKnight, StonePillar, GoldStar, SpikeTrap, CrystalRotator, ScenicTree } from './SgAssets';
import { useSpatialEditorStore } from '../app/store';

interface SimulationOverlayProps {
  manifest: VeilProjectManifest | null;
  theme?: 'LIGHT' | 'DARK';
  workspace?: 'ARTIST' | 'DEVELOPER';
}

interface LiveParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

export default function SimulationOverlay({ manifest, theme = 'DARK', workspace = 'ARTIST' }: SimulationOverlayProps) {
  const { layerVisibility } = useSpatialEditorStore();
  const [positions, setPositions] = useState<Record<string, [number, number, number]>>({});
  const [rotations, setRotations] = useState<Record<string, [number, number, number]>>({});
  const [score, setScore] = useState<number>(0);
  const [hp, setHp] = useState<number>(100);
  const [isHitFlashing, setIsHitFlashing] = useState<boolean>(false);
  const [collectedStarUuids, setCollectedStarUuids] = useState<Set<string>>(new Set());
  const [dialogueText, setDialogueText] = useState<string | null>(null);
  const [particles, setParticles] = useState<LiveParticle[]>([]);

  // Keyboard helper state keys mapping
  const [keysState, setKeysState] = useState<Record<string, boolean>>({ w: false, a: false, s: false, d: false });

  // Hot Game Modes / Curation Objectives
  const [totalStars, setTotalStars] = useState<number>(0);
  const [gameResult, setGameResult] = useState<'PLAYING' | 'VICTORY' | 'GAMEOVER'>('PLAYING');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  
  const simStartTimeRef = useRef<number>(Date.now());
  const particlesRef = useRef<LiveParticle[]>([]);
  
  // Camera center coordinates representation
  const [camX, setCamX] = useState<number>(0);
  const [camY, setCamY] = useState<number>(0);
  const [cameraLock, setCameraLock] = useState<boolean>(workspace === 'DEVELOPER');
  
  // Mutable refs for the Master Animation Loop to avoid stale closures without triggering React renders
  const camPosRef = useRef({ x: 0, y: 0 });
  const targetPosRef = useRef({ x: 0, y: 0 });
  const cameraLockRef = useRef(cameraLock);
  const gameResultRef = useRef(gameResult);

  const viewportWidth = 600;
  const viewportHeight = 350;

  // Keep Refs synchronized with React State
  useEffect(() => { particlesRef.current = particles; }, [particles]);
  useEffect(() => { cameraLockRef.current = cameraLock; }, [cameraLock]);
  useEffect(() => { gameResultRef.current = gameResult; }, [gameResult]);
  useEffect(() => { setCameraLock(workspace === 'DEVELOPER'); }, [workspace]);

  // Boot initialization
  useEffect(() => {
    if (!manifest) return;
    const allLayers = [...(manifest.layers.background || []), ...(manifest.layers.gameplay || []), ...(manifest.layers.foreground || [])];
    const playerEnt = allLayers.find(ent => ent.behavior === 'PLAYER');
    
    const initX = playerEnt ? playerEnt.renderMeta.screenOffset[0] : 0;
    const initY = playerEnt ? playerEnt.renderMeta.screenOffset[1] : 0;
    
    setCamX(initX);
    setCamY(initY);
    camPosRef.current = { x: initX, y: initY };
    targetPosRef.current = { x: initX, y: initY };

    setTotalStars(allLayers.filter(ent => ent.behavior === 'COLLECTIBLE').length);
    setGameResult('PLAYING');
    simStartTimeRef.current = Date.now();
    setElapsedSeconds(0);
  }, [manifest]);

  // Update target coordinates based on actual physics simulation output
  useEffect(() => {
    if (!manifest) return;
    const playerEnt = [...(manifest.layers.background || []), ...(manifest.layers.gameplay || []), ...(manifest.layers.foreground || [])]
      .find(ent => ent.behavior === 'PLAYER');
      
    if (playerEnt && positions[playerEnt.uuid]) {
      targetPosRef.current = { x: positions[playerEnt.uuid][0], y: positions[playerEnt.uuid][1] };
    }
  }, [positions, manifest]);

  // ============================================================================
  // THE MASTER LOOP: Unified Engine Rendering Ticker (Replaces all setIntervals)
  // ============================================================================
  useEffect(() => {
    let frameId: number;
    let lastTime = performance.now();

    const engineLoop = (time: number) => {
      // Normalize delta time to 60fps baseline scalar for consistent physics speed on any monitor Hz
      const dt = (time - lastTime) / 16.666; 
      lastTime = time;

      // 1. Timer Logic
      if (gameResultRef.current === 'PLAYING') {
        setElapsedSeconds(parseFloat(((Date.now() - simStartTimeRef.current) / 1000).toFixed(1)));
      }

      // 2. Camera Lerp Logic (Smooth dampening)
      let nextCamX = camPosRef.current.x;
      let nextCamY = camPosRef.current.y;
      
      if (cameraLockRef.current && gameResultRef.current === 'PLAYING') {
        nextCamX += (targetPosRef.current.x - nextCamX) * (0.15 * dt);
        nextCamY += (targetPosRef.current.y - nextCamY) * (0.15 * dt);
      } else if (!cameraLockRef.current) {
        nextCamX += (0 - nextCamX) * (0.1 * dt);
        nextCamY += (0 - nextCamY) * (0.1 * dt);
      }

      // If camera shifted, dynamically drift active particles to preserve absolute world-space illusion
      const dx = (nextCamX - camPosRef.current.x) * 40;
      const dy = -(nextCamY - camPosRef.current.y) * 40; // Inverted Y

      camPosRef.current = { x: nextCamX, y: nextCamY };
      setCamX(nextCamX);
      setCamY(nextCamY);

    // 3. Particle Physics Logic
      if (particlesRef.current.length > 0) {
        setParticles(prev => 
          prev.map((p: LiveParticle) => ({
            ...p,
            x: (p.x - dx) + (p.vx * dt),
            y: (p.y - dy) + (p.vy * dt),
            vy: p.vy + (0.15 * dt), // Gravity pull
            life: p.life - (0.04 * dt)
          })).filter((p: LiveParticle) => p.life > 0)
        );
      }

      frameId = requestAnimationFrame(engineLoop);
    };

    frameId = requestAnimationFrame(engineLoop);
    return () => cancelAnimationFrame(frameId);
  }, []); // Run infinitely, bound to refs

  // Keyboard mappings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameResult !== 'PLAYING') return;
      let k = e.key.toLowerCase();
      if (k === 'arrowup') k = 'w';
      if (k === 'arrowleft') k = 'a';
      if (k === 'arrowdown') k = 's';
      if (k === 'arrowright') k = 'd';
      if (['w', 'a', 's', 'd'].includes(k)) setKeysState(prev => ({ ...prev, [k]: true }));
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      let k = e.key.toLowerCase();
      if (k === 'arrowup') k = 'w';
      if (k === 'arrowleft') k = 'a';
      if (k === 'arrowdown') k = 's';
      if (k === 'arrowright') k = 'd';
      if (['w', 'a', 's', 'd'].includes(k)) setKeysState(prev => ({ ...prev, [k]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameResult]);

  // Victory Condition Checker
  useEffect(() => {
    if (totalStars > 0 && collectedStarUuids.size === totalStars && gameResult === 'PLAYING') {
      setGameResult('VICTORY');
      const confetti = Array.from({ length: 45 }).map((_, i) => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const speed = Math.random() * 7 + 5;
        return {
          id: Math.random() + i,
          x: viewportWidth * (0.15 + Math.random() * 0.7),
          y: viewportHeight - 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: ['#FBBF24', '#10B981', '#3B82F6', '#EC4899', '#A855F7'][Math.floor(Math.random() * 5)],
          size: Math.random() * 4.5 + 3,
          life: 1.6
        };
      });
      setParticles(prev => [...prev, ...confetti]);
    }
  }, [collectedStarUuids, totalStars, gameResult]);

  const mapToScreenCoords = (pos: [number, number, number]) => {
    const scaleFactor = 40;
    return { 
      x: (viewportWidth / 2) + ((pos[0] - camX) * scaleFactor), 
      y: (viewportHeight / 2) - ((pos[1] - camY) * scaleFactor) 
    };
  };

  useEffect(() => {
    const handleTick = (data: { positions: Record<string, [number, number, number]>; rotations: Record<string, [number, number, number]> }) => {
      if (gameResult !== 'PLAYING') return;
      setPositions(data.positions);
      setRotations(data.rotations);

      const isMoving = keysState.w || keysState.a || keysState.s || keysState.d;
      if (isMoving && Math.random() < 0.2) {
        let playerPos = [0, 0, 0] as [number, number, number];
        Object.keys(data.positions).forEach(key => {
          if (manifest?.layers.gameplay.find(ent => ent.uuid === key && ent.behavior === 'PLAYER')) playerPos = data.positions[key];
        });
        const pxCoords = mapToScreenCoords(playerPos);
        setParticles(prev => [...prev, {
          id: Math.random(),
          x: pxCoords.x + (Math.random() - 0.5) * 16,
          y: pxCoords.y + 14,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 0.8,
          color: '#A1A1AA',
          size: Math.random() * 3.5 + 1.5,
          life: 0.8
        }]);
      }
    };

    const handleCollected = (data: any) => {
      if (gameResult !== 'PLAYING') return;
      setScore(s => s + 100);
      setCollectedStarUuids(prev => new Set(prev).add(data.uuid));
      setDialogueText(`Star collected! Core stability increased: +100pts`);
      setTimeout(() => setDialogueText(null), 2500);

      const pxCoords = mapToScreenCoords(positions[data.uuid] || [0, 0, 0]);
      const newSparkles = Array.from({ length: 16 }).map((_, i) => ({
        id: Math.random() + i,
        x: pxCoords.x,
        y: pxCoords.y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6 - 2.5,
        color: '#FBBF24',
        size: Math.random() * 4.5 + 1.5,
        life: 1.0
      }));
      setParticles(prev => [...prev, ...newSparkles]);
    };

    const handleHazard = (data: any) => {
      if (gameResult !== 'PLAYING') return;
      setHp(h => {
        const nextHp = Math.max(0, h - 15);
        if (nextHp === 0) setGameResult('GAMEOVER');
        return nextHp;
      });
      setIsHitFlashing(true);
      setTimeout(() => setIsHitFlashing(false), 200);

      let pxCoords = { x: viewportWidth / 2, y: viewportHeight / 2 };
      Object.keys(positions).forEach(key => {
        if ((manifest?.layers.gameplay || []).find(ent => ent.uuid === key && ent.behavior === 'PLAYER')) {
          pxCoords = mapToScreenCoords(positions[key]);
        }
      });

      const newSparks = Array.from({ length: 18 }).map((_, i) => ({
        id: Math.random() + i,
        x: pxCoords.x + (Math.random() - 0.5) * 12,
        y: pxCoords.y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 1,
        color: '#EF4444',
        size: Math.random() * 5.5 + 2,
        life: 1.0
      }));
      setParticles(prev => [...prev, ...newSparks]);
    };

    const handleTrigger = (data: any) => {
      if (gameResult !== 'PLAYING') return;
      setDialogueText(`COMPILER TRIGGER SECURED: Navigated sensor area of '${data.name}'.`);
      setTimeout(() => setDialogueText(null), 3000);

      const pxCoords = mapToScreenCoords(positions[data.uuid] || [0,0,0]);
      const newSparks = Array.from({ length: 8 }).map((_, i) => ({
        id: Math.random() + i,
        x: pxCoords.x,
        y: pxCoords.y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        color: '#60A5FA',
        size: Math.random() * 3 + 2,
        life: 0.9
      }));
      setParticles(prev => [...prev, ...newSparks]);
    };

    const handleExecuteEvent = (data: any) => {
      if (data.action === 'ALERT' && data.params?.message) {
        setDialogueText(`TIMELINE ANCHOR: "${data.params.message}"`);
        setTimeout(() => setDialogueText(null), 4000);
      }
    };

    EventBus.on('SIMULATION_TICK', handleTick);
    EventBus.on('PLAYER_COLLECTED', handleCollected);
    EventBus.on('PLAYER_HIT_HAZARD', handleHazard);
    EventBus.on('TRIGGER_ACTIVATED', handleTrigger);
    EventBus.on('EXECUTE_EVENT', handleExecuteEvent);

    return () => {
      EventBus.off('SIMULATION_TICK', handleTick);
      EventBus.off('PLAYER_COLLECTED', handleCollected);
      EventBus.off('PLAYER_HIT_HAZARD', handleHazard);
      EventBus.off('TRIGGER_ACTIVATED', handleTrigger);
      EventBus.off('EXECUTE_EVENT', handleExecuteEvent);
    };
  }, [positions, manifest, keysState, gameResult]);

  const triggerSimKeyDown = (keyChar: string) => {
    if (gameResult !== 'PLAYING') return;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: keyChar }));
  };

  const triggerSimKeyUp = (keyChar: string) => {
    if (gameResult !== 'PLAYING') return;
    window.dispatchEvent(new KeyboardEvent('keyup', { key: keyChar }));
  };

  const handleHotRestart = () => {
    setHp(100);
    setScore(0);
    setCollectedStarUuids(new Set());
    setDialogueText("CORE REHEATED: Sim re-compiled with clean states.");
    setGameResult('PLAYING');
    setParticles([]);
    simStartTimeRef.current = Date.now();
    setElapsedSeconds(0);
    
    EventBus.emit('STOP_SIMULATION');
    setTimeout(() => { if (manifest) EventBus.emit('START_SIMULATION', manifest); }, 30);
  };

  const handleAbort = () => EventBus.emit('STOP_SIMULATION');

  if (!manifest) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center font-mono text-xs select-none p-4 rounded text-center border transition-colors ${theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6] text-gray-400' : 'bg-[#070709] border-[#232326] text-gray-500'}`}>
        <ShieldAlert className="w-8 h-8 text-yellow-600 mb-2 animate-bounce" />
        <p className="max-w-[400px]">Compile Pipeline pending. Click "Compile & Play" in the primary editor cockpit to generate the 2D manifest and boot operations.</p>
      </div>
    );
  }

  const renderList: any[] = [];
  const addLayerToRender = (entitiesArray: any[]) => {
    entitiesArray.forEach(ent => {
      if (collectedStarUuids.has(ent.uuid)) return;
      const currentPos = positions[ent.uuid] ?? [...ent.renderMeta.screenOffset, ent.renderMeta.depthKey];
      const currentRot = rotations[ent.uuid] ?? [0, 0, ent.renderMeta.rotation2d];
      renderList.push({ ...ent, currentPos, currentRotZ: currentRot[2] });
    });
  };

  if (layerVisibility.background) addLayerToRender(manifest.layers.background || []);
  if (layerVisibility.gameplay) addLayerToRender(manifest.layers.gameplay || []);
  if (layerVisibility.foreground) addLayerToRender(manifest.layers.foreground || []);

  return (
    <div className={`w-full h-full flex flex-col rounded-lg overflow-hidden relative font-sans border transition-colors ${theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#070709] border-[#232326] text-gray-300'}`} id="simulation-viewport-box">
      
      {/* Simulation status headers */}
      <div className={`px-4 py-2 border-b flex items-center justify-between text-xs font-mono transition-colors ${theme === 'LIGHT' ? 'bg-[#E5E5EA] border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#121214] border-[#232326] text-gray-300'}`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
          <span className="text-emerald-500 font-bold uppercase select-none tracking-widest">VEIL ENGINE RUNTIME (2D PIPELINE)</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-semibold text-gray-400 select-none">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#17171A] border-[#232326]'}`}>
            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
            <span>Score:</span>
            <span className="text-yellow-600 font-mono font-bold">{score}</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${theme === 'LIGHT' ? 'bg-white border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#17171A] border-[#232326]'}`}>
            <Award className="w-3.5 h-3.5 text-red-500" />
            <span>Health:</span>
            <span className={`font-mono font-bold ${hp < 40 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>{hp}%</span>
          </div>
        </div>
      </div>

      {/* Screen container */}
      <div className={`flex-1 relative w-full h-[350px] overflow-hidden flex items-center justify-center transition-colors ${theme === 'LIGHT' ? 'bg-[#F2F2F7]' : 'bg-[#0E0E12]'}`}>
        
        {/* Camera lock overlay */}
        <div className={`absolute top-4 right-4 border px-2.5 py-1.5 rounded text-[9.5px] font-mono flex items-center gap-2 z-30 shadow-lg ${theme === 'LIGHT' ? 'bg-white/95 border-[#E5E5EA] text-[#1C1C1E]' : 'bg-[#121216]/95 border-purple-500/25 text-gray-200'}`}>
          <div className="flex items-center gap-1.5 select-none">
            <Compass className={`w-3.5 h-3.5 transition-all duration-300 ${cameraLock ? 'text-purple-400 animate-pulse' : 'text-zinc-500'}`} style={{ transform: cameraLock ? 'rotate(135deg)' : 'rotate(0deg)' }} />
            <span className={theme === 'LIGHT' ? 'text-zinc-700 font-semibold' : 'text-zinc-400 font-semibold'}>CAMERA:</span>
            <span className={`font-bold uppercase tracking-tight ${cameraLock ? 'text-purple-400' : 'text-zinc-500'}`}>{cameraLock ? 'LOCKED (PLAYER)' : 'FREE ROAM'}</span>
          </div>
          <div className={`w-[1px] h-3 ${theme === 'LIGHT' ? 'bg-[#E5E5EA]' : 'bg-[#232326]'}`} />
          <button onClick={() => setCameraLock(!cameraLock)} className={`px-1.5 py-0.5 rounded text-[8px] font-semibold tracking-wider uppercase cursor-pointer select-none transition-all duration-150 ${cameraLock ? 'bg-purple-600/30 border border-purple-500/40 hover:bg-purple-500/40 text-purple-300' : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400'}`}>
            {cameraLock ? 'Unlock' : 'Lock'}
          </button>
        </div>

        {/* Rasterized Matrix Background Grid */}
        <div 
          className={`absolute inset-0 pointer-events-none select-none ${theme === 'LIGHT' ? 'bg-[#F2F2F7] bg-[radial-gradient(#C7C7CC_1px,transparent_1px)]' : 'bg-[#08080C] bg-[radial-gradient(#1E1E24_1.5px,transparent_1.5px)]'}`}
          style={{ backgroundSize: '20px 20px', backgroundPosition: `${-(camX * 40) % 20}px ${(camY * 40) % 20}px` }}
        />

        {isHitFlashing && <div className="absolute inset-0 bg-red-600/25 border-4 border-red-500 backdrop-blur-[0.5px] z-40 pointer-events-none animate-pulse" />}

        {/* World Entities */}
        <div className="absolute w-[600px] h-[350px] border border-gray-900/40 rounded overflow-hidden">
          {renderList.map((ent, idx) => {
            const { x, y } = mapToScreenCoords(ent.currentPos);
            const sizeX = ent.behavior === 'PLAYER' ? 52 : ent.renderMeta.scale2d[0] * 42;
            const sizeY = ent.behavior === 'PLAYER' ? 52 : ent.renderMeta.scale2d[1] * 42;
            const isMoving = keysState.w || keysState.a || keysState.s || keysState.d;
            
            let heroDirection: 'left' | 'right' | 'up' | 'down' = 'right';
            if (keysState.a) heroDirection = 'left';
            else if (keysState.d) heroDirection = 'right';
            else if (keysState.w) heroDirection = 'up';
            else if (keysState.s) heroDirection = 'down';

            let elementVisual: React.ReactNode = null;
            if (ent.behavior === 'PLAYER') elementVisual = <HeroKnight isMoving={isMoving} direction={heroDirection} color={ent.color} />;
            else if (ent.behavior === 'COLLECTIBLE') elementVisual = <GoldStar />;
            else if (ent.behavior === 'HAZARD') elementVisual = <SpikeTrap />;
            else if (ent.behavior === 'ROTATOR') elementVisual = <CrystalRotator color={ent.color} />;
            else if (ent.behavior === 'STATIC') {
              if (ent.name.toLowerCase().includes('tree') || ent.assetFilename?.toLowerCase().includes('tree')) elementVisual = <ScenicTree />;
              else elementVisual = <StonePillar color={ent.color} />;
            }

            return (
              <div key={idx} className="absolute transition-all duration-75 flex flex-col justify-center items-center select-none" style={{ left: `${x}px`, top: `${y}px`, width: `${sizeX}px`, height: `${sizeY}px`, transform: `translate(-50%, -50%) rotate(${ent.behavior === 'PLAYER' ? 0 : ent.currentRotZ}rad)` }}>
                <div className="w-full h-full relative">{elementVisual}</div>
                <div className="absolute -bottom-4 bg-black/85 border border-gray-800/80 text-[7px] font-mono px-1 py-0.2 rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none select-none whitespace-nowrap z-30">
                  {ent.name} ({ent.currentPos[0].toFixed(1)}, {ent.currentPos[1].toFixed(1)})
                </div>
              </div>
            );
          })}

       
          {particles.map((p: LiveParticle) => (
            <div
              key={p.id} className="absolute rounded-full pointer-events-none select-none transition-transform" style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${p.size}px`, height: `${p.size}px`, backgroundColor: p.color, opacity: p.life, boxShadow: `0 0 10px ${p.color}`, transform: 'translate(-50%, -50%) scale(1)' }} />
          ))}

          {/* Scalable Freehand Drawings Layer */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
            {manifest.drawingStrokes?.map((stroke: any, idx: number) => {
              if (stroke.layer && !layerVisibility[stroke.layer as 'background' | 'gameplay' | 'foreground']) return null;
              const pts = stroke.points.map((pt: [number, number]) => {
                const dZ = stroke.layer === 'background' ? -15 : stroke.layer === 'foreground' ? 12 : 0;
                return mapToScreenCoords([pt[0], pt[1], dZ]);
              });
              if (pts.length === 0) return null;
              
              let dPath = `M ${pts[0].x} ${pts[0].y}`;
              if (pts.length === 1) dPath += ` l 0.1 0`;
              else dPath += pts.slice(1).map((p: {x: number, y: number}) => ` L ${p.x} ${p.y}`).join('');

              return <path key={stroke.uuid || idx} d={dPath} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" opacity={stroke.layer === 'background' ? 0.6 : stroke.layer === 'foreground' ? 1.0 : 0.85} />;
            })}
          </svg>

          {/* Victory Overlay Screen */}
          {gameResult === 'VICTORY' && (
            <div className="absolute inset-0 bg-[#070709]/95 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center text-center select-none animate-fade-in font-mono p-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center mb-2.5 animate-bounce shadow-lg shadow-emerald-500/20"><Trophy className="w-6 h-6 text-emerald-400" /></div>
              <h3 className="text-emerald-400 font-extrabold tracking-widest text-xs uppercase">STABILITY SECURED</h3>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-0.5">Project coordinates compiled & fully solved</p>
              <div className="my-3 bg-[#111115]/85 border border-[#232326] rounded px-5 py-2 max-w-xs w-full text-left text-[10px] space-y-1">
                <div className="flex justify-between items-center text-zinc-400"><span>Duration:</span><span className="text-white font-bold">{elapsedSeconds.toFixed(1)}s</span></div>
                <div className="flex justify-between items-center text-zinc-400"><span>Final Score:</span><span className="text-yellow-500 font-extrabold font-mono">{score} pts</span></div>
                <div className="flex justify-between items-center text-zinc-400"><span>System Integrity:</span><span className="text-emerald-400 font-bold">{hp}%</span></div>
              </div>
              <div className="flex gap-2 w-full max-w-xs mt-1">
                <button onClick={handleHotRestart} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-[9px] py-1.5 rounded transition cursor-pointer shadow-md shadow-emerald-500/20 uppercase tracking-wider">Play Again</button>
                <button onClick={handleAbort} className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-gray-300 font-sans font-bold text-[9px] py-1.5 rounded border border-zinc-700 transition cursor-pointer uppercase tracking-wider">Exit Layout</button>
              </div>
            </div>
          )}

          {/* Game Over Screen */}
          {gameResult === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-red-950/95 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center text-center select-none animate-fade-in font-mono p-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500 flex items-center justify-center mb-2.5 animate-pulse shadow-lg shadow-red-500/10"><ShieldAlert className="w-6 h-6 text-red-500" /></div>
              <h3 className="text-red-500 font-extrabold tracking-widest text-xs uppercase">INTEGRITY BREACHED</h3>
              <p className="text-[9px] text-red-400/70 uppercase tracking-widest mt-0.5">Player health depleted to zero</p>
              <div className="my-3 bg-black/60 border border-red-950/60 rounded px-5 py-2 max-w-xs w-full text-left text-[10px] space-y-1">
                <div className="flex justify-between items-center text-red-400"><span>Failure:</span><span className="font-bold">Hazard Impact</span></div>
                <div className="flex justify-between items-center text-zinc-400"><span>Time Elapsed:</span><span className="text-white font-bold">{elapsedSeconds.toFixed(1)}s</span></div>
                <div className="flex justify-between items-center text-zinc-400"><span>Collected Stars:</span><span className="text-yellow-500 font-bold">{collectedStarUuids.size} / {totalStars}</span></div>
              </div>
              <div className="flex gap-2 w-full max-w-xs mt-1">
                <button onClick={handleHotRestart} className="flex-1 bg-red-650 hover:bg-red-600 text-white font-sans font-bold text-[9px] py-1.5 rounded transition cursor-pointer shadow-md shadow-red-500/20 uppercase tracking-wider">Restart Level</button>
                <button onClick={handleAbort} className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-gray-300 font-sans font-bold text-[9px] py-1.5 rounded border border-zinc-805 transition cursor-pointer uppercase tracking-wider">Abort Sim</button>
              </div>
            </div>
          )}
        </div>

        {dialogueText && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[#121214]/95 border-2 border-blue-600 px-4 py-2.5 rounded shadow-2xl z-30 font-mono text-center select-all max-w-[480px] animate-fade-in animate-slide-up">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide leading-none mb-1">Veil System Intercept</p>
            <p className="text-[11px] text-gray-200 mt-1">{dialogueText}</p>
          </div>
        )}
        <div className="absolute top-4 left-4 bg-[#0A0A0C]/80 border border-[#232326] px-2 py-1.5 rounded text-[9px] font-mono text-gray-500 tracking-tight pointer-events-none"><span>🎮 WASD: movement</span></div>
      </div>

      {/* Mobile-friendly Touch controllers */}
      <div className={`border-t px-4 py-3 flex items-center justify-between transition-colors ${theme === 'LIGHT' ? 'bg-[#FFFFFF] border-[#D1D1D6]' : 'bg-[#0E0E10] border-[#232326]'}`}>
        <div className={`flex items-center gap-2 text-[10px] font-mono transition-colors ${theme === 'LIGHT' ? 'text-[#55555C]' : 'text-gray-500'}`}>
          <Keyboard className={`w-4 h-4 transition-colors ${theme === 'LIGHT' ? 'text-gray-400' : 'text-gray-600'}`} />
          <span>Inputs active. You can use W, A, S, D physical keys safely.</span>
        </div>
        <div className="flex gap-1">
          <button onMouseDown={() => triggerSimKeyDown('a')} onMouseUp={() => triggerSimKeyUp('a')} onTouchStart={() => triggerSimKeyDown('a')} onTouchEnd={() => triggerSimKeyUp('a')} className={`w-9 h-9 flex items-center justify-center font-mono font-bold text-xs rounded border transition cursor-pointer select-none ${keysState.a ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#18181C] border-[#2d2d30] text-gray-400'}`}>A</button>
          <div className="flex flex-col gap-1">
            <button onMouseDown={() => triggerSimKeyDown('w')} onMouseUp={() => triggerSimKeyUp('w')} onTouchStart={() => triggerSimKeyDown('w')} onTouchEnd={() => triggerSimKeyUp('w')} className={`w-9 h-9 flex items-center justify-center font-mono font-bold text-xs rounded border transition cursor-pointer select-none ${keysState.w ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#18181C] border-[#2d2d30] text-gray-400'}`}>W</button>
            <button onMouseDown={() => triggerSimKeyDown('s')} onMouseUp={() => triggerSimKeyUp('s')} onTouchStart={() => triggerSimKeyDown('s')} onTouchEnd={() => triggerSimKeyUp('s')} className={`w-9 h-9 flex items-center justify-center font-mono font-bold text-xs rounded border transition cursor-pointer select-none ${keysState.s ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#18181C] border-[#2d2d30] text-gray-400'}`}>S</button>
          </div>
          <button onMouseDown={() => triggerSimKeyDown('d')} onMouseUp={() => triggerSimKeyUp('d')} onTouchStart={() => triggerSimKeyDown('d')} onTouchEnd={() => triggerSimKeyUp('d')} className={`w-9 h-9 flex items-center justify-center font-mono font-bold text-xs rounded border transition cursor-pointer select-none ${keysState.d ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : theme === 'LIGHT' ? 'bg-[#F2F2F7] border-[#D1D1D6] text-[#1C1C1E]' : 'bg-[#18181C] border-[#2d2d30] text-gray-400'}`}>D</button>
        </div>
      </div>
    </div>
  );
}