'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar/Sidebar';
import MapWrapper from '@/components/Map';
import DrawingControls from '@/components/DrawingControls';
import { Layer, DrawingMode, BoundingBox } from '@/lib/types';
import { models } from '@/lib/mockData';
import bbox from '@turf/bbox';
import { delineateFields, validateBBox } from '@/lib/delineateAnything';

export default function Home() {
  // Initialize layers from mock data (without features initially)
  const [layers, setLayers] = useState<Layer[]>(
    models.map((m, i) => ({
      id: m.id,
      name: m.name,
      data: m.boundary,
      visible: i === 0, // Only first one visible by default
      color: ['#0ea5e9', '#22c55e', '#f59e0b'][i % 3], // Assign different colors
      description: m.description,
      features: [] // Initialize empty, will be populated in useEffect
    }))
  );

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedFeatureBounds, setSelectedFeatureBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [boundingBoxes, setBoundingBoxes] = useState<BoundingBox[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Extract features on client side
  useEffect(() => {
    setLayers(prev => prev.map(layer => {
      const model = models.find(m => m.id === layer.id);
      if (!model || !model.boundary.features) return layer;

      const featureMetadata = model.boundary.features.map((feature: any, idx: number) => {
        const featureBbox = bbox(feature);
        return {
          id: `${layer.id}-feature-${idx}`,
          name: feature.properties?.name || feature.properties?.id || `Feature ${idx + 1}`,
          bounds: [[featureBbox[1], featureBbox[0]], [featureBbox[3], featureBbox[2]]] as [[number, number], [number, number]]
        };
      });

      console.log(`Client-side: Layer "${layer.name}" has ${featureMetadata.length} features`);

      return {
        ...layer,
        features: featureMetadata
      };
    }));
  }, []); // Run once on mount

  useEffect(() => {
    console.log('Layers state updated:', layers.map(l => ({
      name: l.name,
      featureCount: l.features?.length || 0,
      hasFeatures: !!(l.features && l.features.length > 0)
    })));
  }, [layers]);

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  const resize = (e: React.MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    }
  };

  const handleToggleLayer = (id: string) => {
    setLayers(prev => prev.map(l =>
      l.id === id ? { ...l, visible: !l.visible } : l
    ));
  };

  const handleRemoveLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
  };

  const handleFeatureClick = (layerId: string, featureIndex: number) => {
    const layer = layers.find(l => l.id === layerId);
    if (layer?.features && layer.features[featureIndex]) {
      setSelectedFeatureBounds(layer.features[featureIndex].bounds);
    }
  };

  const handleToggleDrawing = () => {
    setDrawingMode(prev => prev === 'rectangle' ? 'none' : 'rectangle');
  };

  const handleBoundingBoxCreated = (bounds: [[number, number], [number, number]]) => {
    // Validate bounding box
    const validation = validateBBox(bounds);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const newBbox: BoundingBox = {
      id: `bbox-${Date.now()}`,
      bounds,
      status: 'pending',
      createdAt: new Date()
    };

    setBoundingBoxes(prev => [...prev, newBbox]);
    setDrawingMode('none'); // Exit drawing mode after creating bbox
  };

  const handleDeleteBoundingBox = (id: string) => {
    setBoundingBoxes(prev => prev.filter(b => b.id !== id));
  };

  const handleGenerateBoundaries = async (modelId: string) => {
    const pendingBoxes = boundingBoxes.filter(b => b.status === 'pending');
    if (pendingBoxes.length === 0) return;

    setIsGenerating(true);

    for (const boundingBox of pendingBoxes) {
      try {
        // Update status to processing
        setBoundingBoxes(prev => prev.map(b =>
          b.id === boundingBox.id ? { ...b, status: 'processing' as const, modelId } : b
        ));

        // Call DelineateAnything model with selected model version
        const result = await delineateFields({
          bbox: boundingBox.bounds,
          modelVersion: modelId
        });

        // Extract features from result
        const featureMetadata = result.boundaries.features.map((feature: any, idx: number) => {
          const featureBbox = bbox(feature);
          return {
            id: `${boundingBox.id}-feature-${idx}`,
            name: feature.properties?.name || feature.properties?.id || `Field ${idx + 1}`,
            bounds: [[featureBbox[1], featureBbox[0]], [featureBbox[3], featureBbox[2]]] as [[number, number], [number, number]]
          };
        });

        // Create new layer from delineation result
        const newLayer: Layer = {
          id: `delineated-${Date.now()}`,
          name: `${modelId} - ${new Date().toLocaleTimeString()}`,
          data: result.boundaries,
          visible: true,
          color: '#a855f7', // Purple for delineated layers
          description: `Generated ${result.metadata.fieldCount} field boundaries (${result.metadata.processingTime}ms, ${(result.metadata.confidence! * 100).toFixed(1)}% confidence)`,
          features: featureMetadata
        };

        setLayers(prev => [newLayer, ...prev]);

        // Update bbox status to completed
        setBoundingBoxes(prev => prev.map(b =>
          b.id === boundingBox.id ? { ...b, status: 'completed' as const, layerId: newLayer.id } : b
        ));

      } catch (error: any) {
        console.error('Error generating boundaries:', error);
        setBoundingBoxes(prev => prev.map(b =>
          b.id === boundingBox.id ? {
            ...b,
            status: 'error' as const,
            error: error.message || 'Failed to generate boundaries'
          } : b
        ));
      }
    }

    setIsGenerating(false);
  };


  const handleFileUpload = async (file: File) => {
    if (file.name.endsWith('.gpkg')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const { GeoPackageAPI, setSqljsWasmLocateFile } = await import('@ngageoint/geopackage');

        // Configure WASM file location
        if (typeof setSqljsWasmLocateFile === 'function') {
          setSqljsWasmLocateFile(file => '/sql-wasm.wasm');
        }

        const gp = await GeoPackageAPI.open(new Uint8Array(arrayBuffer));
        const tables = gp.getFeatureTables();

        const newLayers: Layer[] = [];

        for (const table of tables) {
          const features: any[] = [];
          const iterator = gp.iterateGeoJSONFeatures(table);
          for (const feature of iterator) {
            features.push(feature);
          }

          if (features.length > 0) {
            // Calculate bounds for each feature
            const featureMetadata = features.map((feature, idx) => {
              const featureBbox = bbox(feature);
              return {
                id: `${table}-feature-${idx}`,
                name: feature.properties?.name || feature.properties?.id || `Feature ${idx + 1}`,
                bounds: [[featureBbox[1], featureBbox[0]], [featureBbox[3], featureBbox[2]]] as [[number, number], [number, number]]
              };
            });

            console.log(`Table "${table}" features extracted:`, featureMetadata.length);

            newLayers.push({
              id: `layer-${table}-${Date.now()}`,
              name: table, // Use table name as layer name
              data: { type: 'FeatureCollection', features },
              visible: true,
              color: '#' + Math.floor(Math.random() * 16777215).toString(16), // Random color for each layer
              description: `Imported from ${file.name} - Table: ${table} (${features.length} features)`,
              features: featureMetadata
            });
          }
        }

        if (newLayers.length > 0) {
          setLayers(prev => [...newLayers, ...prev]);
        } else {
          alert('No features found in GeoPackage');
        }
      } catch (err: any) {
        console.error('Error parsing GeoPackage:', err);
        alert(`Error parsing GeoPackage file: ${err.message || err}`);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.type === 'FeatureCollection' || json.type === 'Feature') {
          const data = json.type === 'Feature' ? { type: 'FeatureCollection', features: [json] } : json;

          // Calculate bounds for each feature
          const featureMetadata = data.features.map((feature: any, idx: number) => {
            const featureBbox = bbox(feature);
            return {
              id: `geojson-feature-${idx}`,
              name: feature.properties?.name || feature.properties?.id || `Feature ${idx + 1}`,
              bounds: [[featureBbox[1], featureBbox[0]], [featureBbox[3], featureBbox[2]]] as [[number, number], [number, number]]
            };
          });

          console.log('GeoJSON features extracted:', featureMetadata.length);

          const newLayer: Layer = {
            id: `layer-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            data,
            visible: true,
            color: '#a855f7', // Purple for user uploads
            description: `User uploaded layer (${data.features.length} features)`,
            features: featureMetadata
          };
          setLayers(prev => [newLayer, ...prev]);
        } else {
          alert('Invalid GeoJSON format');
        }
      } catch (err) {
        console.error(err);
        alert('Error parsing JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <main
      className="flex h-screen w-full bg-slate-950 overflow-hidden"
      onMouseMove={resize}
      onMouseUp={stopResizing}
      onMouseLeave={stopResizing}
    >
      <Sidebar
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onRemoveLayer={handleRemoveLayer}
        onFileUpload={handleFileUpload}
        onFeatureClick={handleFeatureClick}
        width={sidebarWidth}
      />

      {/* Resize Handle */}
      <div
        className="w-1 bg-slate-800 hover:bg-blue-500 cursor-col-resize transition-colors z-50 flex items-center justify-center group"
        onMouseDown={startResizing}
      >
        <div className="h-8 w-1 bg-slate-600 rounded-full group-hover:bg-white transition-colors" />
      </div>

      <div className="flex-1 relative h-full">
        <MapWrapper
          layers={layers}
          selectedFeatureBounds={selectedFeatureBounds}
          drawingMode={drawingMode}
          onBoundingBoxCreated={handleBoundingBoxCreated}
          boundingBoxes={boundingBoxes}
        />

        {/* Drawing Controls */}
        <DrawingControls
          drawingMode={drawingMode}
          onToggleDrawing={handleToggleDrawing}
          onGenerateBoundaries={handleGenerateBoundaries}
          boundingBoxes={boundingBoxes}
          onDeleteBoundingBox={handleDeleteBoundingBox}
          isGenerating={isGenerating}
        />

        {/* Overlay for no visible layers (optional) */}
        {!layers.some(l => l.visible) && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700/50 px-6 py-3 rounded-full shadow-2xl pointer-events-none">
            <p className="text-sm text-slate-300 font-medium">
              Toggle a layer to visualize boundaries
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
