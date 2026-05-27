/**
 * @file src/engine/systems/BehaviorTreeExecutor.ts
 * @description Behavior Tree execution engine for custom entity logic.
 * Executes behavior trees on a 60Hz tick independent of React.
 * Publishes execution events via EventBus for UI updates.
 * 
 * Adheres to Pillar 1: Zero React dependencies.
 */

import { 
  BehaviorTree, 
  BehaviorNode, 
  TreeNodeType,
  BehaviorTreeExecutionState,
  ConditionalNodeConfig,
  SequenceNodeConfig
} from '../../types';
import { IEngineSystem } from '../SimulationCore';
import EventBus from '../protocol/EventBus';

interface SimulationEntityState {
  uuid: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  behavior: string;
  isSensor: boolean;
  name: string;
}

export default class BehaviorTreeExecutor implements IEngineSystem {
  private executionStates: Map<string, BehaviorTreeExecutionState> = new Map();
  private treeDefinitions: Map<string, BehaviorTree> = new Map();
  private entityTreeBindings: Map<string, string> = new Map(); // entityUuid → treeId

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for tree definition updates from store
    EventBus.on('BEHAVIOR_TREE_UPDATED', (tree: BehaviorTree) => {
      this.treeDefinitions.set(tree.id, tree);
    });

    EventBus.on('BEHAVIOR_TREE_DELETED', (treeId: string) => {
      this.treeDefinitions.delete(treeId);
      // Stop all executions using this tree
      Array.from(this.executionStates.entries()).forEach(([key, state]) => {
        if (state.treeId === treeId) {
          this.executionStates.delete(key);
          EventBus.emit('TREE_EXECUTION_STOPPED', { entityUuid: state.entityUuid, treeId });
        }
      });
    });

    // Entity → Tree binding events
    EventBus.on('ENTITY_TREE_LINKED', ({ entityUuid, treeId }: { entityUuid: string; treeId: string }) => {
      this.entityTreeBindings.set(entityUuid, treeId);
      // Start execution if tree exists
      const tree = this.treeDefinitions.get(treeId);
      if (tree) {
        this.startExecution(entityUuid, tree);
      }
    });

    EventBus.on('ENTITY_TREE_UNLINKED', ({ entityUuid }: { entityUuid: string }) => {
      this.entityTreeBindings.delete(entityUuid);
      // Stop execution
      const executionKey = `${entityUuid}`;
      this.executionStates.delete(executionKey);
      EventBus.emit('TREE_EXECUTION_STOPPED', { entityUuid });
    });

    // Start tree execution on demand
    EventBus.on('START_TREE_EXECUTION', ({ entityUuid, tree }: { entityUuid: string; tree: BehaviorTree }) => {
      this.startExecution(entityUuid, tree);
    });

    EventBus.on('STOP_TREE_EXECUTION', ({ entityUuid }: { entityUuid: string }) => {
      const key = `${entityUuid}`;
      this.executionStates.delete(key);
      EventBus.emit('TREE_EXECUTION_STOPPED', { entityUuid });
    });
  }

  public registerTreeDefinition(tree: BehaviorTree): void {
    this.treeDefinitions.set(tree.id, tree);
  }

  public setEntityTreeBinding(entityUuid: string, treeId: string | null): void {
    if (treeId === null) {
      this.entityTreeBindings.delete(entityUuid);
    } else {
      this.entityTreeBindings.set(entityUuid, treeId);
    }
  }

  private startExecution(entityUuid: string, tree: BehaviorTree): void {
    const key = `${entityUuid}`;
    
    // Prevent duplicate execution
    if (this.executionStates.has(key)) {
      return;
    }

    const state: BehaviorTreeExecutionState = {
      treeId: tree.id,
      entityUuid,
      currentNodeId: tree.rootNodeId,
      startTime: Date.now(),
      activeTimers: {}
    };

    this.executionStates.set(key, state);
    EventBus.emit('TREE_EXECUTION_STARTED', { entityUuid, treeId: tree.id });
  }

  /**
   * Main update method called on 60Hz tick from SimulationCore
   */
  public update(
    delta: number,
    entities: Map<string, SimulationEntityState>,
    keys: Record<string, boolean>
  ): void {
    // Execute all active behavior trees
    Array.from(this.executionStates.entries()).forEach(([key, state]) => {
      const entity = entities.get(state.entityUuid);
      if (!entity) {
        // Entity no longer exists, stop execution
        this.executionStates.delete(key);
        return;
      }

      const tree = this.treeDefinitions.get(state.treeId);
      if (!tree) {
        this.executionStates.delete(key);
        return;
      }

      // Execute tree
      try {
        this.executeNode(tree, state.currentNodeId, state, entity, delta);
      } catch (error) {
        console.error(`Error executing behavior tree for entity ${state.entityUuid}:`, error);
        this.executionStates.delete(key);
        EventBus.emit('TREE_EXECUTION_ERROR', { entityUuid: state.entityUuid, error });
      }
    });
  }

  private executeNode(
    tree: BehaviorTree,
    nodeId: string,
    state: BehaviorTreeExecutionState,
    entity: SimulationEntityState,
    delta: number
  ): void {
    const node = tree.nodes[nodeId];
    if (!node) {
      console.warn(`Node ${nodeId} not found in tree ${tree.id}`);
      return;
    }

    const config = node.config as any;

    switch (node.type) {
      case 'CONDITIONAL': {
        const condConfig = config as ConditionalNodeConfig;
        const conditionMet = this.evaluateCondition(entity, condConfig);
        
        const nextNodeId = conditionMet ? condConfig.childId : condConfig.elseChildId;
        if (nextNodeId) {
          state.currentNodeId = nextNodeId;
          EventBus.emit('TREE_NODE_EXECUTED', {
            entityUuid: state.entityUuid,
            nodeId,
            nodeName: node.name,
            result: conditionMet ? 'TRUE' : 'FALSE'
          });
        }
        break;
      }

      case 'SEQUENCE': {
        const seqConfig = config as SequenceNodeConfig;
        // Move to next child in sequence
        const currentIndex = seqConfig.childIds.indexOf(state.currentNodeId);
        const nextIndex = currentIndex + 1;

        if (nextIndex < seqConfig.childIds.length) {
          state.currentNodeId = seqConfig.childIds[nextIndex];
          EventBus.emit('TREE_NODE_EXECUTED', {
            entityUuid: state.entityUuid,
            nodeId,
            nodeName: node.name,
            progress: `${nextIndex}/${seqConfig.childIds.length}`
          });
        } else {
          // Sequence complete
          EventBus.emit('TREE_SEQUENCE_COMPLETE', {
            entityUuid: state.entityUuid,
            treeId: tree.id
          });
        }
        break;
      }

      case 'PARALLEL': {
        const parConfig = config as any;
        // In parallel mode, we'd typically execute all children, but for simplicity,
        // we'll treat it as firing all children simultaneously (event-driven)
        parConfig.childIds?.forEach((childId: string) => {
          EventBus.emit('TREE_PARALLEL_CHILD_EXECUTE', {
            entityUuid: state.entityUuid,
            childNodeId: childId
          });
        });
        EventBus.emit('TREE_NODE_EXECUTED', {
          entityUuid: state.entityUuid,
          nodeId,
          nodeName: node.name
        });
        break;
      }

      case 'TRIGGER': {
        const triggerConfig = config as any;
        EventBus.emit('TREE_TRIGGER_FIRED', {
          entityUuid: state.entityUuid,
          eventType: triggerConfig.eventType,
          payload: triggerConfig.payload
        });
        EventBus.emit('TREE_NODE_EXECUTED', {
          entityUuid: state.entityUuid,
          nodeId,
          nodeName: node.name
        });
        break;
      }

      case 'TRANSFORM': {
        const transformConfig = config as any;
        const duration = transformConfig.duration || 0;
        const timerId = `${nodeId}_timer`;

        if (!state.activeTimers[timerId]) {
          state.activeTimers[timerId] = 0;
        }

        state.activeTimers[timerId] += delta;

        if (state.activeTimers[timerId] >= duration) {
          delete state.activeTimers[timerId];
          EventBus.emit('TREE_TRANSFORM_COMPLETE', {
            entityUuid: state.entityUuid,
            targetProperty: transformConfig.targetProperty,
            targetValue: transformConfig.targetValue
          });
          EventBus.emit('TREE_NODE_EXECUTED', {
            entityUuid: state.entityUuid,
            nodeId,
            nodeName: node.name
          });
        }
        break;
      }

      case 'ANIMATE': {
        const animConfig = config as any;
        const duration = animConfig.duration || 0;
        const timerId = `${nodeId}_anim`;

        if (!state.activeTimers[timerId]) {
          state.activeTimers[timerId] = 0;
        }

        state.activeTimers[timerId] += delta;

        if (state.activeTimers[timerId] >= duration) {
          delete state.activeTimers[timerId];
          EventBus.emit('TREE_ANIMATION_COMPLETE', {
            entityUuid: state.entityUuid,
            frameStart: animConfig.frameStart,
            frameEnd: animConfig.frameEnd
          });
          EventBus.emit('TREE_NODE_EXECUTED', {
            entityUuid: state.entityUuid,
            nodeId,
            nodeName: node.name
          });
        }
        break;
      }

      case 'EMIT': {
        const emitConfig = config as any;
        EventBus.emit('TREE_EMIT_PARTICLES', {
          entityUuid: state.entityUuid,
          particleType: emitConfig.particleType,
          count: emitConfig.count,
          direction: emitConfig.direction
        });
        EventBus.emit('TREE_NODE_EXECUTED', {
          entityUuid: state.entityUuid,
          nodeId,
          nodeName: node.name
        });
        break;
      }

      case 'WAIT': {
        const waitConfig = config as any;
        const duration = waitConfig.duration || 0;
        const timerId = `${nodeId}_wait`;

        if (!state.activeTimers[timerId]) {
          state.activeTimers[timerId] = 0;
        }

        state.activeTimers[timerId] += delta;

        if (state.activeTimers[timerId] >= duration) {
          delete state.activeTimers[timerId];
          EventBus.emit('TREE_NODE_EXECUTED', {
            entityUuid: state.entityUuid,
            nodeId,
            nodeName: node.name,
            action: 'WAIT_COMPLETE'
          });
        }
        break;
      }

      default:
        console.warn(`Unknown node type: ${node.type}`);
    }
  }

  private evaluateCondition(entity: SimulationEntityState, config: ConditionalNodeConfig): boolean {
    const { property, operator, value } = config;

    let entityValue: any;
    switch (property) {
      case 'behavior':
        entityValue = entity.behavior;
        break;
      case 'x':
        entityValue = entity.position[0];
        break;
      case 'y':
        entityValue = entity.position[1];
        break;
      case 'z':
        entityValue = entity.position[2];
        break;
      default:
        return false;
    }

    switch (operator) {
      case '==':
        return entityValue === value;
      case '!=':
        return entityValue !== value;
      case '>':
        return entityValue > value;
      case '<':
        return entityValue < value;
      case '>=':
        return entityValue >= value;
      case '<=':
        return entityValue <= value;
      default:
        return false;
    }
  }

  public getExecutionState(entityUuid: string): BehaviorTreeExecutionState | null {
    return this.executionStates.get(entityUuid) || null;
  }

  public getAllExecutionStates(): Map<string, BehaviorTreeExecutionState> {
    return new Map(this.executionStates);
  }
}

// Singleton instance
export const behaviorTreeExecutor = new BehaviorTreeExecutor();
