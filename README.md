# Wayfinder

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

- `PUBLIC_OBA_REGION_NAME` - string: displayed in the header.
- `PUBLIC_OBA_LOGO_URL` - string: The URL of your transit agency's logo.
- `PUBLIC_NAV_BAR_LINKS` - JSON string: A dictionary of the links displayed across the navigation bar.

### OBA Server

- `PUBLIC_OBA_SERVER_URL` - string: Your OBA API server's URL.
- `PUBLIC_OBA_REGION_CENTER_LAT` - float: The region's center latitude.
- `PUBLIC_OBA_REGION_CENTER_LNG` - float: The region's center longitude.
- `PRIVATE_OBA_API_KEY` - string: Your OneBusAway REST API server key.
- `PRIVATE_OBACO_API_BASE_URL` - string: (optional) Your OneBusAway.co server base URL, including the path prefix `/api/v1/regions/<YOUR REGION ID>`.
- `PRIVATE_OBACO_SHOW_TEST_ALERTS` - boolean: (optional) Show test alerts on the website. Don't set this value in production.

### Maps

- `PUBLIC_OBA_GOOGLE_MAPS_API_KEY` - string: Your Google API key. Leave this blank if you don't have one.
- `PUBLIC_OBA_MAP_PROVIDER` - string: Use "osm" for OpenStreetMap or "google" for Google Maps.

### Geocoding

- `PRIVATE_OBA_GEOCODER_API_KEY` - string: Your Geocoder service's API key. Ensure that the Geocoder and Places API permissions are enabled. Leave this blank if you don't have one.
- `PRIVATE_OBA_GEOCODER_PROVIDER` - string: Your Geocoder service. We currently only support the Google Places SDK (value: "google").

### Trip Planner

- `PUBLIC_OTP_SERVER_URL` - string: Your OpenTripPlanner 1.x-compatible trip planner server URL. Leave this blank if you don't have one.

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
