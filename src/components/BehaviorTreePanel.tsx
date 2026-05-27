/**
 * @file src/components/BehaviorTreePanel.tsx
 * @description Visual editor for creating and managing behavior trees.
 * Provides tree list, node graph visualization, and editing UI.
 * 
 * Note: This version uses a simplified tree structure display.
 * For full visual node graph, consider integrating React Flow in a future phase.
 */

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Play, X } from 'lucide-react';
import { useSpatialEditorStore } from '../app/store';
import { BehaviorTree, BehaviorNode } from '../types';
import EventBus from '../engine/protocol/EventBus';
import { v4 as uuidv4 } from '../utils/uuid';

interface BehaviorTreePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BehaviorTreePanel({ isOpen, onClose }: BehaviorTreePanelProps) {
  const {
    behaviorTrees,
    selectedTreeId,
    setSelectedTreeId,
    addBehaviorTree,
    updateBehaviorTree,
    deleteBehaviorTree,
    selectedUuid: selectedEntityUuid,
    entityBehaviorTreeBindings,
    linkTreeToEntity,
    unlinkTreeFromEntity
  } = useSpatialEditorStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const selectedTree = selectedTreeId ? behaviorTrees[selectedTreeId] : null;

  const handleCreateTree = () => {
    if (!newTreeName.trim()) return;

    const rootNode: BehaviorNode = {
      id: 'root',
      type: 'SEQUENCE',
      name: 'Root',
      config: { childIds: [] }
    };

    const newTree: BehaviorTree = {
      id: uuidv4(),
      name: newTreeName,
      rootNodeId: 'root',
      nodes: { root: rootNode },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    addBehaviorTree(newTree);
    setNewTreeName('');
    setIsCreating(false);
    setSelectedTreeId(newTree.id);
  };

  const handleDeleteTree = (treeId: string) => {
    if (confirm(`Delete tree "${behaviorTrees[treeId]?.name}"?`)) {
      deleteBehaviorTree(treeId);
    }
  };

  const handleLinkToEntity = () => {
    if (selectedEntityUuid && selectedTreeId) {
      linkTreeToEntity(selectedEntityUuid, selectedTreeId);
    }
  };

  const handleUnlinkFromEntity = () => {
    if (selectedEntityUuid) {
      unlinkTreeFromEntity(selectedEntityUuid);
    }
  };

  const handlePlayTree = () => {
    if (selectedTreeId && selectedEntityUuid) {
      const tree = behaviorTrees[selectedTreeId];
      EventBus.emit('START_TREE_EXECUTION', { entityUuid: selectedEntityUuid, tree });
    }
  };

  const handleAddNode = () => {
    if (!selectedTree) return;

    const newNodeId = `node_${Date.now()}`;
    const newNode: BehaviorNode = {
      id: newNodeId,
      type: 'CONDITIONAL',
      name: 'New Condition',
      config: {
        property: 'behavior',
        operator: '==',
        value: 'STATIC'
      }
    };

    updateBehaviorTree(selectedTree.id, {
      nodes: { ...selectedTree.nodes, [newNodeId]: newNode }
    });

    setEditingNodeId(newNodeId);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!selectedTree || nodeId === selectedTree.rootNodeId) return;

    const updatedNodes = { ...selectedTree.nodes };
    delete updatedNodes[nodeId];

    updateBehaviorTree(selectedTree.id, { nodes: updatedNodes });
  };

  if (!isOpen) return null;

  const linkedTreeId = selectedEntityUuid ? entityBehaviorTreeBindings[selectedEntityUuid] : null;
  const isLinked = linkedTreeId === selectedTreeId;

  return (
    <div className="fixed right-0 top-16 bottom-0 w-96 bg-gray-900 border-l border-gray-700 overflow-y-auto z-50">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-bold text-white">Behavior Trees</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      {/* Tree List */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex gap-2 mb-4">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded flex items-center gap-2 justify-center"
            >
              <Plus size={16} />
              New Tree
            </button>
          ) : (
            <div className="flex gap-2 w-full">
              <input
                type="text"
                placeholder="Tree name..."
                value={newTreeName}
                onChange={(e) => setNewTreeName(e.target.value)}
                className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTree()}
              />
              <button
                onClick={handleCreateTree}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded"
              >
                Create
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewTreeName(''); }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-32 overflow-y-auto">
          {Object.values(behaviorTrees).length === 0 ? (
            <p className="text-gray-400 text-sm">No behavior trees. Create one to start.</p>
          ) : (
            Object.values(behaviorTrees).map((tree) => (
              <div
                key={tree.id}
                onClick={() => setSelectedTreeId(tree.id)}
                className={`p-3 rounded cursor-pointer transition ${
                  selectedTreeId === tree.id
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{tree.name}</div>
                    <div className="text-xs text-gray-400">{Object.keys(tree.nodes).length} nodes</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTree(tree.id);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tree Editor */}
      {selectedTree && (
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-semibold text-white mb-3">Tree: {selectedTree.name}</h3>

          {/* Link to Entity Section */}
          <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div className="text-sm text-gray-300 mb-2">Link to Entity:</div>
            {selectedEntityUuid ? (
              <div className="flex gap-2">
                {isLinked ? (
                  <>
                    <div className="flex-1 text-sm text-green-400">✓ Linked to selected entity</div>
                    <button
                      onClick={handleUnlinkFromEntity}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Unlink
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleLinkToEntity}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded text-sm"
                  >
                    Link to this entity
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500">Select an entity first</div>
            )}
          </div>

          {/* Test Execution */}
          {selectedEntityUuid && isLinked && (
            <button
              onClick={handlePlayTree}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded flex items-center gap-2 justify-center mb-4"
            >
              <Play size={16} />
              Play Tree
            </button>
          )}

          {/* Nodes List */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-semibold text-gray-300">Nodes</h4>
              <button
                onClick={handleAddNode}
                className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
              >
                <Plus size={12} />
                Add
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.values(selectedTree.nodes).map((node) => (
                <div
                  key={node.id}
                  className="p-2 bg-gray-800 rounded border border-gray-700 text-sm"
                >
                  <div className="flex justify-between items-start">
                    <div
                      className="flex-1 cursor-pointer hover:text-blue-400"
                      onClick={() => setEditingNodeId(editingNodeId === node.id ? null : node.id)}
                    >
                      <div className="font-medium text-gray-200">{node.name}</div>
                      <div className="text-xs text-gray-500">{node.type}</div>
                    </div>
                    {node.id !== selectedTree.rootNodeId && (
                      <button
                        onClick={() => handleDeleteNode(node.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Node Details (collapsible) */}
                  {editingNodeId === node.id && (
                    <BehaviorNodeDetails node={node} tree={selectedTree} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedTree && (
        <div className="p-4 text-center text-gray-400">
          <p>Select or create a tree to edit</p>
        </div>
      )}
    </div>
  );
}

/**
 * BehaviorNodeDetails: Inline editor for node configuration
 */
function BehaviorNodeDetails({ node, tree }: { node: BehaviorNode; tree: BehaviorTree }) {
  const { updateBehaviorTree } = useSpatialEditorStore();
  const [config, setConfig] = useState(node.config);

  const handleConfigChange = (key: string, value: any) => {
    const updatedConfig = { ...config, [key]: value };
    setConfig(updatedConfig);

    const updatedNode = { ...node, config: updatedConfig };
    updateBehaviorTree(tree.id, {
      nodes: { ...tree.nodes, [node.id]: updatedNode }
    });
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-700 space-y-2 text-xs">
      {node.type === 'CONDITIONAL' && (
        <>
          <div>
            <label className="text-gray-400">Property</label>
            <select
              value={(config as any).property || 'behavior'}
              onChange={(e) => handleConfigChange('property', e.target.value)}
              className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
            >
              <option>behavior</option>
              <option>x</option>
              <option>y</option>
              <option>z</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400">Operator</label>
            <select
              value={(config as any).operator || '=='}
              onChange={(e) => handleConfigChange('operator', e.target.value)}
              className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
            >
              <option>==</option>
              <option>!=</option>
              <option>&gt;</option>
              <option>&lt;</option>
              <option>&gt;=</option>
              <option>&lt;=</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400">Value</label>
            <input
              type="text"
              value={(config as any).value || ''}
              onChange={(e) => handleConfigChange('value', e.target.value)}
              className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
            />
          </div>
        </>
      )}

      {node.type === 'WAIT' && (
        <div>
          <label className="text-gray-400">Duration (seconds)</label>
          <input
            type="number"
            step="0.1"
            value={(config as any).duration || 0}
            onChange={(e) => handleConfigChange('duration', parseFloat(e.target.value))}
            className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
          />
        </div>
      )}

      {node.type === 'TRANSFORM' && (
        <>
          <div>
            <label className="text-gray-400">Target Property</label>
            <select
              value={(config as any).targetProperty || 'position'}
              onChange={(e) => handleConfigChange('targetProperty', e.target.value)}
              className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
            >
              <option>position</option>
              <option>rotation</option>
              <option>scale</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400">Duration (seconds)</label>
            <input
              type="number"
              step="0.1"
              value={(config as any).duration || 0}
              onChange={(e) => handleConfigChange('duration', parseFloat(e.target.value))}
              className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs"
            />
          </div>
        </>
      )}

      <div className="text-gray-500 pt-1">Tip: Click to expand full node editor</div>
    </div>
  );
}
