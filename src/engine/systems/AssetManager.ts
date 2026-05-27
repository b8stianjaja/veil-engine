/**
 * @file src/engine/systems/AssetManager.ts
 * @description Asset loading, caching, and metadata management system.
 * Provides runtime access to assets without React dependencies.
 * 
 * Adheres to Pillar 1: Zero React dependencies.
 */

import { AssetDefinition, SpriteSheetMetadata, AnimationClipDefinition } from '../../types';
import EventBus from '../protocol/EventBus';

export default class AssetManager {
  private assetDefinitions: Map<string, AssetDefinition> = new Map();
  private cachedAssets: Map<string, any> = new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for asset updates from store
    EventBus.on('ASSET_ADDED', (asset: AssetDefinition) => {
      this.registerAsset(asset);
    });

    EventBus.on('ASSET_UPDATED', (asset: AssetDefinition) => {
      this.registerAsset(asset);
      // Invalidate cache for updated asset
      this.cachedAssets.delete(asset.id);
    });

    EventBus.on('ASSET_DELETED', (assetId: string) => {
      this.assetDefinitions.delete(assetId);
      this.cachedAssets.delete(assetId);
    });
  }

  /**
   * Register an asset definition
   */
  public registerAsset(asset: AssetDefinition): void {
    this.assetDefinitions.set(asset.id, asset);
  }

  /**
   * Get asset definition by ID
   */
  public getAsset(assetId: string): AssetDefinition | null {
    return this.assetDefinitions.get(assetId) || null;
  }

  /**
   * Get all assets of a specific type
   */
  public getAssetsByType(type: string): AssetDefinition[] {
    return Array.from(this.assetDefinitions.values()).filter(a => a.type === type);
  }

  /**
   * Get assets by tag
   */
  public getAssetsByTag(tag: string): AssetDefinition[] {
    return Array.from(this.assetDefinitions.values()).filter(a => a.tags.includes(tag));
  }

  /**
   * Load asset data (caches result)
   */
  public async loadAsset(assetId: string): Promise<any> {
    const asset = this.assetDefinitions.get(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    // Check cache first
    if (this.cachedAssets.has(assetId)) {
      return this.cachedAssets.get(assetId);
    }

    // Check if already loading
    if (this.loadingPromises.has(assetId)) {
      return this.loadingPromises.get(assetId);
    }

    // Start loading
    const loadPromise = this.performAssetLoad(asset);
    this.loadingPromises.set(assetId, loadPromise);

    try {
      const data = await loadPromise;
      this.cachedAssets.set(assetId, data);
      return data;
    } finally {
      this.loadingPromises.delete(assetId);
    }
  }

  private async performAssetLoad(asset: AssetDefinition): Promise<any> {
    switch (asset.type) {
      case 'SPRITE_SHEET':
        return this.loadSpriteSheet(asset);
      case 'ANIMATION_CLIP':
        return this.loadAnimationClip(asset);
      case 'TEXTURE':
        return this.loadTexture(asset);
      default:
        return null;
    }
  }

  private async loadSpriteSheet(asset: AssetDefinition): Promise<any> {
    const metadata = asset.metadata as SpriteSheetMetadata;
    return {
      type: 'SPRITE_SHEET',
      imageUrl: metadata.imageUrl,
      gridWidth: metadata.gridWidth,
      gridHeight: metadata.gridHeight,
      frameWidth: metadata.frameWidth,
      frameHeight: metadata.frameHeight,
      animations: metadata.animations || {}
    };
  }

  private async loadAnimationClip(asset: AssetDefinition): Promise<any> {
    return {
      type: 'ANIMATION_CLIP',
      metadata: asset.metadata
    };
  }

  private async loadTexture(asset: AssetDefinition): Promise<any> {
    return {
      type: 'TEXTURE',
      url: asset.path
    };
  }

  /**
   * Get animation clips from a sprite sheet
   */
  public getAnimationClips(spriteSheetAssetId: string): AnimationClipDefinition[] {
    const asset = this.assetDefinitions.get(spriteSheetAssetId);
    if (!asset || asset.type !== 'SPRITE_SHEET') {
      return [];
    }

    const metadata = asset.metadata as SpriteSheetMetadata;
    return Object.values(metadata.animations || {});
  }

  /**
   * Create a new animation clip from sprite sheet frame range
   */
  public createAnimationClip(
    spriteSheetAssetId: string,
    name: string,
    frameStart: number,
    frameEnd: number,
    speed: number = 10,
    loop: boolean = true
  ): AnimationClipDefinition {
    const frames = [];
    for (let i = frameStart; i <= frameEnd; i++) {
      frames.push({
        frameIndex: i,
        x: (i % 4) * 64, // Assuming 4x4 grid; adjust based on metadata
        y: Math.floor(i / 4) * 64,
        width: 64,
        height: 64
      });
    }

    return {
      name,
      frames,
      loop,
      speed
    };
  }

  /**
   * Validate asset integrity (check for missing dependencies, corruption, etc.)
   */
  public validateAsset(asset: AssetDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!asset.id) errors.push('Missing asset ID');
    if (!asset.name) errors.push('Missing asset name');
    if (!asset.path) errors.push('Missing asset path');

    if (asset.type === 'SPRITE_SHEET') {
      const metadata = asset.metadata as SpriteSheetMetadata;
      if (!metadata.imageUrl) errors.push('Missing sprite sheet image URL');
      if (metadata.gridWidth <= 0) errors.push('Invalid grid width');
      if (metadata.gridHeight <= 0) errors.push('Invalid grid height');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.cachedAssets.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get all registered assets
   */
  public getAllAssets(): AssetDefinition[] {
    return Array.from(this.assetDefinitions.values());
  }

  /**
   * Get asset count by type
   */
  public getAssetStatistics(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.assetDefinitions.forEach(asset => {
      stats[asset.type] = (stats[asset.type] || 0) + 1;
    });
    return stats;
  }
}

// Singleton instance
export const assetManager = new AssetManager();
