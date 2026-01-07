# Envisioned Video Repurpose Portal

## Overview

This is a video repurposing web application that allows users to upload MP4 files or paste YouTube links to automatically generate clips. The app sends form data to an n8n webhook for automation processing. Users can configure clip size, duration, and quantity before submission.

The application is a full-stack TypeScript project with a React frontend and Express backend, designed as a minimal productivity tool focused on efficiency and clarity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Build Tool**: Vite with hot module replacement
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for TypeScript execution
- **API Pattern**: RESTful endpoints prefixed with `/api`
- **Build**: esbuild for production bundling with selective dependency bundling

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains database models
- **Migrations**: Generated in `./migrations` directory via `drizzle-kit push`
- **Development Storage**: MemStorage class provides in-memory fallback for user operations

### Design System
- **Typography**: Inter font via Google Fonts CDN
- **Color Palette**: Black primary (#000000), warm accent (#e5d6c7), white background
- **Layout**: Centered container (max-w-2xl), consistent spacing using Tailwind units
- **Components**: Card-based UI with rounded corners (rounded-xl), subtle shadows

### Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and query client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   └── storage.ts    # Data storage interface
├── shared/           # Shared code between frontend/backend
│   └── schema.ts     # Drizzle database schema
└── migrations/       # Database migrations
```

## External Dependencies

### Third-Party Services
- **n8n Webhook**: Primary integration point for video processing automation
  - Endpoint: `https://envisionedos.app.n8n.cloud/webhook/[webhook-path]`
  - Receives form data with video info, clip settings

### Database
- **PostgreSQL**: Required for production (configured via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Database toolkit for type-safe queries and migrations

### UI Component Library
- **shadcn/ui**: Pre-built accessible React components built on Radix UI primitives
- **Radix UI**: Low-level UI primitives for accessibility

### Key npm Packages
- `@tanstack/react-query`: Server state management
- `drizzle-orm` / `drizzle-zod`: Database ORM and validation
- `express`: HTTP server framework
- `wouter`: Client-side routing
- `zod`: Runtime validation
- `lucide-react`: Icon library