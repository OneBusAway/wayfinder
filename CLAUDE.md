# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wayfinder is the next-generation OneBusAway web application built with SvelteKit 5. It provides real-time transit information including bus stops, routes, arrivals/departures, and trip planning functionality. The application uses the OneBusAway REST API and supports both OpenStreetMap and Google Maps providers.

## Development Commands

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Pre-push checks (format, lint, test)
npm run prepush
```

## Architecture

### Svelte 5 Usage

This project uses Svelte 5 with the new runes API (`$state`, `$derived`, `$effect`, `$props`) and snippets system. Components use the modern Svelte 5 syntax throughout.

### Key Directories

- `src/components/` - All Svelte components organized by feature
- `src/lib/` - Reusable utilities and services
- `src/stores/` - Svelte stores for global state management
- `src/routes/` - SvelteKit routes (pages and API endpoints)
- `src/config/` - Configuration files
- `src/locales/` - Internationalization files

### Component Organization

- `components/navigation/` - Header, modals, menus
- `components/map/` - Map-related components (MapView, markers, popups)
- `components/stops/` - Stop information and scheduling
- `components/routes/` - Route information and modals
- `components/search/` - Search functionality
- `components/trip-planner/` - Trip planning interface
- `components/surveys/` - User survey system
- `components/service-alerts/` - Alert notifications

### State Management

- Uses Svelte 5 runes (`$state`, `$derived`) for local component state
- Svelte stores for global state (map loading, modal state, user location, surveys)
- Modal state managed through a centralized modal system

### API Integration

- OneBusAway SDK integration via `src/lib/obaSdk.js`
- API routes in `src/routes/api/` proxy requests to OBA servers
- OpenTripPlanner integration for trip planning
- Google Maps/Places API integration for geocoding

### Map Providers

- Supports both OpenStreetMap (via Leaflet) and Google Maps
- Map provider abstraction in `src/lib/Provider/`
- Configurable via `PUBLIC_OBA_MAP_PROVIDER` environment variable

### Key Features

- Real-time arrivals and departures
- Interactive maps with stop and vehicle markers
- Route visualization with polylines
- Trip planning with multiple itineraries
- Multi-language support (i18n)
- Responsive design with mobile menu
- Analytics integration (Plausible)
- User surveys and feedback collection
- Service alerts and notifications

## Environment Configuration

Required environment variables (see `.env.example`):

- `PRIVATE_OBA_API_KEY` - OneBusAway API key
- `PUBLIC_OBA_SERVER_URL` - OBA server URL
- `PUBLIC_OBA_REGION_*` - Region configuration
- `PUBLIC_OBA_MAP_PROVIDER` - Map provider ("osm" or "google")

## Testing

- Tests use Vitest with jsdom environment
- Test files located in `src/tests/`
- Coverage reporting available via `npm run test:coverage`
- Tests cover utilities, formatters, and SDK integration

## Styling

- Uses Tailwind CSS for styling
- Flowbite components for UI elements
- FontAwesome icons via Svelte FontAwesome
- CSS custom properties for theming
- Dark mode support

## Build Configuration

- Uses SvelteKit with Node.js adapter
- Vite for bundling and development
- Path aliases configured for imports (`$components`, `$lib`, etc.)
- PostCSS for CSS processing
- Prettier and ESLint for code formatting and linting

## Key Libraries

- `svelte` (v5) - UI framework with runes
- `@sveltejs/kit` - Full-stack framework
- `onebusaway-sdk` - OneBusAway API client
- `leaflet` - Map rendering (OpenStreetMap)
- `@googlemaps/js-api-loader` - Google Maps integration
- `svelte-i18n` - Internationalization
- `flowbite-svelte` - UI components
- `tailwindcss` - CSS framework

## Working with Components

When creating new components:

- Use Svelte 5 runes syntax (`$state`, `$props`, `$derived`)
- Follow the existing component structure and naming conventions
- Use TypeScript JSDoc comments for prop types
- Implement proper cleanup in `$effect` when needed
- Use snippets for reusable markup patterns
- Follow the established CSS classes and Tailwind patterns

## Common Patterns

- Modal management through centralized state
- Event handling with custom events for cross-component communication
- Map provider abstraction for supporting multiple mapping services
- API error handling with standardized error responses
- Internationalization using `svelte-i18n` with JSON locale files
- Analytics tracking for user interactions
