/**
 * @file src/utils/KeyboardManager.ts
 * @description Centralized keyboard shortcut management system.
 * Provides a registry for global and context-aware hotkeys.
 */

export type HotkeyContext = 'GLOBAL' | 'EDITOR' | 'SIMULATION' | 'TREE_EDITOR' | 'ASSET_MANAGER';

export interface Hotkey {
  id: string;
  keys: string[]; // e.g., ['ctrl', 'shift', 't']
  label: string;
  description: string;
  context: HotkeyContext;
  handler: () => void;
  preventDefault?: boolean;
}

class KeyboardManager {
  private hotkeys: Map<string, Hotkey> = new Map();
  private isListening: boolean = false;
  private currentContext: HotkeyContext = 'GLOBAL';

  constructor() {
    this.setupDefaultHotkeys();
  }

  private setupDefaultHotkeys(): void {
    // Editor Tool Hotkeys
    this.register({
      id: 'tool_select',
      keys: ['q'],
      label: 'Q',
      description: 'Select Tool',
      context: 'EDITOR',
      handler: () => console.log('Select tool'),
      preventDefault: true
    });

    this.register({
      id: 'tool_translate',
      keys: ['w'],
      label: 'W',
      description: 'Translate Tool',
      context: 'EDITOR',
      handler: () => console.log('Translate tool'),
      preventDefault: true
    });

    this.register({
      id: 'tool_rotate',
      keys: ['e'],
      label: 'E',
      description: 'Rotate Tool',
      context: 'EDITOR',
      handler: () => console.log('Rotate tool'),
      preventDefault: true
    });

    this.register({
      id: 'tool_scale',
      keys: ['r'],
      label: 'R',
      description: 'Scale Tool',
      context: 'EDITOR',
      handler: () => console.log('Scale tool'),
      preventDefault: true
    });

    // Global Shortcuts
    this.register({
      id: 'panel_behavior_trees',
      keys: ['ctrl', 'shift', 't'],
      label: 'Ctrl+Shift+T',
      description: 'Toggle Behavior Tree Panel',
      context: 'GLOBAL',
      handler: () => console.log('Toggle behavior tree panel'),
      preventDefault: true
    });

    this.register({
      id: 'panel_asset_library',
      keys: ['ctrl', 'shift', 'a'],
      label: 'Ctrl+Shift+A',
      description: 'Toggle Asset Library Panel',
      context: 'GLOBAL',
      handler: () => console.log('Toggle asset library'),
      preventDefault: true
    });

    this.register({
      id: 'editor_deselect',
      keys: ['escape'],
      label: 'Esc',
      description: 'Deselect Entity',
      context: 'EDITOR',
      handler: () => console.log('Deselect'),
      preventDefault: true
    });

    this.register({
      id: 'editor_undo',
      keys: ['ctrl', 'z'],
      label: 'Ctrl+Z',
      description: 'Undo',
      context: 'EDITOR',
      handler: () => console.log('Undo'),
      preventDefault: true
    });

    this.register({
      id: 'editor_redo',
      keys: ['ctrl', 'y'],
      label: 'Ctrl+Y',
      description: 'Redo',
      context: 'EDITOR',
      handler: () => console.log('Redo'),
      preventDefault: true
    });

    this.register({
      id: 'editor_save',
      keys: ['ctrl', 's'],
      label: 'Ctrl+S',
      description: 'Save Project',
      context: 'EDITOR',
      handler: () => console.log('Save'),
      preventDefault: true
    });

    this.register({
      id: 'sim_play_pause',
      keys: [' '],
      label: 'Space',
      description: 'Play/Pause Simulation',
      context: 'EDITOR',
      handler: () => console.log('Play/Pause'),
      preventDefault: true
    });

    this.register({
      id: 'sim_stop',
      keys: ['escape'],
      label: 'Esc',
      description: 'Stop Simulation',
      context: 'SIMULATION',
      handler: () => console.log('Stop simulation'),
      preventDefault: true
    });
  }

  /**
   * Register a new hotkey
   */
  public register(hotkey: Hotkey): void {
    this.hotkeys.set(hotkey.id, hotkey);
  }

  /**
   * Unregister a hotkey by ID
   */
  public unregister(hotKeyId: string): void {
    this.hotkeys.delete(hotKeyId);
  }

  /**
   * Get a hotkey by ID
   */
  public getHotkey(id: string): Hotkey | null {
    return this.hotkeys.get(id) || null;
  }

  /**
   * Get all hotkeys for a specific context
   */
  public getHotkeysByContext(context: HotkeyContext): Hotkey[] {
    return Array.from(this.hotkeys.values()).filter(h => h.context === context || h.context === 'GLOBAL');
  }

  /**
   * Get all registered hotkeys
   */
  public getAllHotkeys(): Hotkey[] {
    return Array.from(this.hotkeys.values());
  }

  /**
   * Set the current keyboard context
   */
  public setContext(context: HotkeyContext): void {
    this.currentContext = context;
  }

  /**
   * Get the current keyboard context
   */
  public getContext(): HotkeyContext {
    return this.currentContext;
  }

  /**
   * Start listening for keyboard events
   */
  public startListening(): void {
    if (this.isListening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      this.handleKeyboardEvent(e);
    };

    window.addEventListener('keydown', handleKeyDown);
    this.isListening = true;
  }

  /**
   * Stop listening for keyboard events
   */
  public stopListening(): void {
    window.removeEventListener('keydown', this.handleKeyboardEvent);
    this.isListening = false;
  }

  private handleKeyboardEvent = (e: KeyboardEvent) => {
    // Build key combination from event
    const keys: string[] = [];
    if (e.ctrlKey) keys.push('ctrl');
    if (e.shiftKey) keys.push('shift');
    if (e.altKey) keys.push('alt');
    keys.push(e.key.toLowerCase());

    // Find matching hotkey
    const matchingHotkey = this.findMatchingHotkey(keys);
    if (matchingHotkey && this.isHotkeyActive(matchingHotkey)) {
      if (matchingHotkey.preventDefault) {
        e.preventDefault();
      }
      matchingHotkey.handler();
    }
  };

  private findMatchingHotkey(keys: string[]): Hotkey | null {
    for (const hotkey of this.hotkeys.values()) {
      if (this.keysMatch(hotkey.keys, keys)) {
        return hotkey;
      }
    }
    return null;
  }

  private keysMatch(hotkeyKeys: string[], eventKeys: string[]): boolean {
    if (hotkeyKeys.length !== eventKeys.length) return false;
    const sortedHotkey = [...hotkeyKeys].sort();
    const sortedEvent = [...eventKeys].sort();
    return sortedHotkey.every((key, i) => key === sortedEvent[i]);
  }

  private isHotkeyActive(hotkey: Hotkey): boolean {
    // Check if hotkey is active in current context
    return hotkey.context === 'GLOBAL' || hotkey.context === this.currentContext;
  }

  /**
   * Check if input element has focus (to avoid interfering with text input)
   */
  public isInputFocused(): boolean {
    if (document.activeElement instanceof HTMLInputElement) return true;
    if (document.activeElement instanceof HTMLTextAreaElement) return true;
    if (document.activeElement instanceof HTMLSelectElement) return true;
    return false;
  }

  /**
   * Get formatted hotkey string for display
   */
  public formatHotkey(keys: string[]): string {
    return keys
      .map(key => {
        const keyMap: Record<string, string> = {
          'ctrl': 'Ctrl',
          'shift': 'Shift',
          'alt': 'Alt',
          'arrowup': '↑',
          'arrowdown': '↓',
          'arrowleft': '←',
          'arrowright': '→',
          ' ': 'Space',
          'enter': '↵',
          'backspace': '⌫',
          'delete': 'Del'
        };
        return keyMap[key] || key.toUpperCase();
      })
      .join('+');
  }
}

// Export singleton instance
export const keyboardManager = new KeyboardManager();

// Export helper for getting help overlay data
export function getKeyboardHelp(): { [context: string]: Hotkey[] } {
  const help: { [context: string]: Hotkey[] } = {};
  const contexts: HotkeyContext[] = ['EDITOR', 'SIMULATION', 'GLOBAL'];

  contexts.forEach(context => {
    const hotkeys = keyboardManager.getHotkeysByContext(context);
    if (hotkeys.length > 0) {
      help[context] = hotkeys;
    }
  });

  return help;
}
