---
name: maps-sdk-for-android-android
description: Use this skill when building Android or Wear OS applications using the Google Maps SDK for Android. Trigger this skill when the user wants to embed interactive maps or Google Street View, configure map controls, gestures, and camera animations, or add markers, info windows, shapes, polylines, polygons, ground overlays, and tile overlays. Also use it for data visualization and custom styling, including cloud-based map styling, Map IDs, KML, GeoJSON, heatmaps, choropleth maps, boundary styling, and custom geospatial datasets.
license: Apache-2.0
metadata:
  version: 1.0.56
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

The Maps SDK for Android is a native Google Maps Platform library that enables
developers to integrate interactive Google Maps and Google Street View into
Android and Wear OS applications.

Use this skill to implement and configure native Android mapping capabilities,
including:

-   **Map & Street View Integration**: Embedding customizable maps and
    interactive Street View panoramas into Android and Wear OS apps.
-   **Camera, Controls & Gestures**: Programmatically controlling camera zoom,
    pan, and animation, configuring UI controls, changing map types and color
    schemes, and handling user gesture and click events.
-   **Markers & Overlays**: Adding, customizing, and handling interactions for
    markers, info windows, polylines, polygons, ground overlays, and custom tile
    overlays.
-   **Map Styling**: Applying cloud-based or local styles using reusable Map IDs
    to customize roads, buildings, landmarks, labels, place density, and
    zoom-level appearance.
-   **Data Visualization & Geospatial Datasets**: Rendering KML layers, GeoJSON
    data, heatmaps, traffic layers, and data-driven styling for administrative
    boundaries (choropleth maps) and custom geospatial datasets.

### Mandatory settings

Whenever generating code examples demonstrating the initialization, rendering,
or service calls for a Google Maps Platform product, you MUST configure the
usage attribution ID `gmp_git_agentskills_v1`.

Locate the target **Product** below and apply the specific syntax required for
the chosen **Platform** or **Nuance**.

#### Android (Java/Kotlin)

```kotlin
MapsApiSettings.addInternalUsageAttributionId(context, "gmp_git_agentskills_v1")
```

## Primary Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### Phase 1: Core Initialization & Base Setup (Primary)

-   [ ] **Step 1.1: Initializes and embeds an interactive Google Map instance
    into an Android application using SupportMapFragment or MapView.** Read
    [references/add-customizable-interactive-map-web-page-or-mobile-app.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-customizable-interactive-map-web-page-or-mobile-app.md).
    *Trigger Condition*: Use when starting a new Android map implementation or
    adding a basic interactive map viewport to an Android activity or fragment.
    *Evidence Checkpoint*: Android app compiles with the Maps SDK dependency,
    API key is configured in AndroidManifest.xml, and SupportMapFragment/MapView
    invokes onMapReady.
-   [ ] **Step 1.2: Initializes and embeds an interactive 360-degree Google
    Street View panorama in an Android app using
    SupportStreetViewPanoramaFragment or StreetViewPanoramaView.** Read
    [references/add-configurable-interactive-google-street-view-web-page-or-mobile-app.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-configurable-interactive-google-street-view-web-page-or-mobile-app.md).
    *Trigger Condition*: Use when the user wants to display a 360-degree Street
    View panorama in an Android activity or fragment. *Evidence Checkpoint*:
    SupportStreetViewPanoramaFragment or StreetViewPanoramaView is initialized,
    invokes onStreetViewPanoramaReady, and sets a valid Street View position.

### Phase 2: Feature Layer & Custom Enrichment (Supplemental)

#### Feature Module: Maps (Optional - Use-Case Dependent)

-   [ ] **Creates and configures a Cloud-based Map ID to store reusable map
    configuration and styling settings across platforms.** Read
    [references/create-reusable-map-identifier-store-map-configuration-and-styling-settings.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/create-reusable-map-identifier-store-map-configuration-and-styling-settings.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user needs a Map ID for cloud-based map
    styling, data-driven styling, or advanced map features. *Evidence
    Checkpoint*: A Map ID is created in the Google Cloud Console and passed to
    GoogleMapOptions or the map fragment XML attributes in the Android app.
-   [ ] **Creates a reusable, cloud-based map style in the Google Cloud Console
    and associates it with a Map ID.** Read
    [references/create-reusable-cross-platform-map-style.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/create-reusable-cross-platform-map-style.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/create-reusable-map-identifier-store-map-configuration-and-styling-settings.md"]` \
    *Trigger Condition*: Use when the user wants to create or apply custom
    cloud-based map styles that work across multiple platforms. *Evidence
    Checkpoint*: A cloud map style is published and linked to a Map ID, and the
    Android map renders with the custom style.
-   [ ] **Customizes the visual styling of road networks, polylines, and
    polygons on the map.** Read
    [references/change-style-roads-polylines-and-polygons-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-style-roads-polylines-and-polygons-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to alter the color, stroke
    width, or appearance of roads, polylines, or polygons. *Evidence
    Checkpoint*: Map style rules or polyline/polygon options are updated and
    rendered with the specified colors and weights.
-   [ ] **Controls the visibility of specific map features such as points of
    interest, transit, or road labels.** Read
    [references/display-or-hide-map-features.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/display-or-hide-map-features.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to show or hide built-in map
    elements or layers using map styling. *Evidence Checkpoint*: Targeted map
    features are hidden or displayed on the rendered GoogleMap instance via
    style configuration.
-   [ ] **Modifies the colors, visibility, and styling of map feature icons and
    text labels.** Read
    [references/change-style-icons-and-text-labels-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-style-icons-and-text-labels-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to customize the appearance of
    text labels and icons on the base map. *Evidence Checkpoint*: Map style
    configuration updates label text fill/stroke and icon styling on the
    rendered map.
-   [ ] **Configures cloud-based map styles to change dynamically across
    different camera zoom levels.** Read
    [references/apply-different-map-styles-different-zoom-levels.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/apply-different-map-styles-different-zoom-levels.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/create-reusable-cross-platform-map-style.md"]` \
    *Trigger Condition*: Use when the user wants map feature styles to vary
    depending on how far zoomed in or out the map camera is. *Evidence
    Checkpoint*: Zoom-level keyframe styles are configured in the Cloud Console
    and transition smoothly as the map zoom level changes.
-   [ ] **Adjusts the density of displayed points of interest (POIs) and places
    on the map.** Read
    [references/change-density-places-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-density-places-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/create-reusable-cross-platform-map-style.md"]` \
    *Trigger Condition*: Use when the user wants to increase or decrease the
    number of POI icons and labels cluttered on the map. *Evidence Checkpoint*:
    POI density settings are applied to the map style and reflected in the
    rendered Android map view.
-   [ ] **Customizes the appearance, footprints, and 3D extrusions of buildings
    on the map.** Read
    [references/change-style-buildings-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-style-buildings-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to style building footprints or
    toggle 3D building rendering on the map. *Evidence Checkpoint*: Building
    style settings or setBuildingsEnabled(boolean) are applied and visible at
    street-level zoom.
-   [ ] **Customizes the visibility and appearance of prominent landmarks on the
    map.** Read
    [references/change-style-landmarks-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-style-landmarks-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/create-reusable-cross-platform-map-style.md"]` \
    *Trigger Condition*: Use when the user wants to style or hide major landmark
    features on the map. *Evidence Checkpoint*: Landmark styling rules are
    applied to the map style and rendered on the Android map.
-   [ ] **Applies custom polygon fill and stroke styles to administrative
    boundaries (such as localities, postal codes, or countries) using
    data-driven styling.** Read
    [references/change-style-boundaries-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-style-boundaries-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/create-reusable-map-identifier-store-map-configuration-and-styling-settings.md"]` \
    *Trigger Condition*: Use when the user wants to highlight or style
    geographic or administrative boundary polygons on the map. *Evidence
    Checkpoint*: FeatureLayer for the boundary type is retrieved from GoogleMap
    and a FeatureLayer.StyleFactory is applied.
-   [ ] **Handles click events and user interactions on styled administrative
    boundary polygons.** Read
    [references/respond-user-interactions-boundaries-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/respond-user-interactions-boundaries-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/change-style-boundaries-map.md"]` \
    *Trigger Condition*: Use when the user wants to detect taps or clicks on
    geographic boundaries and inspect the clicked PlaceFeature. *Evidence
    Checkpoint*: FeatureLayer.OnFeatureClickListener is registered on the
    boundary FeatureLayer and handles FeatureClickEvent callbacks.
-   [ ] **Creates a choropleth map by shading administrative boundary polygons
    based on data metrics or Place IDs.** Read
    [references/add-choropleth-styling-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-choropleth-styling-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/change-style-boundaries-map.md"]` \
    *Trigger Condition*: Use when the user wants to color-code regions or
    boundaries on the map according to a statistical dataset or value gradient.
    *Evidence Checkpoint*: FeatureLayer.StyleFactory dynamically assigns fill
    colors to PlaceFeature boundaries based on mapped data values.
-   [ ] **Renders KML (Keyhole Markup Language) geographic data overlays onto
    the Android map using the Maps Android Utility Library.** Read
    [references/add-kml-layer-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-kml-layer-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to parse and display a KML file
    or stream as an overlay on the map. *Evidence Checkpoint*: KmlLayer is
    instantiated with the GoogleMap and KML resource/stream, and addLayerToMap()
    renders the features.
-   [ ] **Parses and renders GeoJSON points, line strings, and polygons onto the
    map using the Maps Android Utility Library.** Read
    [references/add-geo-json-data-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-geo-json-data-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to load and display GeoJSON
    formatted geographic features on the map. *Evidence Checkpoint*:
    GeoJsonLayer is initialized with a JSONObject or resource file and added to
    the GoogleMap via addLayerToMap().
-   [ ] **Renders a density heatmap tile overlay from a collection of geographic
    coordinates using the Maps Android Utility Library.** Read
    [references/add-heatmap-layer-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-heatmap-layer-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/add-custom-tile-overlay-map.md"]` \
    *Trigger Condition*: Use when the user wants to visualize the density or
    intensity of geographical data points as a heatmap. *Evidence Checkpoint*:
    HeatmapTileProvider is built with LatLng or WeightedLatLng data and added to
    the GoogleMap via TileOverlayOptions.
-   [ ] **Uploads and manages custom geospatial datasets (GeoJSON, CSV, KML) in
    the Google Cloud Console for data-driven styling.** Read
    [references/create-reusable-cross-platform-geospatial-dataset.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/create-reusable-cross-platform-geospatial-dataset.md).
    *Dependencies*:
    `["references/create-reusable-map-identifier-store-map-configuration-and-styling-settings.md",
    "references/create-reusable-cross-platform-map-style.md"]` \
    *Trigger Condition*: Use when the user wants to create a cloud-hosted custom
    geospatial dataset to associate with a Map Style and Map ID. *Evidence
    Checkpoint*: A custom dataset is uploaded in Google Cloud Console, linked to
    a Map Style/Map ID, and obtains a valid Dataset ID.
-   [ ] **Loads and displays a cloud-hosted custom geospatial dataset layer on
    the Android map.** Read
    [references/add-custom-geospatial-dataset-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-custom-geospatial-dataset-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/create-reusable-cross-platform-geospatial-dataset.md"]` \
    *Trigger Condition*: Use when the user wants to render features from a Maps
    Datasets API custom dataset on an Android map. *Evidence Checkpoint*:
    GoogleMap.getFeatureLayer() is called with FeatureType.DATASET and the
    specific datasetId to retrieve the active layer.
-   [ ] **Applies custom point, polyline, and polygon styles to features in a
    custom geospatial dataset based on feature attributes.** Read
    [references/change-style-custom-dataset-features-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-style-custom-dataset-features-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/add-custom-geospatial-dataset-map.md"]` \
    *Trigger Condition*: Use when the user wants to dynamically style custom
    dataset features on the map using attribute-driven rules. *Evidence
    Checkpoint*: FeatureLayer.StyleFactory inspects
    DatasetFeature.getDatasetAttributes() and returns a configured FeatureStyle.
-   [ ] **Listens for click events on custom dataset features and extracts
    custom attribute data from the selected features.** Read
    [references/respond-user-interactions-custom-dataset-features-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/respond-user-interactions-custom-dataset-features-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/add-custom-geospatial-dataset-map.md",
    "references/change-style-custom-dataset-features-map.md"]` \
    *Trigger Condition*: Use when the user wants to handle tap events on custom
    dataset features on the map and read their properties. *Evidence
    Checkpoint*: OnFeatureClickListener is attached to the dataset FeatureLayer
    and reads DatasetFeature attributes upon click.
-   [ ] **Displays and customizes pop-up info windows anchored to map markers to
    show contextual information.** Read
    [references/add-info-window-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-info-window-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/add-marker-map.md"]` \
    *Trigger Condition*: Use when the user wants to display titles, snippets, or
    custom views in an info window above a marker. *Evidence Checkpoint*: Marker
    title/snippet or GoogleMap.InfoWindowAdapter is configured and info windows
    display upon marker tap or showInfoWindow().
-   [ ] **Draws polylines, polygons, and circles on the map surface with
    customizable stroke, fill, and pattern options.** Read
    [references/add-shape-or-line-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-shape-or-line-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to draw routes, line segments,
    enclosed areas, or radius circles on the map. *Evidence Checkpoint*:
    PolylineOptions, PolygonOptions, or CircleOptions are added to the GoogleMap
    instance and rendered on screen.
-   [ ] **Places a Bitmap image overlay (GroundOverlay) tied to specific
    geographic coordinates or bounds that scales and rotates with the map.**
    Read
    [references/add-overlay-image-grounded-surface-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-overlay-image-grounded-surface-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to anchor a custom floor plan
    or image directly onto the map's surface. *Evidence Checkpoint*:
    GroundOverlayOptions with a BitmapDescriptor and position/LatLngBounds is
    added to the GoogleMap via addGroundOverlay().
-   [ ] **Adds a transparent or opaque grid of custom image tiles over the base
    map using a TileProvider or UrlTileProvider.** Read
    [references/add-custom-tile-overlay-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-custom-tile-overlay-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to overlay custom slippy map
    tiles or weather/raster imagery across zoom levels. *Evidence Checkpoint*:
    TileOverlayOptions configured with a TileProvider implementation is added to
    the GoogleMap via addTileOverlay().
-   [ ] **Listens for and responds to map click, long-click, POI click, and
    camera movement lifecycle events.** Read
    [references/respond-user-interactions-and-events-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/respond-user-interactions-and-events-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to execute code when the user
    taps the map, long-presses, clicks a POI, or pans/zooms the camera.
    *Evidence Checkpoint*: Event listeners such as OnMapClickListener,
    OnMapLongClickListener, or OnCameraIdleListener are registered on the
    GoogleMap instance.
-   [ ] **Configures built-in UI controls on the map, including zoom buttons,
    compass, My Location button, map toolbar, and map padding.** Read
    [references/customize-controls-that-appear-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/customize-controls-that-appear-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to enable, disable, or
    reposition on-screen UI controls on the GoogleMap. *Evidence Checkpoint*:
    UiSettings methods (such as setZoomControlsEnabled or setCompassEnabled) are
    invoked on googleMap.getUiSettings().
-   [ ] **Enables or disables touch gestures on the map such as zoom, scroll
    (pan), tilt, and rotate gestures.** Read
    [references/customize-gestures-controlling-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/customize-gestures-controlling-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to restrict or enable specific
    touch interactions like panning, pinching to zoom, or rotating the map.
    *Evidence Checkpoint*: Gesture toggle methods (such as
    setScrollGesturesEnabled or setZoomGesturesEnabled) are applied to
    googleMap.getUiSettings().
-   [ ] **Programmatically moves or animates the map camera's target location,
    zoom level, bearing, tilt, and geographic bounds restrictions.** Read
    [references/control-zoom-and-pan-map-camera.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/control-zoom-and-pan-map-camera.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to pan, zoom, tilt, rotate, or
    constrain the map viewport camera programmatically. *Evidence Checkpoint*:
    CameraUpdateFactory creates a CameraUpdate that is executed via
    googleMap.moveCamera() or googleMap.animateCamera().
-   [ ] **Switches the base map layer type between Normal, Satellite, Hybrid,
    Terrain, or None.** Read
    [references/change-map-type.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-map-type.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to display satellite imagery,
    terrain topography, or change the base map type. *Evidence Checkpoint*:
    googleMap.setMapType() is called with a valid GoogleMap.MAP_TYPE_* constant.
-   [ ] **Configures the map color palette to use light mode, dark mode, or
    follow the Android system theme setting.** Read
    [references/change-map-color-scheme.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/change-map-color-scheme.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to enable dark mode, light
    mode, or dynamic system color scheme switching for the map. *Evidence
    Checkpoint*: googleMap.setMapColorScheme() or
    GoogleMapOptions.mapColorScheme() is configured with MapColorScheme.LIGHT,
    DARK, or FOLLOW_SYSTEM.
-   [ ] **Toggles real-time road traffic density overlays on the map.** Read
    [references/add-traffic-layer-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-traffic-layer-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to display live traffic
    conditions and congestion color coding on the map. *Evidence Checkpoint*:
    googleMap.setTrafficEnabled(true) is invoked on the GoogleMap instance.
-   [ ] **Configures and embeds a Google Map tailored for Wear OS smartwatch
    devices, including ambient mode and swipe-to-dismiss handling.** Read
    [references/add-map-wear-os-app.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-map-wear-os-app.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user is building a map experience
    specifically for a Wear OS smartwatch application. *Evidence Checkpoint*:
    Wear OS dependencies and permissions are configured, SwipeDismissFrameLayout
    or ambient mode callbacks are handled with MapFragment/MapView.
-   [ ] **Places standard or advanced markers at specific geographic coordinates
    on the map.** Read
    [references/add-marker-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/add-marker-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to drop pins or markers at
    specific LatLng locations on the map. *Evidence Checkpoint*: MarkerOptions
    or AdvancedMarkerOptions with a LatLng position is passed to
    googleMap.addMarker().
-   [ ] **Customizes marker appearance using custom colors, bitmaps, custom
    Android Views, pin backgrounds, glyphs, opacity, rotation, and collision
    behavior.** Read
    [references/customize-marker-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/customize-marker-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/add-marker-map.md"]` \
    *Trigger Condition*: Use when the user wants to change a marker's icon,
    color, glyph, pin style, or use a custom View as a marker. *Evidence
    Checkpoint*: MarkerOptions/AdvancedMarkerOptions or PinConfig is configured
    with custom BitmapDescriptor, colors, or iconView and rendered on the map.
-   [ ] **Handles user click events, drag events, and info window click events
    on map markers.** Read
    [references/respond-user-interactions-markers-map.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/respond-user-interactions-markers-map.md).
    *Dependencies*:
    `["references/add-customizable-interactive-map-web-page-or-mobile-app.md",
    "references/add-marker-map.md"]` \
    *Trigger Condition*: Use when the user wants to run custom logic when a
    marker is tapped, dragged, or its info window is clicked. *Evidence
    Checkpoint*: OnMarkerClickListener, OnMarkerDragListener, or
    OnInfoWindowClickListener is registered on the GoogleMap instance.
-   [ ] **Listens for panorama changes, camera orientation changes, click
    events, and long-click events inside a Street View panorama.** Read
    [references/respond-user-interactions-and-events-google-street-view.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/respond-user-interactions-and-events-google-street-view.md).
    *Dependencies*:
    `["references/add-configurable-interactive-google-street-view-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to detect user taps, camera
    rotation, or location transitions inside Street View. *Evidence Checkpoint*:
    Listeners such as OnStreetViewPanoramaChangeListener,
    OnStreetViewPanoramaCameraChangeListener, or
    OnStreetViewPanoramaClickListener are registered.
-   [ ] **Enables or disables user controls and gestures in Street View,
    including panning, zooming, street names, and user navigation links.** Read
    [references/customize-gestures-that-are-available-google-street-view.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/customize-gestures-that-are-available-google-street-view.md).
    *Dependencies*:
    `["references/add-configurable-interactive-google-street-view-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to restrict or enable panning,
    zooming, street name overlays, or step navigation in Street View. *Evidence
    Checkpoint*: StreetViewPanorama configuration methods
    (setPanningGesturesEnabled, setZoomGesturesEnabled,
    setUserNavigationEnabled, setStreetNamesEnabled) are applied.
-   [ ] **Programmatically animates the Street View camera's bearing, tilt, and
    zoom over a specified duration.** Read
    [references/animate-camera-movements-google-street-view.md](https://www.gstatic.com/googlemapsplatform-agent-skills/maps-sdk-for-android-android/references/animate-camera-movements-google-street-view.md).
    *Dependencies*:
    `["references/add-configurable-interactive-google-street-view-web-page-or-mobile-app.md"]` \
    *Trigger Condition*: Use when the user wants to smoothly rotate, tilt, or
    zoom the Street View camera view programmatically. *Evidence Checkpoint*:
    StreetViewPanoramaCamera is built with target zoom, tilt, and bearing, and
    passed to streetViewPanorama.animateTo() with a duration.
