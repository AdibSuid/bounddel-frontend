'use client';

import { Layer } from '@/lib/types';
import { Layers, Upload, Eye, EyeOff, Trash2, Info, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import clsx from 'clsx';
import { useRef, useState } from 'react';

interface SidebarProps {
    layers: Layer[];
    onToggleLayer: (id: string) => void;
    onRemoveLayer: (id: string) => void;
    onFileUpload: (file: File) => void;
    onFeatureClick: (layerId: string, featureIndex: number) => void;
    width: number;
}

export default function Sidebar({ layers, onToggleLayer, onRemoveLayer, onFileUpload, onFeatureClick, width }: SidebarProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());

    const toggleLayerExpansion = (layerId: string) => {
        setExpandedLayers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(layerId)) {
                newSet.delete(layerId);
            } else {
                newSet.add(layerId);
            }
            return newSet;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileUpload(file);
            // Reset input so same file can be selected again if needed
            e.target.value = '';
        }
    };

    return (
        <div
            style={{ width: `${width}px` }}
            className="bg-slate-900 border-r border-slate-800 flex flex-col h-full text-slate-100 shrink-0 transition-none"
        >
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Layers className="text-blue-500" />
                    BoundaryAI
                </h1>
                <p className="text-xs text-slate-400 mt-1">Industrial Delineation System</p>
            </div>

            <div className="p-4 border-b border-slate-800">
                <input
                    type="file"
                    accept=".geojson,.json,.gpkg"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg transition-colors font-medium text-sm"
                >
                    <Upload size={16} />
                    Upload File
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Layers</h2>
                <div className="space-y-3">
                    {layers.map((layer) => {
                        const isExpanded = expandedLayers.has(layer.id);
                        const hasFeatures = layer.features && layer.features.length > 0;

                        return (
                            <div
                                key={layer.id}
                                className="w-full text-left rounded-lg border bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all"
                            >
                                <div className="flex items-center justify-between gap-3 p-3">
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                        {hasFeatures && (
                                            <button
                                                onClick={() => toggleLayerExpansion(layer.id)}
                                                className="p-0.5 text-slate-400 hover:text-white transition-colors shrink-0"
                                            >
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </button>
                                        )}
                                        <div
                                            className="w-3 h-3 rounded-full shrink-0"
                                            style={{ backgroundColor: layer.color }}
                                        />
                                        <span className="font-medium text-sm truncate text-slate-200">
                                            {layer.name}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => onToggleLayer(layer.id)}
                                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                            title={layer.visible ? "Hide Layer" : "Show Layer"}
                                        >
                                            {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button
                                            onClick={() => onRemoveLayer(layer.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                            title="Remove Layer"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {layer.description && (
                                    <p className="text-xs text-slate-500 px-3 pb-2 line-clamp-2 pl-6">
                                        {layer.description}
                                    </p>
                                )}

                                {/* Feature List */}
                                {isExpanded && hasFeatures && (
                                    <div className="border-t border-slate-700 mt-2 pt-2 pb-2 px-3 space-y-1">
                                        {layer.features!.map((feature, idx) => (
                                            <button
                                                key={feature.id}
                                                onClick={() => onFeatureClick(layer.id, idx)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700/50 rounded transition-colors text-left"
                                            >
                                                <MapPin size={12} className="text-slate-500 shrink-0" />
                                                <span className="truncate">{feature.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {layers.length === 0 && (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            No layers added. Upload a file to get started.
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                    <div className="flex items-start gap-3">
                        <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
                        <div className="text-xs text-slate-400">
                            <p className="mb-1 text-slate-300 font-medium">System Status</p>
                            <p>All delineation models are online. Satellite imagery feed is stable.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
