# Documentation

## Quick Start

Run the entire system with:
```bash
./start.sh
```

Or manually:
```bash
npm run install:all
npm run dev
```

## API Documentation

### Backend Endpoints

- `POST /infer`: Perform boundary delineation
  - Body: `{imageData: string, bbox: [[number, number], [number, number]], modelId?: string}`
  - Response: `{boundaries: GeoJSON, metadata: {fieldCount: number, processingTime: number, confidence: number}}`

## Configuration

### Model Parameters

- `minimum_area_m2`: Minimum field area in square meters (default: 2500)
- `minimal_confidence`: Minimum detection confidence (default: 0.005)
- `batch_size`: Inference batch size (default: 4)

### Environment Variables

- `SH_CLIENT_ID`: Sentinel Hub client ID (for image download)
- `SH_CLIENT_SECRET`: Sentinel Hub client secret
- `PYTHONPATH`: Path to Delineate-Anything repository

## Deployment

### Local Development

Run both services:
```bash
npm run dev
```

### Docker

[Add Docker instructions]

### Cloud

[Add cloud deployment instructions]