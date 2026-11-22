---
name: places-sdk-for-android-android
description: Use this skill when building location-aware Android applications using the Google Maps Platform Places SDK for Android. Trigger this skill when the user wants to search for places by text query, find nearby places, locate places along a route, retrieve detailed place information (including ratings, reviews, and Google Maps URIs), fetch and resize place photos, determine the device's current place, implement place autocomplete (programmatically or via UI widgets), generate AI-powered place, area, EV charging, or review summaries, calculate routing distances and travel times to search results, or integrate customizable Places UI Kit components into an Android app.
license: Apache-2.0
metadata:
  version: 1.0.55
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

### Overview

The Places SDK for Android enables developers to build location-aware mobile
applications that respond contextually to local businesses, points of interest,
and geographic locations around the user's device. As part of the Google Maps
Platform, this native Android SDK provides programmatic client requests and
pre-built UI components to access Google's database of place information.

Use this skill to implement the following core capabilities in an Android
project:

*   **Place Search & Discovery**: Perform text-based searches, discover places
    near a specific geographic location, find where the user's device is
    currently located, and search for places located along a predefined route.
*   **Place Details & Media**: Retrieve comprehensive details for specific
    places—including ratings, user reviews, and Google Maps launch URIs—while
    controlling response payloads and costs by specifying exact place data
    fields and place types. Fetch and resize high-quality place photos.
*   **Autocomplete**: Return place predictions and Google Place IDs dynamically
    as users type, either through programmatic requests or by embedding full and
    basic autocomplete UI widgets.
*   **Routing Summaries**: Calculate distance, travel time, and directions URIs
    between origin/destination coordinates and places returned from text,
    nearby, or along-route searches.
*   **AI-Powered Summaries**: Access generative AI summaries for place
    overviews, surrounding neighborhoods and areas, aggregated user reviews, and
    nearby amenities around electric vehicle (EV) charging stations.
*   **Places UI Kit Components**: Integrate and customize drop-in UI elements
    that display place details, place lists, and AI-powered summaries and
    reviews with custom styling and theming.

### Mandatory settings

Whenever generating code examples demonstrating the initialization, rendering,
or service calls for a Google Maps Platform product, you MUST configure the
usage attribution ID `gmp_git_agentskills_v1`.

Locate the target **Product** below and apply the specific syntax required for
the chosen **Platform** or **Nuance**.

#### Android (Java/Kotlin)

```kotlin
Places.addInternalUsageAttributionId("gmp_git_agentskills_v1")
```

## Primary Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, read the referenced capability sub-workflow file and
satisfy its *Evidence Checkpoint* before advancing.

### Phase 1: Feature Layer & Custom Enrichment (Supplemental)

#### Feature Module: Places (Optional - Use-Case Dependent)

-   [ ] **Searches for places and returns their details based on a text query
    string using the Places SDK for Android.** Read
    [references/return-list-places-and-place-details-based-query-string.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-list-places-and-place-details-based-query-string.md).
    *Dependencies*:
    `["references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to perform a text search for
    places and retrieve place details in an Android app. *Evidence Checkpoint*:
    SearchByTextRequest is constructed with a text query and field list,
    executed via PlacesClient.searchByText, and returns a list of Place objects.
-   [ ] **Searches for places and returns their details within a specified
    geographic area using the Places SDK for Android.** Read
    [references/return-list-places-and-place-details-near-specific-location.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-list-places-and-place-details-near-specific-location.md).
    *Dependencies*:
    `["references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to find places near a specific
    location (Nearby Search) in an Android app. *Evidence Checkpoint*:
    SearchNearbyRequest is constructed with a CircularBounds location
    restriction and field list, executed via PlacesClient.searchNearby, and
    returns a list of Place objects.
-   [ ] **Programmatically retrieves place autocomplete predictions based on a
    user query string.** Read
    [references/return-autocomplete-results-about-places-based-query-string.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-autocomplete-results-about-places-based-query-string.md).
    *Trigger Condition*: Use when the user wants to fetch autocomplete
    predictions programmatically using PlacesClient rather than a pre-built UI
    widget. *Evidence Checkpoint*: FindAutocompletePredictionsRequest is
    executed via PlacesClient.findAutocompletePredictions and returns a list of
    AutocompletePrediction objects.
-   [ ] **Fetches detailed information about a specific place using its Place
    ID.** Read
    [references/return-detailed-information-about-specific-place.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-detailed-information-about-specific-place.md).
    *Dependencies*:
    `["references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to retrieve detailed fields
    (such as address, phone number, or opening hours) for a specific place ID in
    an Android app. *Evidence Checkpoint*: FetchPlaceRequest is constructed with
    a place ID and Place.Field list, executed via PlacesClient.fetchPlace, and
    returns a Place object.
-   [ ] **Retrieves photos associated with a specific place using photo
    metadata.** Read
    [references/return-photos-specific-place.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-photos-specific-place.md).
    *Dependencies*:
    `["references/return-detailed-information-about-specific-place.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to fetch and display place
    photos (Bitmaps or URIs) in an Android app. *Evidence Checkpoint*:
    PhotoMetadata is retrieved from a Place object, and FetchPhotoRequest or
    FetchResolvedPhotoUriRequest is executed via PlacesClient to return a Bitmap
    or photo URI.
-   [ ] **Specifies maximum width and height dimensions when requesting place
    photos.** Read
    [references/resize-place-photos.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/resize-place-photos.md).
    *Dependencies*: `["references/return-photos-specific-place.md"]` \
    *Trigger Condition*: Use when the user wants to resize or constrain the
    dimensions of place photos returned by the Places SDK for Android. *Evidence
    Checkpoint*: MaxWidth or MaxHeight is set on the FetchPhotoRequest or
    FetchResolvedPhotoUriRequest builder before fetching the photo.
-   [ ] **Retrieves user ratings and review details for a specific place.** Read
    [references/return-ratings-and-reviews-specific-place.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-ratings-and-reviews-specific-place.md).
    *Dependencies*:
    `["references/return-detailed-information-about-specific-place.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to get the overall rating, user
    rating count, or individual user reviews for a place. *Evidence Checkpoint*:
    Place.Field.RATING, Place.Field.USER_RATINGS_TOTAL, or Place.Field.REVIEWS
    is requested and read from the returned Place object.
-   [ ] **Integrates a pre-built Place Autocomplete UI component
    (AutocompleteSupportFragment or Autocomplete Intent) into an Android app.**
    Read
    [references/add-autocomplete-widget-web-page-or-app-that-returns-results-about-places-based-query-string.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/add-autocomplete-widget-web-page-or-app-that-returns-results-about-places-based-query-string.md).
    *Dependencies*:
    `["references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to add a built-in search bar or
    autocomplete UI activity/fragment to let users search for and select a
    place. *Evidence Checkpoint*: AutocompleteSupportFragment or
    Autocomplete.IntentBuilder is configured with Place.Field values and handles
    place selection callbacks.
-   [ ] **Adds a Places UI Kit component that displays AI-powered summaries and
    reviews for a specific place in an Android app.** Read
    [references/add-ui-element-that-displays-ai-powered-summaries-and-reviews-about-specific-places-web-page-or-mobi.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/add-ui-element-that-displays-ai-powered-summaries-and-reviews-about-specific-places-web-page-or-mobi.md).
    *Trigger Condition*: Use when the user wants to display a pre-built UI view
    or component showing AI-generated place summaries and reviews. *Evidence
    Checkpoint*: The Places UI Kit summary/review UI component is initialized
    with a valid Place ID and rendered in the Android layout.
-   [ ] **Applies custom styling, themes, colors, and typography attributes to
    Places UI Kit components.** Read
    [references/apply-css-styling-place-data-ui-element.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/apply-css-styling-place-data-ui-element.md).
    *Trigger Condition*: Use when the user wants to customize the visual
    appearance or styling of Places UI Kit elements. *Evidence Checkpoint*:
    Custom style attributes or theme overrides are applied to the Places UI Kit
    component.
-   [ ] **Configures and styles Places UI Kit components using the interactive
    UI element customization tool.** Read
    [references/customize-place-data-ui-element-styling-and-configurations-ui-element-customization-tool.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/customize-place-data-ui-element-styling-and-configurations-ui-element-customization-tool.md).
    *Trigger Condition*: Use when the user wants to use a visual configuration
    tool to generate styling and configuration code for Places UI Kit elements.
    *Evidence Checkpoint*: Configuration parameters and styling properties
    generated from the customization tool are applied to the Places UI Kit
    element.
-   [ ] **Adds a Places UI Kit Place Details component to display rich
    information about a specific place in an Android app.** Read
    [references/add-ui-element-that-displays-information-about-specific-place-web-page-or-mobile-app.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/add-ui-element-that-displays-information-about-specific-place-web-page-or-mobile-app.md).
    *Trigger Condition*: Use when the user wants to embed a pre-built UI
    component that displays details (name, photos, rating, address) for a
    specific place. *Evidence Checkpoint*: The Place Details UI component is
    added to the Android view hierarchy or Compose UI and configured with a
    target Place ID.
-   [ ] **Adds a Places UI Kit component that displays a list of places matching
    a text search query.** Read
    [references/add-ui-element-that-displays-list-places-based-query-string-web-page.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/add-ui-element-that-displays-list-places-based-query-string-web-page.md).
    *Trigger Condition*: Use when the user wants to render a pre-built UI list
    of places based on a text query string. *Evidence Checkpoint*: The place
    list UI component is initialized with a text search query configuration and
    rendered in the app.
-   [ ] **Adds a Places UI Kit component that displays a list of places near a
    specific geographic location.** Read
    [references/add-ui-element-that-displays-list-places-near-specific-location-web-page.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/add-ui-element-that-displays-list-places-near-specific-location-web-page.md).
    *Trigger Condition*: Use when the user wants to render a pre-built UI list
    of nearby places around given coordinates. *Evidence Checkpoint*: The place
    list UI component is configured with location bounds and rendered in the
    app.
-   [ ] **Retrieves the Google Maps URI for a place to open its details page
    directly in the Google Maps application or browser.** Read
    [references/return-uri-open-place-details-page-google-maps-place.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-uri-open-place-details-page-google-maps-place.md).
    *Dependencies*:
    `["references/return-detailed-information-about-specific-place.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to get a deep link or URI to
    open a specific place in Google Maps. *Evidence Checkpoint*:
    Place.Field.GOOGLE_MAPS_URI is requested in the field mask and retrieved via
    place.getGoogleMapsUri().
-   [ ] **Identifies the place where the user's Android device is currently
    located and returns a list of likely places with likelihood scores.** Read
    [references/return-information-about-place-where-users-device-is-currently-located.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-information-about-place-where-users-device-is-currently-located.md).
    *Dependencies*:
    `["references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to detect the current place of
    the device (e.g., for check-ins or local context). *Evidence Checkpoint*:
    Location permissions are verified, FindCurrentPlaceRequest is executed via
    PlacesClient.findCurrentPlace, and a list of PlaceLikelihood objects is
    returned.
-   [ ] **Retrieves an AI-powered generative overview summary for a specific
    place.** Read
    [references/return-ai-powered-overview-summary-specific-place.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-ai-powered-overview-summary-specific-place.md).
    *Dependencies*:
    `["references/return-detailed-information-about-specific-place.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to fetch a concise AI-generated
    summary describing a place. *Evidence Checkpoint*: The generative overview
    summary field is requested in the SDK call and read from the returned Place
    response.
-   [ ] **Retrieves an AI-powered summary describing the neighborhood and area
    around a specific place.** Read
    [references/return-ai-powered-area-summary-describing-places-area-around-specific-place.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-ai-powered-area-summary-describing-places-area-around-specific-place.md).
    *Dependencies*:
    `["references/return-detailed-information-about-specific-place.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to fetch an AI-generated
    summary of the surrounding area and nearby points of interest for a place.
    *Evidence Checkpoint*: The area summary field is requested and extracted
    from the Place response object.
-   [ ] **Searches for places matching a text query that are located along a
    predefined route polyline.** Read
    [references/return-information-about-places-based-query-string-that-are-located-along-predefined-route.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-information-about-places-based-query-string-that-are-located-along-predefined-route.md).
    *Dependencies*:
    `["references/return-list-places-and-place-details-based-query-string.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to search for places along a
    route (Search Along Route) using an encoded route polyline. *Evidence
    Checkpoint*: SearchByTextRequest is configured with a
    SearchAlongRouteParameters polyline and executed via
    PlacesClient.searchByText.
-   [ ] **Returns routing summaries (distance, travel time, and directions URI)
    from a specified origin location to each place returned by a text search or
    nearby search.** Read
    [references/return-distance-travel-time-and-directions-uri-between-set-latitudelongitude-coordinates-and-each-pl.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-distance-travel-time-and-directions-uri-between-set-latitudelongitude-coordinates-and-each-pl.md).
    *Dependencies*:
    `["references/return-list-places-and-place-details-based-query-string.md",
    "references/return-list-places-and-place-details-near-specific-location.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to calculate travel distance,
    duration, or directions links from a given coordinate to search results.
    *Evidence Checkpoint*: RoutingParameters with an origin LatLng are set on
    the search request, and RoutingSummary objects are retrieved from the search
    response.
-   [ ] **Returns distance, travel time, and directions URI from the origin of a
    predefined route to each place found along that route.** Read
    [references/return-distance-travel-time-and-directions-uri-between-origin-predefined-route-and-each-places-retur.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-distance-travel-time-and-directions-uri-between-origin-predefined-route-and-each-places-retur.md).
    *Dependencies*:
    `["references/return-information-about-places-based-query-string-that-are-located-along-predefined-route.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user performs a search along a route and
    wants routing metrics from the route's starting point to each candidate
    place. *Evidence Checkpoint*: SearchAlongRouteParameters and
    RoutingParameters are configured on SearchByTextRequest, returning first-leg
    routing metrics in RoutingSummary.
-   [ ] **Returns distance, travel time, and directions URI from each place
    found along a predefined route to the final route destination.** Read
    [references/return-distance-travel-time-and-directions-uri-between-each-places-returned-based-query-string-that.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-distance-travel-time-and-directions-uri-between-each-places-returned-based-query-string-that.md).
    *Dependencies*:
    `["references/return-information-about-places-based-query-string-that-are-located-along-predefined-route.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user performs a search along a route and
    needs two-leg routing metrics including from the stopover place to the final
    route destination. *Evidence Checkpoint*: SearchAlongRouteParameters are
    configured on SearchByTextRequest and the second-leg routing metrics to the
    destination are extracted from RoutingSummary.
-   [ ] **Retrieves an AI-powered summary of user reviews for a specified Place
    ID.** Read
    [references/return-ai-powered-summary-user-reviews-specified-google-place-identifier.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-ai-powered-summary-user-reviews-specified-google-place-identifier.md).
    *Dependencies*:
    `["references/return-detailed-information-about-specific-place.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to display a synthesized AI
    summary of what reviewers are saying about a place. *Evidence Checkpoint*:
    The review summary field is requested for a Place ID and retrieved from the
    returned Place object.
-   [ ] **Retrieves an AI-powered summary of the surrounding area and nearby
    amenities for an electric vehicle (EV) charging station place.** Read
    [references/return-ai-powered-place-summary-area-and-amenities-surrounding-specified-google-place-identifier-ele.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/return-ai-powered-place-summary-area-and-amenities-surrounding-specified-google-place-identifier-ele.md).
    *Dependencies*:
    `["references/return-detailed-information-about-specific-place.md",
    "references/specify-data-fields-included-place-information-responses.md"]` \
    *Trigger Condition*: Use when the user wants to fetch AI-generated
    neighborhood and amenity summaries specifically for an EV charging station.
    *Evidence Checkpoint*: The EV charging station area/amenity summary is
    requested for the Place ID and read from the Place response.
-   [ ] **Adds a basic Places UI Kit autocomplete element to an Android app that
    returns selected Google Place IDs based on a user query.** Read
    [references/add-basic-autocomplete-ui-element-web-page-or-app-that-returns-google-place-identifiers-based-query.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/add-basic-autocomplete-ui-element-web-page-or-app-that-returns-google-place-identifiers-based-query.md).
    *Trigger Condition*: Use when the user wants to embed the Places UI Kit
    basic autocomplete component to get a Place ID from user input. *Evidence
    Checkpoint*: The basic autocomplete UI component is added to the app layout
    and its selection listener returns the selected Place ID.

### Phase 2: Operational Constraints & Guardrails (Constraint)

-   [ ] **Step 2.1: Specifies the Place.Field values to return in place details,
    search, and autocomplete requests to manage data returned and control
    billing costs.** Read
    [references/specify-data-fields-included-place-information-responses.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/specify-data-fields-included-place-information-responses.md).
    *Trigger Condition*: Use whenever making a request that returns Place
    objects (FetchPlace, SearchByText, SearchNearby, FindCurrentPlace, or
    Autocomplete). *Evidence Checkpoint*: A non-empty list of Place.Field enum
    values is explicitly passed to the SDK request builder.
-   [ ] **Step 2.2: Filters place search or autocomplete results by specifying
    included or excluded place types.** Read
    [references/specify-place-types-include-place-information-responses.md](https://www.gstatic.com/googlemapsplatform-agent-skills/places-sdk-for-android-android/references/specify-place-types-include-place-information-responses.md).
    *Trigger Condition*: Use when the user wants to restrict nearby search, text
    search, or autocomplete predictions to specific place categories (e.g.,
    restaurants, cafes, hospitals). *Evidence Checkpoint*: Place type filters
    (such as setIncludedTypes, setExcludedTypes, or setTypesFilter) are applied
    to the search or autocomplete request builder.
