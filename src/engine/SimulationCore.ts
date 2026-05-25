/**
 * @file src/engine/SimulationCore.ts
 * @description Central Simulation Core for the Veil Engine runtime.
 * Executes the 60Hz metronome loop, processes input maps, resolves bounding collisions (AABB),
 * manages player/rotator physical motions, and tracks overlap sensors.
 * Strictly adheres to Pillar 1 architectural rules: 100% React-independent.
 */

import EventBus from './protocol/EventBus';
import AnimationDirector from './systems/AnimationDirector';
import { Entity, Transformation3D, VeilProjectManifest } from '../types';

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

  // Active compiled states
  private manifest: VeilProjectManifest | null = null;
  private runtimeEntities: Map<string, SimulationEntityState> = new Map();

  // Keyboard state
  private keysPressed: Record<string, boolean> = {};

  // Pre-allocated vectors for math/physics to guarantee 0% GC pressure
  private workingVelocity: [number, number, number] = [0, 0, 0];
  private workingPos: [number, number, number] = [0, 0, 0];
  private aabbMinA: [number, number, number] = [0, 0, 0];
  private aabbMaxA: [number, number, number] = [0, 0, 0];
  private aabbMinB: [number, number, number] = [0, 0, 0];
  private aabbMaxB: [number, number, number] = [0, 0, 0];

  constructor() {
    this.setupInputs();
    this.registerEventBusListeners();
  }

  private setupInputs(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        this.keysPressed[e.key.toLowerCase()] = true;
      });
      window.addEventListener('keyup', (e) => {
        this.keysPressed[e.key.toLowerCase()] = false;
      });
    }
  }

  private registerEventBusListeners(): void {
    EventBus.on('START_SIMULATION', (manifest: VeilProjectManifest) => {
      this.start(manifest);
    });

    EventBus.on('STOP_SIMULATION', () => {
      this.stop();
    });
  }

  /**
   * Boots the 60Hz metronome simulation.
   */
  public start(manifest: VeilProjectManifest): void {
    if (this.active) return;
    this.manifest = manifest;
    this.active = true;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Prepare runtime entity clones
    this.runtimeEntities.clear();
    AnimationDirector.reset();

    // Load active timeline sequences into director
    if (manifest.timelineEvents && manifest.timelineEvents.length > 0) {
      manifest.timelineEvents.forEach(seq => {
        AnimationDirector.playSequence(seq.id, manifest.timelineEvents);
      });
    }

    // Populate positions from layers
    const addEntitiesFromLayer = (layerArray: any[]) => {
      layerArray.forEach(entity => {
        this.runtimeEntities.set(entity.uuid, {
          uuid: entity.uuid,
          position: [...entity.renderMeta.screenOffset, entity.renderMeta.depthKey] as [number, number, number],
          rotation: [0, 0, entity.renderMeta.rotation2d] as [number, number, number],
          scale: [...entity.renderMeta.scale2d, 1] as [number, number, number],
          behavior: entity.behavior,
          isSensor: false, // Default determined by collider listing
          name: entity.name || 'Entity'
        });
      });
    };

    addEntitiesFromLayer(manifest.layers.background);
    addEntitiesFromLayer(manifest.layers.gameplay);
    addEntitiesFromLayer(manifest.layers.foreground);

    // Patch sensory fields based on compiler's colliders block
    if (manifest.colliders) {
      manifest.colliders.forEach(coll => {
        const ent = this.runtimeEntities.get(coll.entityUuid);
        if (ent) {
          ent.isSensor = coll.isSensor;
        }
      });
    }

    EventBus.emit('SIMULATION_STARTED');
    this.loop();
  }

  /**
   * Shuts down the metronome.
   */
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

    // Cap delta representing hiccups to secure stable collision grids
    if (delta > 0.1) delta = 0.1;

    this.tick(delta);

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * High-frequency tick update
   */
  private tick(delta: number): void {
    // 1. Tick animation clock
    AnimationDirector.tick(delta);

    // 2. Resolve player motion and input vector maps
    let player: SimulationEntityState | null = null;
    this.runtimeEntities.forEach(ent => {
      if (ent.behavior === 'PLAYER') {
        player = ent;
      }
    });

    if (player) {
      this.processPlayerMovement(player, delta);
    }

    // 3. Tick rotation behaviors safely
    this.runtimeEntities.forEach(ent => {
      if (ent.behavior === 'ROTATOR') {
        // Rotate Z coordinate in 2D plane (radians)
        ent.rotation[2] += delta * 1.5; // Rotate 1.5 rad/sec
      }
    });

    // 4. Resolve overlap detectors and trigger limits
    if (player) {
      this.resolveOverlaps(player);
    }

    // 5. Emit simulation update over event interface
    const batchPositions: Record<string, [number, number, number]> = {};
    const batchRotations: Record<string, [number, number, number]> = {};
    
    this.runtimeEntities.forEach(ent => {
      batchPositions[ent.uuid] = ent.position;
      batchRotations[ent.uuid] = ent.rotation;
    });

    EventBus.emit('SIMULATION_TICK', {
      positions: batchPositions,
      rotations: batchRotations,
      playerHp: (player as any)?.hp ?? 100
    });
  }

  private processPlayerMovement(player: SimulationEntityState, delta: number): void {
    const speed = 7.0; // Units per second
    this.workingVelocity[0] = 0;
    this.workingVelocity[1] = 0;

    if (this.keysPressed['w'] || this.keysPressed['arrowup']) {
      this.workingVelocity[1] += speed;
    }
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) {
      this.workingVelocity[1] -= speed;
    }
    if (this.keysPressed['d'] || this.keysPressed['arrowright']) {
      this.workingVelocity[0] += speed;
    }
    if (this.keysPressed['a'] || this.keysPressed['arrowleft']) {
      this.workingVelocity[0] -= speed;
    }

    // Normalize velocity vector
    const len = Math.sqrt(this.workingVelocity[0]**2 + this.workingVelocity[1]**2);
    if (len > 0) {
      this.workingVelocity[0] = (this.workingVelocity[0] / len) * speed;
      this.workingVelocity[1] = (this.workingVelocity[1] / len) * speed;
    }

    // Apply motion sequentially and check collisions (X axis first)
    const oldX = player.position[0];
    const oldY = player.position[1];

    player.position[0] += this.workingVelocity[0] * delta;
    if (this.checkSolidCollision(player)) {
      player.position[0] = oldX; // Blocked along X
    }

    player.position[1] += this.workingVelocity[1] * delta;
    if (this.checkSolidCollision(player)) {
      player.position[1] = oldY; // Blocked along Y
    }
  }

  /**
   * Dynamic AABB Solid Collider Resolution
   */
  private checkSolidCollision(player: SimulationEntityState): boolean {
    // Player bounds (offset from position [X,Y] with scale bounds)
    const px = player.position[0];
    const py = player.position[1];
    const pw = player.scale[0] * 0.5;
    const ph = player.scale[1] * 0.5;

    this.aabbMinA[0] = px - pw;
    this.aabbMinA[1] = py - ph;
    this.aabbMaxA[0] = px + pw;
    this.aabbMaxA[1] = py + ph;

    let isColliding = false;

    this.runtimeEntities.forEach(other => {
      if (other.uuid === player.uuid) return;
      if (other.isSensor) return; // Skip overlap flags
      if (other.behavior !== 'STATIC') return; // Only solid boxes collide

      const ox = other.position[0];
      const oy = other.position[1];
      const ow = other.scale[0] * 0.5;
      const oh = other.scale[1] * 0.5;

      this.aabbMinB[0] = ox - ow;
      this.aabbMinB[1] = oy - oh;
      this.aabbMaxB[0] = ox + ow;
      this.aabbMaxB[1] = oy + oh;

      // Check overlap on 2D planes
      const overlapX = this.aabbMaxA[0] > this.aabbMinB[0] && this.aabbMinA[0] < this.aabbMaxB[0];
      const overlapY = this.aabbMaxA[1] > this.aabbMinB[1] && this.aabbMinA[1] < this.aabbMaxB[1];

      if (overlapX && overlapY) {
        isColliding = true;
      }
    });

    return isColliding;
  }

  /**
   * Resolves sensor overlaps for Collectibles, Hazards, and Triggers.
   */
  private resolveOverlaps(player: SimulationEntityState): void {
    const px = player.position[0];
    const py = player.position[1];
    const pw = player.scale[0] * 0.5;
    const ph = player.scale[1] * 0.5;

    this.aabbMinA[0] = px - pw;
    this.aabbMinA[1] = py - ph;
    this.aabbMaxA[0] = px + pw;
    this.aabbMaxA[1] = py + ph;

    this.runtimeEntities.forEach(other => {
      if (other.uuid === player.uuid) return;
      if (other.behavior !== 'COLLECTIBLE' && other.behavior !== 'HAZARD' && other.behavior !== 'TRIGGER') return;

      const ox = other.position[0];
      const oy = other.position[1];
      const ow = other.scale[0] * 0.5;
      const oh = other.scale[1] * 0.5;

      this.aabbMinB[0] = ox - ow;
      this.aabbMinB[1] = oy - oh;
      this.aabbMaxB[0] = ox + ow;
      this.aabbMaxB[1] = oy + oh;

      const overlapX = this.aabbMaxA[0] > this.aabbMinB[0] && this.aabbMinA[0] < this.aabbMaxB[0];
      const overlapY = this.aabbMaxA[1] > this.aabbMinB[1] && this.aabbMinA[1] < this.aabbMaxB[1];

      if (overlapX && overlapY) {
        // Trigger specific events depending on classification
        if (other.behavior === 'COLLECTIBLE') {
          // Fire collection action and remove from workspace
          EventBus.emit('PLAYER_COLLECTED', { uuid: other.uuid, name: other.name });
          this.runtimeEntities.delete(other.uuid);
        } else if (other.behavior === 'HAZARD') {
          EventBus.emit('PLAYER_HIT_HAZARD', { uuid: other.uuid, name: other.name });
        } else if (other.behavior === 'TRIGGER') {
          EventBus.emit('TRIGGER_ACTIVATED', { uuid: other.uuid, name: other.name });
        }
      }
    });
  }
}

const simulationCoreInstance = new SimulationCore();
export default simulationCoreInstance;
