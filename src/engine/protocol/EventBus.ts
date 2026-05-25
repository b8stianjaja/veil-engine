/**
 * @file src/engine/protocol/EventBus.ts
 * @description Centralized, ultra-high-performance decoupled event bus for Veil Engine subsystems.
 * Optimized to prevent memory retention and minimize runtime allocation overhead.
 * Strictly adheres to Pillar 1 architectural rules: 0% React, 100% state-agnostic.
 */

type ElementType<T> = T extends Set<infer U> ? U : never;
type EventCallback = (payload?: any) => void;

class EventBus {
  /**
   * @private
   */
  private listeners: Map<string, Set<EventCallback>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribes a handler callback to a specific channel event.
   * Ensures duplicate listener mappings are rejected.
   * @param eventName Name of the channel event
   * @param callback Executor callback function
   */
  public on(eventName: string, callback: EventCallback): void {
    if (typeof callback !== 'function') {
      console.error(`[EventBus] Registration failed: Callback for event "${eventName}" is not a function.`);
      return;
    }
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(callback);
  }

  /**
   * Unsubscribes a handler callback from an event.
   * Automatically purges empty event structures to prevent memory leaks.
   * @param eventName Name of the channel event
   * @param callback Reference callback to disconnect
   */
  public off(eventName: string, callback: EventCallback): void {
    const eventSet = this.listeners.get(eventName);
    if (eventSet) {
      eventSet.delete(callback);
      if (eventSet.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  /**
   * Dispatches data payloads to all active subscribers.
   * Optimized with zero internal allocation steps.
   * @param eventName Name of the event to fire
   * @param payload Contextual parameters payload block
   */
  public emit(eventName: string, payload?: any): void {
    const eventSet = this.listeners.get(eventName);
    if (!eventSet) return;

    // Use a pre-created wrapper or straight invocation to avoid GC allocation
    eventSet.forEach(callback => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`[EventBus] Error in listener for event "${eventName}":`, error);
      }
    });
  }

  /**
   * Resets the entire message routing table. Used during engine state reloads.
   */
  public clear(): void {
    this.listeners.clear();
  }
}

const eventBusInstance = new EventBus();
export default eventBusInstance;
