/**
 * @file src/components/AssetLibraryPanel.tsx
 * @description Asset management interface for importing and managing sprite sheets,
 * animation clips, and other game assets.
 */

import React, { useState } from 'react';
import { Plus, Trash2, Upload, X } from 'lucide-react';
import { useSpatialEditorStore } from '../app/store';
import { AssetDefinition, SpriteSheetMetadata } from '../types';
import { v4 as uuidv4 } from '../utils/uuid';

interface AssetLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AssetLibraryPanel({ isOpen, onClose }: AssetLibraryPanelProps) {
  const {
    assets,
    selectedAssetId,
    setSelectedAssetId,
    addAsset,
    deleteAsset,
    updateAsset
  } = useSpatialEditorStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const selectedAsset = selectedAssetId ? assets[selectedAssetId] : null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFilesSelected(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesSelected(Array.from(e.target.files));
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    setIsImporting(true);
    setImportError(null);

    try {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          // Handle image file (sprite sheet)
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              const imageUrl = e.target.result as string;
              const asset: AssetDefinition = {
                id: uuidv4(),
                name: file.name.replace(/\.[^/.]+$/, ''),
                type: 'SPRITE_SHEET',
                path: `assets/${file.name}`,
                metadata: {
                  imageUrl,
                  gridWidth: 4,
                  gridHeight: 4,
                  frameWidth: 64,
                  frameHeight: 64,
                  animations: {}
                } as SpriteSheetMetadata,
                tags: ['imported'],
                importedAt: Date.now(),
                size: file.size,
                checksum: `${file.name}_${file.size}_${file.lastModified}`
              };

              addAsset(asset);
              setSelectedAssetId(asset.id);
            }
          };
          reader.readAsDataURL(file);
        } else if (file.type === 'application/json') {
          // Handle JSON metadata
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              try {
                const metadata = JSON.parse(e.target.result as string);
                // Could extend asset with metadata here
              } catch (err) {
                setImportError(`Failed to parse JSON: ${(err as Error).message}`);
              }
            }
          };
          reader.readAsText(file);
        }
      }
    } catch (error) {
      setImportError(`Import error: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    if (confirm(`Delete asset "${assets[assetId]?.name}"?`)) {
      deleteAsset(assetId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-16 bottom-0 w-96 bg-gray-900 border-r border-gray-700 overflow-y-auto z-50">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">Asset Library</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Import Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`m-4 p-6 rounded border-2 border-dashed transition cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 bg-gray-800/50 hover:bg-gray-800'
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <Upload size={32} className="text-gray-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300">Drag & drop assets here</p>
            <p className="text-xs text-gray-500">or</p>
            <label className="text-blue-400 hover:text-blue-300 text-sm cursor-pointer font-medium">
              browse files
              <input
                type="file"
                multiple
                accept="image/*,.json"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {isImporting && <p className="text-center text-gray-400 text-xs mt-2">Importing...</p>}
        {importError && <p className="text-center text-red-400 text-xs mt-2">{importError}</p>}
      </div>

      {/* Asset List */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Assets ({Object.keys(assets).length})
        </h3>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {Object.values(assets).length === 0 ? (
            <p className="text-gray-400 text-sm">No assets imported yet</p>
          ) : (
            Object.values(assets).map((asset) => (
              <div
                key={asset.id}
                onClick={() => setSelectedAssetId(asset.id)}
                className={`p-3 rounded cursor-pointer transition ${
                  selectedAssetId === asset.id
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{asset.name}</div>
                    <div className="text-xs text-gray-400">{asset.type}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAsset(asset.id);
                    }}
                    className="text-red-400 hover:text-red-300 ml-2 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Asset Details */}
      {selectedAsset && (
        <div className="p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Asset Details</h3>

          <div className="space-y-3">
            {/* Preview */}
            {selectedAsset.type === 'SPRITE_SHEET' && (
              <div className="bg-gray-800 rounded p-3">
                <p className="text-xs text-gray-400 mb-2">Preview</p>
                <img
                  src={(selectedAsset.metadata as SpriteSheetMetadata).imageUrl}
                  alt={selectedAsset.name}
                  className="w-full h-24 object-contain rounded bg-black"
                />
              </div>
            )}

            {/* Metadata */}
            <div className="bg-gray-800 rounded p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Type:</span>
                <span className="text-gray-200">{selectedAsset.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Path:</span>
                <span className="text-gray-200 truncate">{selectedAsset.path}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Size:</span>
                <span className="text-gray-200">{(selectedAsset.size / 1024).toFixed(2)} KB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Imported:</span>
                <span className="text-gray-200">
                  {new Date(selectedAsset.importedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Sprite Sheet Metadata Editor */}
            {selectedAsset.type === 'SPRITE_SHEET' && (
              <SpriteSheetMetadataEditor
                asset={selectedAsset}
                onUpdate={updateAsset}
              />
            )}

            {/* Tags */}
            <div className="bg-gray-800 rounded p-3">
              <p className="text-xs text-gray-400 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {selectedAsset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SpriteSheetMetadataEditor: Editor for sprite sheet grid and animation data
 */
function SpriteSheetMetadataEditor({
  asset,
  onUpdate
}: {
  asset: AssetDefinition;
  onUpdate: (id: string, updates: Partial<AssetDefinition>) => void;
}) {
  const metadata = asset.metadata as SpriteSheetMetadata;
  const [gridWidth, setGridWidth] = useState(metadata.gridWidth);
  const [gridHeight, setGridHeight] = useState(metadata.gridHeight);
  const [frameWidth, setFrameWidth] = useState(metadata.frameWidth);
  const [frameHeight, setFrameHeight] = useState(metadata.frameHeight);

  const handleSave = () => {
    onUpdate(asset.id, {
      metadata: {
        ...metadata,
        gridWidth,
        gridHeight,
        frameWidth,
        frameHeight
      }
    });
  };

  return (
    <div className="bg-gray-800 rounded p-3 space-y-2">
      <p className="text-xs text-gray-400 font-semibold">Sprite Sheet Settings</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400">Grid Width</label>
          <input
            type="number"
            value={gridWidth}
            onChange={(e) => setGridWidth(parseInt(e.target.value) || 1)}
            className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Grid Height</label>
          <input
            type="number"
            value={gridHeight}
            onChange={(e) => setGridHeight(parseInt(e.target.value) || 1)}
            className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Frame Width</label>
          <input
            type="number"
            value={frameWidth}
            onChange={(e) => setFrameWidth(parseInt(e.target.value) || 64)}
            className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Frame Height</label>
          <input
            type="number"
            value={frameHeight}
            onChange={(e) => setFrameHeight(parseInt(e.target.value) || 64)}
            className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
      >
        Save Settings
      </button>
    </div>
  );
}
