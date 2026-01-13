# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wayfinder is the next-generation OneBusAway web application built with SvelteKit 5. It provides real-time transit information including bus stops, routes, arrivals/departures, and trip planning functionality. The application uses the OneBusAway REST API and supports both OpenStreetMap and Google Maps providers.

## Development Commands

```bash
npm install              # Install dependencies
cp .env.example .env     # Copy environment configuration (edit with your values)
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build

# Testing
npm run test             # Run tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Run tests with Vitest UI
npm run test:components  # Run only component tests (src/components)

# Code quality
npm run lint             # Check formatting and linting
npm run format           # Format code with Prettier
npm run prepush          # Full check: format, lint, and test
```

## Path Aliases

Configured in `svelte.config.js` for cleaner imports:

- `$components` → `./src/components`
- `$lib` → `./src/lib`
- `$stores` → `./src/stores`
- `$config` → `./src/config`
- `$images` → `./src/assets/images`
- `$src` → `./src`

## Architecture

### Svelte 5 Runes

This project uses Svelte 5 with runes (`$state`, `$derived`, `$effect`, `$props`) and snippets. All components use modern Svelte 5 syntax.

### Key Directories

- `src/components/` - Svelte components organized by feature
- `src/lib/` - Utilities and services
- `src/stores/` - Svelte stores for global state (mapStore, modalOpen, userLocationStore, surveyStore)
- `src/routes/` - SvelteKit routes (pages and API endpoints)
- `src/routes/api/` - Server-side API proxies to OBA and OTP servers
- `src/config/` - Configuration files
- `src/locales/` - i18n JSON files (en is fallback, others lazy-loaded)

### Page Routes

- `/` - Main map view with search and modals
- `/stops/[stopID]` - Standalone stop page
- `/stops/[stopID]/schedule` - Stop schedule page

### API Layer

Server-side API routes in `src/routes/api/` proxy requests to external services:

- `api/oba/*` - OneBusAway REST API (stops, routes, arrivals, trips, alerts)
- `api/otp/plan` - OpenTripPlanner for trip planning
- `api/regions` - Region configuration

The OBA SDK is configured in `src/lib/obaSdk.js` with `handleOBAResponse()` for standardized error handling.

### Map Provider Abstraction

Both map providers (`src/lib/Provider/`) implement the same interface:

- `GoogleMapProvider.svelte.js` - Google Maps implementation
- `OpenStreetMapProvider.svelte.js` - Leaflet/OSM implementation

Key methods: `initMap()`, `addMarker()`, `addVehicleMarker()`, `createPolyline()`, `panTo()`, `flyTo()`, `getBoundingBox()`

Configured via `PUBLIC_OBA_MAP_PROVIDER` env var ("osm" or "google").

### State Management

- Component state: Svelte 5 runes (`$state`, `$derived`)
- Global state: Svelte stores in `src/stores/`
- Modal state: Centralized via `modalOpen` store

### Internationalization

Configured in `src/lib/i18n.js`. English loaded synchronously as fallback; 24 other locales lazy-loaded. RTL support via `isRTL()` helper.

## Testing

- Framework: Vitest with jsdom environment
- Test files: `src/tests/` and `src/lib/__tests__/`
- Setup file: `vitest-setup.js` (mocks for env vars, i18n, SvelteKit stores, browser APIs)
- Coverage threshold: 70% for branches, functions, lines, statements

When writing tests, the setup file already mocks `$env/static/public`, `$env/static/private`, `svelte-i18n`, `$app/stores`, and common browser APIs (ResizeObserver, IntersectionObserver, geolocation, localStorage, matchMedia).

## Styling

- Tailwind CSS with Flowbite components
- FontAwesome icons via `@fortawesome/svelte-fontawesome`
- Brand colors configurable via `COLOR_*` env vars (processed at build time)
- Dark mode support via theme system

## Environment Variables

See `.env.example` for full list. Key variables:

- `PRIVATE_OBA_API_KEY` - OneBusAway API key
- `PUBLIC_OBA_SERVER_URL` - OBA server URL
- `PUBLIC_OBA_REGION_CENTER_LAT/LNG` - Region center coordinates
- `PUBLIC_OBA_MAP_PROVIDER` - "osm" or "google"
- `PUBLIC_OTP_SERVER_URL` - OpenTripPlanner server (optional, for trip planning)
- `PRIVATE_OBA_GEOCODER_PROVIDER` - Geocoding provider (currently "google" only)
