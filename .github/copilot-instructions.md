# Wayfinder AI Coding Instructions

## Project Overview
Wayfinder is the next-generation OneBusAway web app—a real-time transit information platform built with **SvelteKit 5** and the **runes API**. It provides stops, routes, arrivals/departures, trip planning, and service alerts.

## Critical Svelte 5 Patterns

### Component State
- Use `$state` for reactive local variables: `let count = $state(0);`
- Use `$derived` for computed values: `let doubled = $derived(count * 2);`
- Use `$props()` for component props: `let { title, onClick } = $props();`
- Use `$effect(() => { ... })` for side effects (replaces `onMount` for most cases)
- **Never** use `export let` syntax—this is Svelte 4 and will break in Svelte 5

### Example Component Pattern
```svelte
<script>
  let { stop, onSelect } = $props();  // Props
  let isExpanded = $state(false);     // Local state
  let stopLabel = $derived(stop.shortName || stop.longName); // Computed
  
  $effect(() => {
    // Side effects with proper cleanup
    return () => { /* cleanup */ };
  });
</script>
```

## Architecture & Data Flow

### API Layer (Server-Side)
- All OBA API calls go through `src/routes/api/oba/**/+server.js` endpoints
- Use the centralized OBA SDK: `import oba, { handleOBAResponse } from '$lib/obaSdk'`
- Standard pattern: `export async function GET({ params, url }) { ... }`
- Server-side caching via `src/lib/serverCache.js` for routes/agencies/bounds

### Client-Side Data Fetching
- Components fetch from internal API routes (e.g., `/api/oba/stop/${stopId}`)
- Use SvelteKit's `fetch` in `$effect` blocks
- Map provider abstraction in `src/lib/Provider/` (OpenStreetMap/Google Maps)

### Modal State Management
- Central modal state in `src/routes/+page.svelte` with Modal enum (`STOP`, `ROUTE`, `ALL_ROUTES`, `TRIP_PLANNER`)
- Use `pushState()` for URL updates without page reload: `pushState(\`/stops/${stop.id}\`)`
- Clear conflicting states before opening new modals (see `handleStopMarkerSelect` in `+page.svelte`)

### Map Provider Abstraction
- Two implementations: `OpenStreetMapProvider` and `GoogleMapProvider` in `src/lib/Provider/`
- Providers expose consistent interface: `addMarker()`, `flyTo()`, `clearAllPolylines()`, etc.
- Provider instance passed down to map components via `mapProvider` prop

## Path Aliases (Critical)
```javascript
$components  → './src/components'
$config      → './src/config'
$images      → './src/assets/images'
$lib         → './src/lib'
$src         → './src'
$stores      → './src/stores'
```
Always use these aliases instead of relative imports.

## Development Workflow

### Essential Commands
```bash
npm run dev            # Start dev server
npm run test           # Run Vitest tests
npm run test:coverage  # Coverage (70% threshold)
npm run lint           # ESLint + Prettier check
npm run format         # Auto-format with Prettier
npm run prepush        # Format + lint + test (pre-push hook)
```

### Environment Setup
1. Copy `.env.example` to `.env`
2. Required: `PRIVATE_OBA_API_KEY`, `PUBLIC_OBA_SERVER_URL`, region center lat/lng
3. Map provider: Set `PUBLIC_OBA_MAP_PROVIDER` to `"osm"` or `"google"`

### Testing Conventions
- Tests in `src/components/__tests__/` or `src/lib/__tests__/`
- Use `@testing-library/svelte` with `render()`, `screen`, `userEvent`
- Mock data in `src/tests/fixtures/obaData.js`
- Component tests should render with all required props

## Code Conventions

### Component Props & Naming
- Routes: Display as `shortName - longName` or `agencyName - longName` if no shortName
- Route colors: Apply as inline styles from route data (`#${route.color}`)
- Stop markers: Use route type icons (bus, light rail, ferry) based on highest-priority route type
- TypeScript JSDoc for prop documentation (no actual TypeScript files)

### i18n
- Use `svelte-i18n` for all user-facing text: `import { _ } from 'svelte-i18n'`
- Locale files in `src/locales/*.json`
- Keys use dot notation: `$_('stops.arrivals_and_departures')`

### Analytics
- Plausible integration in `src/lib/Analytics/PlausibleAnalytics.js`
- Track events via `analytics.trackEvent(name, props)`
- Distance-to-stop tracking via `analyticsDistanceToStop()`

### Styling
- Tailwind CSS with Flowbite components
- Dark mode support via Tailwind's `dark:` classes
- Color customization via env variables (`PUBLIC_APP_PRIMARY_COLOR`, etc.)
- FontAwesome icons via `svelte-fontawesome`

## Common Patterns to Follow

### Server Cache Pattern (hooks.server.js)
The `handle` hook preloads routes data on server start:
```javascript
export async function handle({ event, resolve }) {
  await preloadRoutesData();
  return resolve(event);
}
```

### Error Handling (API Routes)
```javascript
if (response.code !== 200) {
  throw error(500, `Unable to fetch ${entityName}.`);
}
return json(response);
```

### Map Marker Lifecycle
1. Check if marker exists in `markersMap` to prevent duplicates
2. Store marker reference for cleanup
3. Unmount Svelte components when markers removed: `unmount(component)`

### Route Type Priorities
Defined in `src/config/routeConfig.js`:
- Ferry > Light Rail > Commuter Rail > Bus > Unknown
- Use `prioritizedRouteTypeForDisplay()` for stop icon selection

## Gotchas & Known Issues

- **Leaflet CSS**: Dynamically loaded in `OpenStreetMapProvider`—don't import statically
- **Global objects**: `L` (Leaflet) and `google` declared as readonly globals in ESLint config
- **$state ESLint**: Add `$state: 'readonly'` to ESLint globals to avoid errors
- **Svelte mount/unmount**: Use `import { mount, unmount } from 'svelte'` for dynamic components in Leaflet/Google Maps popups
- **Route color format**: Colors in OBA API are hex without `#`, prepend when using in styles

## Key Files to Reference

- [src/routes/+page.svelte](src/routes/+page.svelte) - Main app structure, modal orchestration
- [src/lib/obaSdk.js](src/lib/obaSdk.js) - OBA SDK configuration and error handling
- [src/lib/Provider/OpenStreetMapProvider.svelte.js](src/lib/Provider/OpenStreetMapProvider.svelte.js) - Map provider implementation example
- [src/components/map/MapView.svelte](src/components/map/MapView.svelte) - Map initialization and stop loading
- [src/lib/serverCache.js](src/lib/serverCache.js) - Server-side caching pattern
- [CLAUDE.md](CLAUDE.md) - Extended project documentation
