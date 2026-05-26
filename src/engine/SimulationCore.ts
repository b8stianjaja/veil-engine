/**
 * @file src/engine/SimulationCore.ts
 * @description Central Simulation Core for the Veil Engine runtime.
 * Executes a fixed 60Hz simulation step via a time accumulator.
 * Refactored to act as a System Manager, enabling decoupled engine expansion.
 * Strictly adheres to Pillar 1 architectural rules: 100% React-independent.
 */

import EventBus from './protocol/EventBus';
import AnimationDirector from './systems/AnimationDirector';
import { Entity, Transformation3D, VeilProjectManifest } from '../types';

// System Interface for decoupled logic
export interface IEngineSystem {
  update(
    delta: number, 
    entities: Map<string, SimulationEntityState>, 
    keys: Record<string, boolean>
  ): void;
}

interface SimulationEntityState {
  uuid: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  behavior: string;
  isSensor: boolean;
  name: string;
}

class SimulationCore {
  private active: boolean = false;
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly FIXED_DELTA: number = 1 / 60;

  // Registered Systems
  private systems: IEngineSystem[] = [];

  // Active compiled states
  private manifest: VeilProjectManifest | null = null;
  public runtimeEntities: Map<string, SimulationEntityState> = new Map();
  private keysPressed: Record<string, boolean> = {};

  // Input listener references
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.handleKeyDown = (e: KeyboardEvent) => { this.keysPressed[e.key.toLowerCase()] = true; };
    this.handleKeyUp = (e: KeyboardEvent) => { this.keysPressed[e.key.toLowerCase()] = false; };
    
    this.setupInputs();
    this.registerEventBusListeners();
  }

  private setupInputs(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }
  }

  private registerEventBusListeners(): void {
    EventBus.on('START_SIMULATION', (manifest: VeilProjectManifest) => this.start(manifest));
    EventBus.on('STOP_SIMULATION', () => this.stop());
  }

  // Allow dynamic system registration
  public registerSystem(system: IEngineSystem): void {
    this.systems.push(system);
  }

  public start(manifest: VeilProjectManifest): void {
    if (this.active) return;
    this.manifest = manifest;
    this.active = true;
    this.accumulator = 0;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    this.runtimeEntities.clear();
    AnimationDirector.reset();

    if (manifest.timelineEvents && manifest.timelineEvents.length > 0) {
      manifest.timelineEvents.forEach(seq => AnimationDirector.playSequence(seq.id, manifest.timelineEvents));
    }

    const addEntitiesFromLayer = (layerArray: any[]) => {
      layerArray.forEach(entity => {
        this.runtimeEntities.set(entity.uuid, {
          uuid: entity.uuid,
          position: [...entity.renderMeta.screenOffset, entity.renderMeta.depthKey] as [number, number, number],
          rotation: [0, 0, entity.renderMeta.rotation2d] as [number, number, number],
          scale: [...entity.renderMeta.scale2d, 1] as [number, number, number],
          behavior: entity.behavior,
          isSensor: false,
          name: entity.name || 'Entity'
        });
      });
    };

    addEntitiesFromLayer(manifest.layers.background);
    addEntitiesFromLayer(manifest.layers.gameplay);
    addEntitiesFromLayer(manifest.layers.foreground);

    if (manifest.colliders) {
      manifest.colliders.forEach(coll => {
        const ent = this.runtimeEntities.get(coll.entityUuid);
        if (ent) ent.isSensor = coll.isSensor;
      });
    }

    EventBus.emit('SIMULATION_STARTED');
    this.loop();
  }

  public stop(): void {
    if (!this.active) return;
    this.active = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    AnimationDirector.reset();
    EventBus.emit('SIMULATION_STOPPED');
  }

  private loop = (): void => {
    if (!this.active) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let delta = (now - this.lastTime) / 1000.0;
    this.lastTime = now;
    if (delta > 0.1) delta = 0.1;
    this.accumulator += delta;

    while (this.accumulator >= this.FIXED_DELTA) {
      this.tick(this.FIXED_DELTA);
      this.accumulator -= this.FIXED_DELTA;
    }
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private tick(delta: number): void {
    // 1. Core Systems
    AnimationDirector.tick(delta);
    
    // 2. Execute dynamic systems
    for (const system of this.systems) {
      system.update(delta, this.runtimeEntities, this.keysPressed);
    }

    // 3. Emit update
    const batchPositions: Record<string, [number, number, number]> = {};
    const batchRotations: Record<string, [number, number, number]> = {};
    this.runtimeEntities.forEach(ent => {
      batchPositions[ent.uuid] = ent.position;
      batchRotations[ent.uuid] = ent.rotation;
    });

    EventBus.emit('SIMULATION_TICK', {
      positions: batchPositions,
      rotations: batchRotations
    });
  }
}

const simulationCoreInstance = new SimulationCore();
export default simulationCoreInstance;