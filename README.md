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

### Text and Images

- `PUBLIC_OBA_REGION_NAME` - string: (required) displayed in the header.
- `PUBLIC_OBA_LOGO_URL` - string: (required) The URL of your transit agency's logo.
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

### Maps

- `PUBLIC_OBA_GOOGLE_MAPS_API_KEY` - string: (optional) Your Google API key.
- `PUBLIC_OBA_MAP_PROVIDER` - string: Use "osm" for OpenStreetMap or "google" for Google Maps.

### Geocoding

- `PRIVATE_OBA_GEOCODER_API_KEY` - string: (optional) Your Geocoder service's API key. Ensure that the Geocoder and Places API permissions are enabled.
- `PRIVATE_OBA_GEOCODER_PROVIDER` - string: (required) Your Geocoder service. We currently only support the Google Places SDK (value: "google").

### Trip Planner

- `PUBLIC_OTP_SERVER_URL` - string: (optional) Your OpenTripPlanner 1.x-compatible trip planner server URL.

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
