# Public BMKG map services

The system permanently registers the two public map services published in the
BMKG Satu Peta MKG Data API:

| ID | Protocol | Endpoint | Layers |
| --- | --- | --- | --- |
| `rainfall-and-rain-days` | WMS | [BMKG MapServer](https://gis.bmkg.go.id/arcgis/rest/services/Peta_Curah_Hujan_dan_Hari_Hujan_/MapServer) | `1` Peta Curah Hujan, `0` Peta Hari Hujan |
| `wind-energy-potential` | WFS (catalog label) | [BMKG FeatureServer](https://gis.bmkg.go.id/arcgis/rest/services/Hosted/Peta_Potensi_Energi_Angin/FeatureServer) | `0` Peta_Potensi_Energi_Angin |

Both services are public and use EPSG:4326. The wind service is catalogued by
BMKG as WFS, while its published link is an ArcGIS FeatureServer; the registry
exposes both its metadata URL and layer-0 JSON query URL.

Clients can consume the permanent registry through:

```text
GET /api/v1/geospatial/map-services
```

Source catalog: https://gis.bmkg.go.id/portal/dataapi