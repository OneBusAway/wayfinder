# Wayfinder

[![Coverage Status](https://coveralls.io/repos/github/OneBusAway/wayfinder/badge.svg)](https://coveralls.io/github/OneBusAway/wayfinder)

This is the next-generation OneBusAway web application, built on top of [SvelteKit](https://kit.svelte.dev). It is designed to replace the [onebusaway-enterprise-webapp](https://github.com/OneBusAway/onebusaway-application-modules) project. This project is under active development!

## Developing

```bash
npm install
cp .env.example .env
# edit .env with your editor of choice
npm run dev
```

## `.env` File Keys

See `.env.example` for an example of the required keys and values.

### Analytics

- `PUBLIC_ANALYTICS_DOMAIN` - string: (optional).
- `PUBLIC_ANALYTICS_ENABLED` - boolean: (optional).
- `PUBLIC_ANALYTICS_API_HOST` - string: (optional).

### Internationalization

- `PUBLIC_LANGUAGE_SWITCHER_ENABLED` - string: (optional) Set to `"false"` to hide the language switcher in the navigation bar. Defaults to `"true"`.
- `PUBLIC_LANGUAGE_SWITCHER_BUTTON_FORMAT` - string: (optional) Format for displaying language in the top menu button. Options: `"native"` (default), `"english"`, `"native-english"`, `"english-native"`, `"code"`.
- `PUBLIC_LANGUAGE_SWITCHER_MENU_FORMAT` - string: (optional) Format for displaying languages in the dropdown menu. Options: `"native-english"` (default), `"native"`, `"english"`, `"english-native"`, `"code"`.

### Text and Images

- `PUBLIC_OBA_REGION_NAME` - string: (required) displayed in the header.
- `PUBLIC_OBA_LOGO_URL` - string: (required) The URL of your transit agency's logo.
- `OBA_LOGO_URL_DARK` - string: (optional) The URL of your transit agency's logo for dark mode. Falls back to `PUBLIC_OBA_LOGO_URL` if not specified.
- `SHOW_REGION_NAME_IN_NAV_BAR` - boolean: (optional) Set to "false" to hide the region name text in the navigation bar. Defaults to true.
- `PRIVATE_MANIFEST_ICON_192_URL` - string: (optional) URL to the 192×192 Android manifest icon (used for Add to Home Screen). Defaults to `/android-chrome-192x192.png` if not specified.
- `PRIVATE_MANIFEST_ICON_512_URL` - string: (optional) URL to the 512×512 Android manifest icon (used for Add to Home Screen). Defaults to `/android-chrome-512x512.png` if not specified.
- `PUBLIC_APPLE_TOUCH_ICON_URL` - string: (optional) URL to the Apple touch icon used on iOS home screens. Defaults to `/apple-touch-icon.png` if not specified.
- `PUBLIC_FAVICON_URL` - string: (optional) URL to the browser tab favicon. Defaults to `/favicon.png` if not specified.
- `PUBLIC_NAV_BAR_LINKS` - JSON string: (required) A dictionary of the links displayed across the navigation bar.

### Colors

Customize the application's color scheme via environment variables:

- `COLOR_BRAND_PRIMARY` - string: (optional) Primary brand color for nav bar and buttons. Default: "#78aa36".
- `COLOR_BRAND_PRIMARY_FOREGROUND` - string: (optional) Text color on brand-colored surfaces. Default: "#ffffff".
- `COLOR_BRAND_ACCENT` - string: (optional) Accent color for links, selected states, focus rings. Default: "#486621".
- `COLOR_SURFACE` - string: (optional) Background color for panels and surfaces. Default: "#ffffff".
- `COLOR_SURFACE_FOREGROUND` - string: (optional) Text color on surfaces. Default: "#000000".

> **Note:** Color variables (`COLOR_*`) are processed at build time by Tailwind CSS. After changing any color values, you must rebuild the application (`npm run build`) for changes to take effect.

#### Generated Primary Palette

A full 10-shade color palette is automatically generated from `COLOR_BRAND_ACCENT` for use with Flowbite components:

| Shade         | Description                                  |
| ------------- | -------------------------------------------- |
| `primary-50`  | Very light (95% white)                       |
| `primary-100` | Light (90% white)                            |
| `primary-200` | Light (75% white)                            |
| `primary-300` | Light-medium (60% white)                     |
| `primary-400` | Slightly lighter than base (30% white)       |
| `primary-500` | **Base color** (equals `COLOR_BRAND_ACCENT`) |
| `primary-600` | Slightly darker (15% black)                  |
| `primary-700` | Medium-dark (30% black)                      |
| `primary-800` | Dark (45% black)                             |
| `primary-900` | Very dark (60% black)                        |

Use these in Tailwind classes: `bg-primary-500`, `text-primary-700`, `border-primary-300`, etc.

## Calendar Configuration

- `PUBLIC_CALENDAR_FIRST_DAY_OF_WEEK` - number: (optional) Sets the first day of the week for calendar components. Use 0 for Monday, 1 for Tuesday, 2 for Wednesday, 3 for Thursday, 4 for Friday, 5 for Saturday, 6 for Sunday. Defaults to 0 (Monday).

### OBA Server

- `PUBLIC_OBA_SERVER_URL` - string: (required) Your OBA API server's URL.
- `PUBLIC_OBA_REGION_CENTER_LAT` - float: (required) The region's center latitude.
- `PUBLIC_OBA_REGION_CENTER_LNG` - float: (required) The region's center longitude.
- `PRIVATE_OBA_API_KEY` - string: (required) Your OneBusAway REST API server key.
- `PRIVATE_OBACO_API_BASE_URL` - string: (optional) Your OneBusAway.co server base URL, including the path prefix `/api/v1.
- `PRIVATE_REGION_ID` - string: (required if OBACO_API_BASE_URL provided).
- `PRIVATE_OBACO_SHOW_TEST_ALERTS` - boolean: (optional) Show test alerts on the website. Don't set this value in production.
- `PRIVATE_OBA_AGENCY_FILTER` - string: (optional) Comma-separated agency IDs to restrict this instance to a subset of agencies. Leave empty to show all agencies (default). Affects search results, stop listings, arrivals, schedules, and alerts.

### Maps

- `PUBLIC_OBA_GOOGLE_MAPS_API_KEY` - string: (optional) Your Google API key.
- `PUBLIC_OBA_MAP_PROVIDER` - string: Use "osm" for OpenStreetMap, "google" for Google Maps, or "arcgis" for ArcGIS.
- `PUBLIC_ARCGIS_API_KEY` - string: (optional) Your ArcGIS API key. Recommended for ArcGIS hosted basemaps and required for secured ArcGIS services when using the "arcgis" map provider.
- `PUBLIC_ARCGIS_CUSTOM_BASEMAP_URL` - string: (optional) URL to a custom ArcGIS vector tile basemap.

### Geocoding

- `PRIVATE_OBA_GEOCODER_API_KEY` - string: (optional) Your Geocoder service's API key. Ensure that the Geocoder and Places API permissions are enabled.
- `PRIVATE_OBA_GEOCODER_PROVIDER` - string: (required) Your Geocoder service. We currently only support the Google Places SDK (value: "google").

### Trip Planner

- `PUBLIC_OTP_SERVER_URL` - string: (optional) Your OpenTripPlanner 1.x-compatible trip planner server URL.
- `PUBLIC_DISTANCE_UNIT` - string: (optional) Default distance unit for the trip planner. Use "metric" for kilometers/meters or "imperial" for miles/feet. If not set, auto-detects from the user's browser locale (US browsers get imperial, others get metric). Users can override this in Trip Options.

## URL Parameters

You can link directly to a specific location on the map using URL query parameters:

| Parameter | Description                         | Example     |
| --------- | ----------------------------------- | ----------- |
| `lat`     | Latitude of the initial map center  | `47.6062`   |
| `lng`     | Longitude of the initial map center | `-122.3321` |

**Example URL:**

```
https://your-wayfinder-instance.com/?lat=47.6062&lng=-122.3321
```

**Validation rules:**

- Both `lat` and `lng` must be provided together
- Latitude must be between -90 and 90
- Longitude must be between -180 and 180
- Coordinates must be within 200km of the configured region center (`PUBLIC_OBA_REGION_CENTER_LAT`/`PUBLIC_OBA_REGION_CENTER_LNG`)

When valid coordinates are provided, the map will center on that location and place a location marker there. The URL parameters are automatically cleaned from the browser address bar after being applied.

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
