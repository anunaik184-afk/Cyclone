# Return a List of Places and Place Details Based on a Query String (Text Search)

Text Search (New) returns information about a set of places based on an
arbitrary text string (for example, `"pizza in New York"`,
`"shoe stores near Ottawa"`, or `"123 Main Street"`). The service responds with
a list of
[`Place`](https://developers.google.com/maps/documentation/places/android-sdk/reference/com/google/android/libraries/places/api/model/Place)
objects matching the query string and any location bias or restriction set in
the request.

> **Note:** Text Search (New) is part of **Places SDK for Android (New)**
> (available in version 3.3.0 and later, with Kotlin DSL enhancements in version
> 4.0.0+) and requires initializing the SDK with
> `Places.initializeWithNewPlacesApiEnabled()`.

--------------------------------------------------------------------------------

## Prerequisites & Initialization

Before making a Text Search request, initialize the `Places` SDK with the new
Places API enabled, configure usage attribution, and create a `PlacesClient`
instance.

```kotlin
import android.content.Context
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.net.PlacesClient

fun createPlacesClient(context: Context, apiKey: String): PlacesClient {
    // 1. Initialize Places SDK with New Places API enabled
    if (!Places.isInitialized()) {
        Places.initializeWithNewPlacesApiEnabled(context.applicationContext, apiKey)
    }

    // 2. Configure usage attribution ID
    Places.addInternalUsageAttributionId("gmp_git_agentskills_v1")

    // 3. Create and return the PlacesClient
    return Places.createClient(context)
}
```

--------------------------------------------------------------------------------

## Workflow: Executing a Text Search Request

### 1. Define the Field List (Required)

You must pass a list of
[`Place.Field`](https://developers.google.com/maps/documentation/places/android-sdk/reference/com/google/android/libraries/places/api/model/Place.Field)
values specifying which data fields to return. There is no default list of
returned fields. Requesting only the fields you need reduces processing time and
prevents unnecessary billing charges across SKU tiers.

| Billing SKU Tier                | Common `Place.Field` Constants           |
| :------------------------------ | :--------------------------------------- |
| **Text Search Essentials (ID    | `Place.Field.ID`,                        |
: Only)**                         : `Place.Field.DISPLAY_NAME` (replaces     :
:                                 : deprecated `NAME`),                      :
:                                 : `Place.Field.RESOURCE_NAME`              :
| **Text Search Pro**             | `Place.Field.FORMATTED_ADDRESS`          |
:                                 : (replaces `ADDRESS`),                    :
:                                 : `Place.Field.LOCATION` (replaces         :
:                                 : `LAT_LNG`), `Place.Field.TYPES`,         :
:                                 : `Place.Field.PRIMARY_TYPE`,              :
:                                 : `Place.Field.PRIMARY_TYPE_DISPLAY_NAME`, :
:                                 : `Place.Field.BUSINESS_STATUS`,           :
:                                 : `Place.Field.VIEWPORT`,                  :
:                                 : `Place.Field.PHOTO_METADATAS`,           :
:                                 : `Place.Field.ICON_MASK_URL`,             :
:                                 : `Place.Field.ICON_BACKGROUND_COLOR`,     :
:                                 : `Place.Field.ACCESSIBILITY_OPTIONS`,     :
:                                 : `Place.Field.GOOGLE_MAPS_URI`,           :
:                                 : `Place.Field.PLUS_CODE`,                 :
:                                 : `Place.Field.UTC_OFFSET`                 :
| **Text Search Enterprise**      | `Place.Field.RATING`,                    |
:                                 : `Place.Field.USER_RATING_COUNT`          :
:                                 : (replaces `USER_RATINGS_TOTAL`),         :
:                                 : `Place.Field.PRICE_LEVEL`,               :
:                                 : `Place.Field.OPENING_HOURS`,             :
:                                 : `Place.Field.CURRENT_OPENING_HOURS`,     :
:                                 : `Place.Field.INTERNATIONAL_PHONE_NUMBER` :
:                                 : (replaces `PHONE_NUMBER`),               :
:                                 : `Place.Field.NATIONAL_PHONE_NUMBER`,     :
:                                 : `Place.Field.WEBSITE_URI`                :
| **Text Search Enterprise Plus** | `Place.Field.REVIEWS`,                   |
:                                 : `Place.Field.EDITORIAL_SUMMARY`,         :
:                                 : `Place.Field.EV_CHARGE_OPTIONS`,         :
:                                 : `Place.Field.FUEL_OPTIONS`,              :
:                                 : `Place.Field.PARKING_OPTIONS`,           :
:                                 : `Place.Field.PAYMENT_OPTIONS`,           :
:                                 : `Place.Field.DELIVERY`,                  :
:                                 : `Place.Field.DINE_IN`,                   :
:                                 : `Place.Field.TAKEOUT`,                   :
:                                 : `Place.Field.CURBSIDE_PICKUP`,           :
:                                 : `Place.Field.RESERVABLE`,                :
:                                 : `Place.Field.OUTDOOR_SEATING`,           :
:                                 : `Place.Field.SERVES_VEGETARIAN_FOOD`,    :
:                                 : `Place.Field.ALLOWS_DOGS`, etc.          :

### 2. Build `SearchByTextRequest` and Call `searchByText()`

Construct a
[`SearchByTextRequest`](https://developers.google.com/maps/documentation/places/android-sdk/reference/com/google/android/libraries/places/api/net/SearchByTextRequest)
using `SearchByTextRequest.builder(textQuery, placeFields)` (or the Kotlin
`searchByTextRequest` DSL) and pass it to `PlacesClient.searchByText()`.

#### Kotlin Example

```kotlin
import android.util.Log
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.maps.model.LatLng
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.model.RectangularBounds
import com.google.android.libraries.places.api.net.PlacesClient
import com.google.android.libraries.places.api.net.SearchByTextRequest

fun searchPlacesByText(placesClient: PlacesClient) {
    // 1. Specify the list of fields to return
    val placeFields = listOf(
        Place.Field.ID,
        Place.Field.DISPLAY_NAME,
        Place.Field.FORMATTED_ADDRESS,
        Place.Field.LOCATION,
        Place.Field.RATING
    )

    // 2. Define latitude and longitude coordinates for the search area
    val southWest = LatLng(37.38816277477739, -122.08813770258874)
    val northEast = LatLng(37.39580487866437, -122.07702325966572)

    // 3. Build the SearchByTextRequest
    val searchByTextRequest = SearchByTextRequest.builder("Spicy Vegetarian Food", placeFields)
        .setMaxResultCount(10)
        .setLocationRestriction(RectangularBounds.newInstance(southWest, northEast))
        .setMinRating(4.0)
        .setOpenNow(true)
        .build()

    // 4. Perform the search and handle the response
    placesClient.searchByText(searchByTextRequest)
        .addOnSuccessListener { response ->
            val places: List<Place> = response.places
            for (place in places) {
                Log.i("PlacesTextSearch", "Place: ${place.displayName} (${place.id}) - ${place.formattedAddress}")
            }
        }
        .addOnFailureListener { exception ->
            if (exception is ApiException) {
                Log.e("PlacesTextSearch", "Place search failed with status code: ${exception.statusCode}", exception)
            } else {
                Log.e("PlacesTextSearch", "Place search failed: ${exception.message}", exception)
            }
        }
}
```

#### Java Example

```java
import android.util.Log;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.libraries.places.api.model.Place;
import com.google.android.libraries.places.api.model.RectangularBounds;
import com.google.android.libraries.places.api.net.PlacesClient;
import com.google.android.libraries.places.api.net.SearchByTextRequest;
import java.util.Arrays;
import java.util.List;

public void searchPlacesByText(PlacesClient placesClient) {
    // Specify the list of fields to return.
    final List<Place.Field> placeFields = Arrays.asList(
        Place.Field.ID,
        Place.Field.DISPLAY_NAME,
        Place.Field.FORMATTED_ADDRESS
    );

    // Define latitude and longitude coordinates of the search area.
    LatLng southWest = new LatLng(37.38816277477739, -122.08813770258874);
    LatLng northEast = new LatLng(37.39580487866437, -122.07702325966572);

    // Use the builder to create a SearchByTextRequest object.
    final SearchByTextRequest searchByTextRequest = SearchByTextRequest.builder("Spicy Vegetarian Food", placeFields)
        .setMaxResultCount(10)
        .setLocationRestriction(RectangularBounds.newInstance(southWest, northEast))
        .build();

    // Call PlacesClient.searchByText() to perform the search.
    placesClient.searchByText(searchByTextRequest)
        .addOnSuccessListener(response -> {
            List<Place> places = response.getPlaces();
            for (Place place : places) {
                Log.i("PlacesTextSearch", "Found: " + place.getDisplayName() + " (" + place.getId() + ")");
            }
        })
        .addOnFailureListener(exception -> {
            if (exception instanceof ApiException) {
                ApiException apiException = (ApiException) exception;
                Log.e("PlacesTextSearch", "Error status code: " + apiException.getStatusCode());
            }
        });
}
```

--------------------------------------------------------------------------------

## Refining Queries with Optional Parameters

You can refine `SearchByTextRequest` using the following builder methods:

| Parameter      | Builder Method                                | Rules & Constraints                                                                          |
| :------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Location     | `setLocationBias(LocationBias)`               | Biases results toward a region (`CircularBounds.newInstance(center, radiusMeters)` with      |
: Bias**         :                                               : radius `0.0..50000.0`, or `RectangularBounds.newInstance(southWest, northEast)`). Results    :
:                :                                               : outside the area can still be returned. Ignored if `textQuery` contains an explicit location :
:                :                                               : (e.g., `"Market in Barcelona"`). **Cannot be used together with `locationRestriction`.**     :
| **Location     | `setLocationRestriction(LocationRestriction)` | Strictly restricts results to a rectangular viewport                                         |
: Restriction**  :                                               : (`RectangularBounds.newInstance(southWest, northEast)`). Results outside the box are never   :
:                :                                               : returned. **Cannot be used together with `locationBias`.** (Note\: `CircularBounds` is not   :
:                :                                               : supported for `locationRestriction`).                                                        :
| **Included     | `setIncludedType(String)`                     | Filters results to a single place type from [Table                                           |
: Type**         :                                               : A](https\://developers.google.com/maps/documentation/places/android-sdk/place-types#table-a) :
:                :                                               : (e.g., `"bar"`, `"pharmacy"`). Table B types cannot be used as filters.                      :
| **Strict Type  | `setStrictTypeFiltering( boolean)`            | Used with `setIncludedType()`. When `true`, only places strictly matching the specified type |
: Filtering**    :                                               : are returned. Defaults to `false`.                                                           :
| **Maximum      | `setMaxResultCount(Integer)`                  | Maximum number of results to return per page. Must be between `1` and `20` (default is       |
: Result Count** :                                               : `20`).                                                                                       :
| **Minimum      | `setMinRating(Double)`                        | Restricts results to places with an average rating `>=` this value (`0.0` to `5.0`). Rounded |
: Rating**       :                                               : up to the nearest `0.5` increment (e.g., `0.6` becomes `1.0`).                               :
| **Open Now**   | `setOpenNow( boolean)`                        | If `true`, returns only places open at the time of the query. If `false`, returns all        |
:                :                                               : businesses (including places without opening hours in the database).                         :
| **Price        | `setPriceLevels(List<Integer>)`               | Filters by price levels: `1` (Inexpensive), `2` (Moderate), `3` (Expensive), `4` (Very       |
: Levels**       :                                               : Expensive). Note\: `0` (Free) may appear in responses but **cannot** be passed as a request  :
:                :                                               : filter.                                                                                      :
| **Rank         | `setRankPreference(RankPreference)`           | `SearchByTextRequest.RankPreference.RELEVANCE` (default for categorical queries) or          |
: Preference**   :                                               : `SearchByTextRequest.RankPreference.DISTANCE`. Leave unset for non-categorical queries       :
:                :                                               : (e.g., `"Mountain View, CA"`).                                                               :
| **Region       | `setRegionCode(String)`                       | Two-character CLDR code (e.g., `"us"`, `"gb"`) used to format addresses and bias results.    |
: Code**         :                                               : Required for best results when searching by phone number (use E.164 format or country code + :
:                :                                               : space).                                                                                      :
| **Cancellation | `setCancellationToken(CancellationToken)`     | Best-effort request cancellation via `CancellationTokenSource`. Note: Issuing a cancellation |
: Token**        :                                               : token does not guarantee cancellation, and you may still be billed if no response is         :
:                :                                               : returned.                                                                                    :

### Circular Location Bias Example

```kotlin
val searchCenter = LatLng(37.38816277477739, -122.08813770258874)

val request = SearchByTextRequest.builder("Coffee", listOf(Place.Field.ID, Place.Field.DISPLAY_NAME))
    .setLocationBias(CircularBounds.newInstance(searchCenter, 500.0)) // 500 meters
    .setIncludedType("cafe")
    .setStrictTypeFiltering(true)
    .setPriceLevels(listOf(1, 2))
    .setRankPreference(SearchByTextRequest.RankPreference.DISTANCE)
    .build()
```

--------------------------------------------------------------------------------

## Pagination

`SearchByTextResponse` supports pagination via `getPagination()`, which returns
a
[`Pagination`](https://developers.google.com/maps/documentation/places/android-sdk/reference/com/google/android/libraries/places/api/net/Pagination)
object:

-   Call `pagination.hasNextPage()` to check if additional results are
    available.
-   Optionally call `pagination.setPageSize(size)` (up to 20) to adjust the page
    size for the next batch.
-   Call `pagination.fetchNextPage()` to asynchronously retrieve the next
    `SearchByTextResponse`.

### Kotlin Pagination Example

```kotlin
import android.util.Log
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.net.PlacesClient
import com.google.android.libraries.places.api.net.SearchByTextResponse
import com.google.android.libraries.places.api.net.kotlin.searchByTextRequest

fun searchWithPagination(placesClient: PlacesClient) {
    val request = searchByTextRequest("restaurants", listOf(Place.Field.ID, Place.Field.DISPLAY_NAME)) {
        maxResultCount = 10
    }

    placesClient.searchByText(request)
        .addOnSuccessListener { response: SearchByTextResponse ->
            val places = response.places
            Log.i("PlacesPagination", "First page count: ${places.size}")

            val pagination = response.pagination
            if (pagination != null && pagination.hasNextPage()) {
                pagination.setPageSize(20) // Optionally change page size from 10 to 20
                pagination.fetchNextPage()
                    .addOnSuccessListener { nextPageResponse ->
                        val nextPagePlaces = nextPageResponse.places
                        Log.i("PlacesPagination", "Second page count: ${nextPagePlaces.size}")
                    }
                    .addOnFailureListener { exception ->
                        Log.e("PlacesPagination", "Failed to fetch next page", exception)
                    }
            }
        }
        .addOnFailureListener { exception ->
            Log.e("PlacesPagination", "Initial search failed", exception)
        }
}
```

### Java Pagination Example

```java
SearchByTextRequest searchByTextRequest =
    SearchByTextRequest.builder("restaurants", Arrays.asList(Place.Field.ID, Place.Field.DISPLAY_NAME))
        .setMaxResultCount(10)
        .build();

placesClient.searchByText(searchByTextRequest)
    .addOnSuccessListener(response -> {
        List<Place> places = response.getPlaces();
        Log.i(TAG, "Places result: " + places);

        Pagination pagination = response.getPagination();
        if (pagination != null && pagination.hasNextPage()) {
            pagination.setPageSize(20); // change the page size from 10 to 20
            pagination.fetchNextPage()
                .addOnSuccessListener(nextPageResponse -> {
                    List<Place> nextPagePlaces = nextPageResponse.getPlaces();
                    Log.i(TAG, "Next page places result: " + nextPagePlaces);
                })
                .addOnFailureListener(exception -> {
                    Log.e(TAG, "Next page fetch error", exception);
                });
        }
    })
    .addOnFailureListener(exception -> {
        if (exception instanceof ApiException) {
            // Handle error with given status code
        }
    });
```

--------------------------------------------------------------------------------

## Common Pitfalls & Guardrails

1.  **Setting Both `locationBias` and `locationRestriction`**: You can specify
    either `setLocationBias()` or `setLocationRestriction()`, **never both**.
    Setting both in the same request results in an invalid request error. If
    both are omitted, the API falls back to IP biasing automatically.
2.  **Using Deprecated `Place.Field` Constants**: In Places SDK for Android
    4.0+, use the updated field constants:
    -   Use `Place.Field.DISPLAY_NAME` instead of `Place.Field.NAME`
    -   Use `Place.Field.FORMATTED_ADDRESS` instead of `Place.Field.ADDRESS`
    -   Use `Place.Field.LOCATION` instead of `Place.Field.LAT_LNG`
    -   Use `Place.Field.INTERNATIONAL_PHONE_NUMBER` instead of
        `Place.Field.PHONE_NUMBER`
    -   Use `Place.Field.USER_RATING_COUNT` instead of
        `Place.Field.USER_RATINGS_TOTAL`
    -   Use `Place.Field.ICON_MASK_URL` instead of `Place.Field.ICON_URL`
3.  **Invalid Viewport Bounds**: When defining a `RectangularBounds` viewport,
    `low` (southwest) and `high` (northeast) must both be populated, and
    `low.latitude` must not exceed `high.latitude`. Passing an empty viewport
    causes an error.
4.  **Filtering by Price Level `0` or Table B Types**: Price level `0` (free)
    cannot be passed into `setPriceLevels()`, and place types from Table B
    cannot be passed into `setIncludedType()`. Both are returned in responses
    only.

--------------------------------------------------------------------------------

## Reference Sample Links

For additional implementation context on initializing the Places SDK, handling
`PlacesClient` tasks, and formatting `Place` responses, see the official Google
Maps Platform Android samples:

-   [`PlacesDemoApplication.kt`](https://github.com/googlemaps-samples/android-places-demos/blob/HEAD/demo-kotlin/src/main/java/com/example/placesdemo/PlacesDemoApplication.kt?utm_campaign=gmp_git_agentskills_v1)
    — Initializing the SDK with `Places.initializeWithNewPlacesApiEnabled()`.
-   [`StringUtil.kt`](https://github.com/googlemaps-samples/android-places-demos/blob/HEAD/demo-kotlin/src/main/java/com/example/placesdemo/StringUtil.kt?utm_campaign=gmp_git_agentskills_v1)
    — Parsing `LatLngBounds` and reading `Place` properties (`displayName`,
    `id`, `formattedAddress`).
-   [`PlaceDetailsAndPhotosActivity.kt`](https://github.com/googlemaps-samples/android-places-demos/blob/HEAD/demo-kotlin/src/main/java/com/example/placesdemo/PlaceDetailsAndPhotosActivity.kt?utm_campaign=gmp_git_agentskills_v1)
    — Loading place photos (`PHOTO_METADATAS`) and icons (`ICON_MASK_URL`) from
    returned `Place` objects.
