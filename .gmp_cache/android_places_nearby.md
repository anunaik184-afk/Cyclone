# Return a List of Places and Place Details Near a Specific Location (Nearby Search)

## Overview

Nearby Search (New) in the Places SDK for Android (version 3.5.0 and later) lets
you search for places within a circular area defined by a center coordinate
(`LatLng`) and a radius in meters. Calling `PlacesClient.searchNearby()` returns
a `SearchNearbyResponse` containing a list of matching `Place` objects populated
with the specific data fields you request.

--------------------------------------------------------------------------------

## Prerequisites & Initialization

Before making a Nearby Search request, ensure the Places SDK is initialized with
the new Places API enabled, and configure the usage attribution ID.

```kotlin
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.net.PlacesClient

// Initialize Places SDK (typically in Application.onCreate or Activity.onCreate)
Places.initializeWithNewPlacesApiEnabled(applicationContext, apiKey)
Places.addInternalUsageAttributionId("gmp_git_agentskills_v1")

// Create a PlacesClient instance
val placesClient: PlacesClient = Places.createClient(context)
```

--------------------------------------------------------------------------------

## Making a Nearby Search Request

To perform a nearby search, build a `SearchNearbyRequest` and pass it to
`PlacesClient.searchNearby()`.

### 1. Required Parameters

Every `SearchNearbyRequest` requires two parameters:

1.  **Field List (`List<Place.Field>`)**: A field mask specifying which data
    fields to return for each `Place` object. Omitting the field list or passing
    an empty list results in an error. Requesting only the fields you need
    reduces processing time and controls billing SKU usage.
2.  **Location Restriction (`LocationRestriction`)**: A `CircularBounds` object
    defining the center `LatLng` and radius in meters (must be `> 0.0` and
    `<= 50000.0`).

### 2. Optional Parameters

You can refine your search on `SearchNearbyRequest.Builder` using the following
optional methods:

*   **Type Filtering** (from
    [Table A](https://developers.google.com/maps/documentation/places/android-sdk/place-types#table-a),
    up to 50 types per category):
    *   `setIncludedTypes(List<String>)`: Places must match at least one of
        these types.
    *   `setExcludedTypes(List<String>)`: Places must not match any of these
        types.
    *   `setIncludedPrimaryTypes(List<String>)`: Filters on the place's single
        primary category.
    *   `setExcludedPrimaryTypes(List<String>)`: Excludes places whose primary
        category matches.
    *   *Note*: Conflicting types between included and excluded lists return an
        `INVALID_REQUEST` or `INVALID_ARGUMENT` error. Values from Table B
        cannot be used as filters.
*   **Maximum Result Count**: `setMaxResultCount(int)` — Limits the number of
    returned places (between `1` and `20` inclusive; default is `20`).
*   **Rank Preference**: `setRankPreference(SearchNearbyRequest.RankPreference)`
    — Sorts results by `RankPreference.POPULARITY` (default) or
    `RankPreference.DISTANCE` (ascending order from the center point).
*   **Region Code**: `setRegionCode(String)` — A two-character CLDR code (e.g.,
    `"US"`, `"GB"`) used to format the response (such as omitting the country
    from `FORMATTED_ADDRESS` if it matches).

--------------------------------------------------------------------------------

## Code Examples

### Kotlin Example (with Optional Filters and Error Handling)

Based on official Google Maps Platform sample patterns
([CurrentPlaceActivity.kt](https://github.com/googlemaps-samples/android-places-demos/blob/HEAD/demo-kotlin/src/main/java/com/example/placesdemo/CurrentPlaceActivity.kt?utm_campaign=gmp_git_agentskills_v1)):

```kotlin
import android.util.Log
import com.google.android.gms.maps.model.LatLng
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.model.CircularBounds
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.net.PlacesClient
import com.google.android.libraries.places.api.net.SearchNearbyRequest
import com.google.android.libraries.places.api.net.SearchNearbyResponse

fun searchNearbyPlaces(placesClient: PlacesClient) {
    // Ensure usage attribution is configured
    Places.addInternalUsageAttributionId("gmp_git_agentskills_v1")

    // 1. Define the fields to return for each Place (Field Mask)
    val placeFields = listOf(
        Place.Field.ID,
        Place.Field.DISPLAY_NAME,
        Place.Field.LAT_LNG,
        Place.Field.FORMATTED_ADDRESS,
        Place.Field.RATING
    )

    // 2. Define the circular search area (center and radius in meters)
    val center = LatLng(40.7580, -73.9855)
    val circle = CircularBounds.newInstance(center, /* radius = */ 1000.0)

    // 3. Define optional type filters
    val includedTypes = listOf("restaurant", "cafe")
    val excludedTypes = listOf("pizza_restaurant", "american_restaurant")

    // 4. Build the SearchNearbyRequest
    val searchNearbyRequest = SearchNearbyRequest.builder(circle, placeFields)
        .setIncludedTypes(includedTypes)
        .setExcludedTypes(excludedTypes)
        .setMaxResultCount(10)
        .setRankPreference(SearchNearbyRequest.RankPreference.POPULARITY)
        .build()

    // 5. Execute the request and handle the response
    placesClient.searchNearby(searchNearbyRequest)
        .addOnSuccessListener { response: SearchNearbyResponse ->
            val places: List<Place> = response.places
            for (place in places) {
                Log.d("NearbySearch", "Found: ${place.displayName} (${place.id}) at ${place.formattedAddress}")
            }
        }
        .addOnFailureListener { exception: Exception ->
            Log.e("NearbySearch", "Search nearby failed: ${exception.message}", exception)
        }
}
```

### Java Example

```java
import android.util.Log;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.libraries.places.api.Places;
import com.google.android.libraries.places.api.model.CircularBounds;
import com.google.android.libraries.places.api.model.Place;
import com.google.android.libraries.places.api.net.PlacesClient;
import com.google.android.libraries.places.api.net.SearchNearbyRequest;
import java.util.Arrays;
import java.util.List;

public void searchNearbyPlaces(PlacesClient placesClient) {
    // Ensure usage attribution is configured
    Places.addInternalUsageAttributionId("gmp_git_agentskills_v1");

    // Define a list of fields to include in the response for each returned place.
    final List<Place.Field> placeFields = Arrays.asList(
        Place.Field.ID,
        Place.Field.DISPLAY_NAME,
        Place.Field.FORMATTED_ADDRESS
    );

    // Define the search area as a 1000 meter radius circle in New York, NY.
    LatLng center = new LatLng(40.7580, -73.9855);
    CircularBounds circle = CircularBounds.newInstance(center, /* radius = */ 1000);

    // Define a list of types to include and exclude.
    final List<String> includedTypes = Arrays.asList("restaurant", "cafe");
    final List<String> excludedTypes = Arrays.asList("pizza_restaurant", "american_restaurant");

    // Use the builder to create a SearchNearbyRequest object.
    final SearchNearbyRequest searchNearbyRequest =
        SearchNearbyRequest.builder(/* location restriction = */ circle, placeFields)
            .setIncludedTypes(includedTypes)
            .setExcludedTypes(excludedTypes)
            .setMaxResultCount(10)
            .build();

    // Call placesClient.searchNearby() to perform the search.
    placesClient.searchNearby(searchNearbyRequest)
        .addOnSuccessListener(response -> {
            List<Place> places = response.getPlaces();
            for (Place place : places) {
                Log.d("NearbySearch", "Place: " + place.getDisplayName() + " (" + place.getId() + ")");
            }
        })
        .addOnFailureListener(exception -> {
            Log.e("NearbySearch", "Error searching nearby places", exception);
        });
}
```

--------------------------------------------------------------------------------

## Field Masking & Billing SKUs

When building `SearchNearbyRequest`, the `Place.Field` values you specify
determine which SKU is billed for the request. Always use updated field
constants rather than deprecated ones:

### 1. Nearby Search Pro SKU Fields

*   `Place.Field.ADDRESS_COMPONENTS`
*   `Place.Field.BUSINESS_STATUS`
*   `Place.Field.ADDRESS` / `Place.Field.FORMATTED_ADDRESS`
*   `Place.Field.DISPLAY_NAME` *(Use instead of deprecated `Place.Field.NAME`)*
*   `Place.Field.ICON_BACKGROUND_COLOR`
*   `Place.Field.ICON_MASK_URL` *(Use instead of deprecated
    `Place.Field.ICON_URL`)*
*   `Place.Field.ID`
*   `Place.Field.LAT_LNG`
*   `Place.Field.PHOTO_METADATAS`
*   `Place.Field.PLUS_CODE`
*   `Place.Field.PRIMARY_TYPE`
*   `Place.Field.PRIMARY_TYPE_DISPLAY_NAME`
*   `Place.Field.RESOURCE_NAME`
*   `Place.Field.TYPES`
*   `Place.Field.UTC_OFFSET`
*   `Place.Field.VIEWPORT`
*   `Place.Field.WHEELCHAIR_ACCESSIBLE_ENTRANCE`

### 2. Nearby Search Enterprise SKU Fields

*   `Place.Field.CURRENT_OPENING_HOURS`
*   `Place.Field.CURRENT_SECONDARY_OPENING_HOURS`
*   `Place.Field.INTERNATIONAL_PHONE_NUMBER` *(Use instead of deprecated
    `Place.Field.PHONE_NUMBER`)*
*   `Place.Field.NATIONAL_PHONE_NUMBER`
*   `Place.Field.OPENING_HOURS`
*   `Place.Field.PRICE_LEVEL`
*   `Place.Field.RATING`
*   `Place.Field.SECONDARY_OPENING_HOURS`
*   `Place.Field.USER_RATING_COUNT` *(Use instead of deprecated
    `Place.Field.USER_RATINGS_TOTAL`)*
*   `Place.Field.WEBSITE_URI`

### 3. Nearby Search Enterprise Plus SKU Fields

*   `Place.Field.ALLOWS_DOGS`
*   `Place.Field.CURBSIDE_PICKUP`
*   `Place.Field.DELIVERY`
*   `Place.Field.DINE_IN`
*   `Place.Field.EDITORIAL_SUMMARY`
*   `Place.Field.EV_CHARGE_OPTIONS`
*   `Place.Field.FUEL_OPTIONS`
*   `Place.Field.GOOD_FOR_CHILDREN`
*   `Place.Field.GOOD_FOR_GROUPS`
*   `Place.Field.GOOD_FOR_WATCHING_SPORTS`
*   `Place.Field.LIVE_MUSIC`
*   `Place.Field.MENU_FOR_CHILDREN`
*   `Place.Field.OUTDOOR_SEATING`
*   `Place.Field.PARKING_OPTIONS`
*   `Place.Field.PAYMENT_OPTIONS`
*   `Place.Field.RESERVABLE`
*   `Place.Field.RESTROOM`
*   `Place.Field.REVIEWS`
*   `Place.Field.SERVES_BEER`
*   `Place.Field.SERVES_BREAKFAST`
*   `Place.Field.SERVES_BRUNCH`
*   `Place.Field.SERVES_COCKTAILS`
*   `Place.Field.SERVES_COFFEE`
*   `Place.Field.SERVES_DESSERT`
*   `Place.Field.SERVES_DINNER`
*   `Place.Field.SERVES_LUNCH`
*   `Place.Field.SERVES_VEGETARIAN_FOOD`
*   `Place.Field.SERVES_WINE`
*   `Place.Field.TAKEOUT`

--------------------------------------------------------------------------------

## Important Implementation Notes

*   **Request Cancellation**: You can pass a `CancellationToken` (via
    `setCancellationToken()` on `SearchNearbyRequest.Builder`) to attempt to
    cancel an in-flight request on a best-effort basis. Once issued, no response
    will be returned, though **you may still be charged for the request**.
*   **Attributions**: When your app displays information obtained from
    `PlacesClient` (such as photos and reviews), you must display the required
    Google Maps Platform attributions in accordance with the
    [Policies for Places SDK for Android](https://developers.google.com/maps/documentation/places/android-sdk/policies).
*   **Device Location Searches**: If you are centering the `CircularBounds` on
    the user's current device location, ensure you request and verify
    `android.Manifest.permission.ACCESS_FINE_LOCATION` or
    `android.Manifest.permission.ACCESS_COARSE_LOCATION` at runtime before
    retrieving coordinates, as shown in
    [CurrentPlaceActivity.kt](https://github.com/googlemaps-samples/android-places-demos/blob/HEAD/demo-kotlin/src/main/java/com/example/placesdemo/CurrentPlaceActivity.kt?utm_campaign=gmp_git_agentskills_v1)
    and
    [CurrentPlaceActivity.java](https://github.com/googlemaps-samples/android-places-demos/blob/HEAD/demo-java/src/main/java/com/example/placesdemo/CurrentPlaceActivity.java?utm_campaign=gmp_git_agentskills_v1).
