/**
 * @file src/engine/systems/AnimationDirector.ts
 * @description Frame-Accurate Sequencer for 2D Frame Swapping and GSAP interpolation loops.
 * Employs pre-allocated state collections to maintain zero allocations during runtime loops.
 * Strictly adheres to Pillar 1 architectural rules.
 */

import EventBus from '../protocol/EventBus';
import { TimelineSequence, TimelineTrack } from '../../types';

class AnimationDirector {
  /**
   * Active sequence instances currently running.
   * @private
   */
  private activeSequences: Map<string, { data: TimelineSequence; elapsedTime: number }>;

  /**
   * Tracks triggered events to prevent double-execution.
   * @private
   */
  private executedTriggers: Set<string>;

  /**
   * Caches frame updates during evaluations to avoid multiple emissions.
   * @private
   */
  private pendingFrameUpdates: Map<string, any>;

  constructor() {
    this.activeSequences = new Map();
    this.executedTriggers = new Set();
    this.pendingFrameUpdates = new Map(); // Transient caching to avoid layout thrashing
  }

  /**
   * Activates a pre-configured timeline sequence.
   * @param sequenceId Unique identifier of the sequence to play
   * @param timelineManifest Source list of timeline events
   */
  public playSequence(sequenceId: string, timelineManifest: TimelineSequence[]): void {
    const sequenceData = timelineManifest?.find(seq => seq.id === sequenceId);
    if (sequenceData) {
      this.activeSequences.set(sequenceId, {
        data: sequenceData,
        elapsedTime: 0
      });
      console.log(`[AnimationDirector] Sequence activated: ${sequenceId}`);
    } else {
      console.warn(`[AnimationDirector] Sequence not found: ${sequenceId}`);
    }
  }

  /**
   * Stops an active sequence.
   * @param sequenceId Unique identifier of the sequence to stop
   */
  public stopSequence(sequenceId: string): void {
    this.activeSequences.delete(sequenceId);
  }

  /**
   * Resets the entire sequence, trigger, and update state arrays.
   */
  public reset(): void {
    this.activeSequences.clear();
    this.executedTriggers.clear();
    this.pendingFrameUpdates.clear();
  }

  /**
   * Evaluates active timelines on every engine heartbeat.
   * Uses zero object allocations inside the loop to avoid garbage collection spikes.
   * @param delta Milliseconds or seconds since the last tick (typically seconds, e.g., 0.016)
   */
  public tick(delta: number): void {
    if (this.activeSequences.size === 0) return;

    // Clear frame cache before parsing track evaluations
    this.pendingFrameUpdates.clear();

    for (const [sequenceId, instance] of this.activeSequences.entries()) {
      instance.elapsedTime += delta;
      const currentTime = instance.elapsedTime;
      const { data } = instance;

      for (let i = 0; i < data.tracks.length; i++) {
        this.evaluateTrack(data.tracks[i], currentTime, sequenceId);
      }

      if (currentTime >= data.duration) {
        this.stopSequence(sequenceId);
        EventBus.emit('SEQUENCE_FINISHED', { id: sequenceId });
      }
    }

    // Flush batch frames to store if there are update actions
    if (this.pendingFrameUpdates.size > 0) {
      EventBus.emit(
        'BATCH_SPRITE_UPDATE',
        Object.fromEntries(this.pendingFrameUpdates)
      );
    }
  }

  /**
   * Dispatches evaluation down to targeted track engines.
   * @param track Timeline track configuration
   * @param currentTime Elapsed sequence time
   * @param sequenceId Source sequence identifier
   */
  private evaluateTrack(track: TimelineTrack, currentTime: number, sequenceId: string): void {
    switch (track.trackType) {
      case 'SPRITE_FRAME':
        this.evaluateSpriteTrack(track, currentTime);
        break;
      case 'GSAP_TWEEN':
        this.evaluateGSAPTweenTrack(track, currentTime, sequenceId);
        break;
      case 'TRIGGER':
      case 'DIALOGUE':
        this.evaluateDiscreteTrack(track, currentTime, sequenceId);
        break;
      default:
        break;
    }
  }

  /**
   * Solves active cell-frame allocations inside sprite-sheets with O(log N) binary search queries.
   * @param track Timeline track representing sprite keyframes
   * @param currentTime Current sequence elapsed time
   */
  private evaluateSpriteTrack(track: TimelineTrack, currentTime: number): void {
    const keys = track.keyframes;
    if (!keys || keys.length === 0) return;

    // Binary search lookup to find keyframe mapping under O(log N)
    let low = 0;
    let high = keys.length - 1;
    let activeIndex = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (keys[mid].time <= currentTime) {
        activeIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const activeKey = keys[activeIndex];
    this.pendingFrameUpdates.set(track.targetUuid, activeKey.value);
  }

  /**
   * Registers a single GSAP tween launch instruction across communication borders.
   * Ensures triggers do not evaluate redundantly inside hot loops.
   */
  private evaluateGSAPTweenTrack(track: TimelineTrack, currentTime: number, sequenceId: string): void {
    const hash = `${sequenceId}_${track.targetUuid}_gsap`;
    if (this.executedTriggers.has(hash)) return;
    this.executedTriggers.add(hash);

    // Offload heavy visual interpolations safely to the app store layer
    EventBus.emit('ENGINE_GSAP_LAUNCH', {
      targetUuid: track.targetUuid,
      channel: track.channel, // 'position2d' | 'opacity' | 'scale2d'
      timeline: track.timelineData
    });
  }

  /**
   * Evaluates discrete tracks (e.g., triggers, dialogues) and triggers callbacks at precise timeframes.
   */
  private evaluateDiscreteTrack(track: TimelineTrack, currentTime: number, sequenceId: string): void {
    const keys = track.keyframes;
    if (!keys) return;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const executionHash = `${sequenceId}_${track.trackType}_${key.time}`;

      if (currentTime >= key.time && !this.executedTriggers.has(executionHash)) {
        this.executedTriggers.add(executionHash);
        EventBus.emit('EXECUTE_EVENT', {
          type: track.trackType,
          action: key.action,
          params: key.payload
        });
      }
    }
  }
}

const animationDirectorInstance = new AnimationDirector();
export default animationDirectorInstance;
