'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, LayersControl, useMap, ScaleControl, Rectangle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import { Layer, DrawingMode, BoundingBox } from '@/lib/types';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
    layers: Layer[];
    selectedFeatureBounds: [[number, number], [number, number]] | null;
    drawingMode: DrawingMode;
    onBoundingBoxCreated: (bounds: [[number, number], [number, number]]) => void;
    boundingBoxes: BoundingBox[];
}

function MapController({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, 15);
    }, [center, map]);
    return null;
}

function FeatureBoundsController({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    }, [bounds, map]);
    return null;
}

function DrawingController({
    drawingMode,
    onBoundingBoxCreated
}: {
    drawingMode: DrawingMode;
    onBoundingBoxCreated: (bounds: [[number, number], [number, number]]) => void;
}) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        // Remove any existing draw controls
        map.eachLayer((layer) => {
            if (layer instanceof L.Control.Draw) {
                map.removeControl(layer);
            }
        });

        if (drawingMode === 'rectangle') {
            // Enable rectangle drawing
            const drawnItems = new L.FeatureGroup();
            map.addLayer(drawnItems);

            const drawControl = new L.Control.Draw({
                draw: {
                    rectangle: {
                        shapeOptions: {
                            color: '#a855f7',
                            weight: 2,
                            fillOpacity: 0.1
                        }
                    },
                    polygon: false,
                    polyline: false,
                    circle: false,
                    marker: false,
                    circlemarker: false
                },
                edit: {
                    featureGroup: drawnItems,
                    remove: false
                }
            });

            map.addControl(drawControl);

            // Handle rectangle creation
            const handleCreated = (e: any) => {
                const layer = e.layer;
                const bounds = layer.getBounds();
                const sw = bounds.getSouthWest();
                const ne = bounds.getNorthEast();

                onBoundingBoxCreated([
                    [sw.lat, sw.lng],
                    [ne.lat, ne.lng]
                ]);

                // Remove the drawn layer immediately (we'll display it separately)
                map.removeLayer(layer);
            };

            map.on(L.Draw.Event.CREATED, handleCreated);

            return () => {
                map.off(L.Draw.Event.CREATED, handleCreated);
                map.removeControl(drawControl);
                map.removeLayer(drawnItems);
            };
        }
    }, [map, drawingMode, onBoundingBoxCreated]);

    return null;
}

export default function Map({ layers, selectedFeatureBounds, drawingMode, onBoundingBoxCreated, boundingBoxes }: MapProps) {
    const defaultCenter: [number, number] = [37.7749, -122.4194]; // San Francisco

    // Calculate center from the first visible layer if available
    const visibleLayer = layers.find(l => l.visible);
    const center = visibleLayer?.data.features[0]?.geometry.type === 'Polygon'
        ? [
            (visibleLayer.data.features[0].geometry.coordinates[0][0][1] as number),
            (visibleLayer.data.features[0].geometry.coordinates[0][0][0] as number)
        ] as [number, number]
        : defaultCenter;

    return (
        <MapContainer center={defaultCenter} zoom={13} scrollWheelZoom={true} className="w-full h-full">
            <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Satellite (Esri)">
                    <TileLayer
                        attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Satellite (Google)">
                    <TileLayer
                        attribution="&copy; Google Maps"
                        url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Hybrid (Google)">
                    <TileLayer
                        attribution="&copy; Google Maps"
                        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Streets (OpenStreetMap)">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                </LayersControl.BaseLayer>
            </LayersControl>

            {layers.map((layer) => (
                layer.visible && (
                    <GeoJSON
                        key={layer.id}
                        data={layer.data}
                        style={{
                            color: layer.color,
                            weight: 2,
                            opacity: 1,
                            fillColor: layer.color,
                            fillOpacity: 0.2
                        }}
                    />
                )
            ))}

            {/* Render bounding boxes */}
            {boundingBoxes.map((bbox) => (
                <Rectangle
                    key={bbox.id}
                    bounds={bbox.bounds}
                    pathOptions={{
                        color: bbox.status === 'pending' ? '#eab308' :
                            bbox.status === 'processing' ? '#3b82f6' :
                                bbox.status === 'completed' ? '#22c55e' : '#ef4444',
                        weight: 2,
                        fillOpacity: 0.05,
                        dashArray: '5, 5'
                    }}
                />
            ))}

            {visibleLayer && <MapController center={center} />}
            <FeatureBoundsController bounds={selectedFeatureBounds} />
            <DrawingController drawingMode={drawingMode} onBoundingBoxCreated={onBoundingBoxCreated} />
            <ScaleControl position="bottomleft" />
            <MouseCoordinates />
        </MapContainer>
    );
}

function MouseCoordinates() {
    const map = useMap();
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!map) return;

        const handleMouseMove = (e: L.LeafletMouseEvent) => {
            setCoords(e.latlng);
        };

        map.on('mousemove', handleMouseMove);

        return () => {
            map.off('mousemove', handleMouseMove);
        };
    }, [map]);

    if (!coords) return null;

    return (
        <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control leaflet-bar bg-white/80 backdrop-blur px-2 py-1 text-xs font-mono text-slate-800 border border-slate-300 rounded shadow-sm m-4">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </div>
        </div>
    );
}
