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

### Visuals

- `PUBLIC_OBA_REGION_NAME` - string: (required) displayed in the header.
- `PUBLIC_OBA_LOGO_URL` - string: (required) The URL of your transit agency's logo.
- `PUBLIC_NAV_BAR_LINKS` - JSON string: (required) A dictionary of the links displayed across the navigation bar.
- `PUBLIC_APP_PRIMARY_COLOR` - string: (required) The hex color code for the application's primary brand color. Must be wrapped in quotes (e.g., "#214666").
- `PUBLIC_APP_SECONDARY_COLOR` - string: (required) The hex color code for the application's secondary brand color. Must be wrapped in quotes (e.g., "#486621").
- `PUBLIC_ANALYTICS_DOMAIN` - string: (optional).
- `PUBLIC_ANALYTICS_ENABLED` - boolean: (optional).
- `PUBLIC_ANALYTICS_API_HOST` - string: (optional).

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
