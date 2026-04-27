# AGENTS.md - Prompter

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

Prompter is a full-stack Next.js 16+ application for managing AI prompts and workflows.
- **Framework**: Next.js App Router with React 19
- **Language**: TypeScript (strict mode)
- **Database**: SQLite with Prisma ORM v7 (libSQL adapter)
- **UI**: Tailwind CSS 4 + shadcn/ui components + Radix primitives
- **State**: Zustand for global state, React hooks for local state
- **Validation**: Zod schemas

## Build, Lint, and Test Commands

```bash
npm run dev              # Start dev server
npm run build            # Build (runs prisma generate first)
npm run start            # Start production server
npm run lint             # Run ESLint
npm run db:init          # Rebuild from the canonical seed bundle
npm run db:seed          # Rebuild from the canonical seed bundle
npm run db:reset         # Force-reset and rebuild from the canonical seed bundle
npm run db:studio        # Open Prisma Studio GUI
```

**Tests are configured.** `npm test` runs the Node test runner with tsx after Prisma client generation.

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── api/              # REST API routes (route.ts files)
│   └── [pages]/          # Page routes (prompts, workflows, etc.)
├── components/
│   ├── layout/           # Layout components (Header, Sidebar)
│   ├── shared/           # Reusable business components
│   ├── providers/        # Context providers
│   └── ui/               # shadcn/ui primitives (lowercase files)
├── hooks/                # Custom React hooks (useDebounce, etc.)
├── lib/                  # Utilities (prisma, validators, utils)
└── stores/               # Zustand stores
```

## Code Style Guidelines

### Imports

- Use single quotes for imports
- Use the `@/` path alias for all internal imports (maps to `./src/*`)
- Group imports: React/Next.js core → external libraries → internal `@/` imports
- No relative imports like `../../` - always use `@/`

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import prisma from '@/lib/prisma'
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables, functions | camelCase | `searchQuery`, `fetchPrompts` |
| React components | PascalCase | `TagBadge`, `FolderTree` |
| Interfaces/Types | PascalCase | `ShortcutConfig`, `PromptTemplate` |
| Constants | UPPER_SNAKE_CASE | `ITEMS_PER_PAGE`, `VARIABLE_PATTERN` |
| Hook files | camelCase with `use` prefix | `useDebounce.ts` |
| UI component files | lowercase | `button.tsx`, `dialog.tsx` |
| Other component files | PascalCase | `Header.tsx`, `TagBadge.tsx` |

### TypeScript Types

- Use `interface` for object shapes and props
- Use `type` aliases for Zod schema inference: `type X = z.infer<typeof xSchema>`
- TypeScript strict mode is enabled

### Functions and Components

- Use regular `function` declarations for React components and exported functions
- Use arrow functions for callbacks, inline handlers, and array methods
- Always use `async/await` (never raw `.then()` chains)

### Error Handling

**API Routes**: try/catch with structured JSON responses
```typescript
export async function GET(request: NextRequest) {
    try {
        const data = await prisma.prompt.findMany()
        return NextResponse.json({ prompts: data })
    } catch (error) {
        console.error('Failed to fetch prompts:', error)
        return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
    }
}
```

**Client Components**: try/catch with toast notifications and `finally` for loading state cleanup.

### React Patterns

- Use `'use client'` directive at the top of client components
- Use `cn()` utility from `@/lib/utils` for conditional Tailwind classes
- Prefer named exports (default exports only for Next.js pages)
- Use Zustand for global state, `useState` for local state

### API Routes

- Parse and validate with Zod schemas from `@/lib/validators`
- Use Prisma from `@/lib/prisma` for database operations
- Return `NextResponse.json()` responses
- Many Prisma fields store JSON as strings - parse/stringify when reading/writing
- Prompt content changes should create a new `PromptVersion` record
- Workflow steps use an integer `order` field for sequencing

### Authentication

Uses JWT stored in `auth-token` cookie (not NextAuth). See `src/app/api/auth/*` routes.

## Key Files

- `prisma/schema.prisma` - Database schema (13 models)
- `src/lib/validators.ts` - All Zod validation schemas
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/utils.ts` - Utility functions including `cn()`
- `src/lib/variable-resolver.ts` - Template variable substitution

## Comments and Documentation

- Use JSDoc for exported utility functions
- Use section dividers `// ============` in large files
- Use inline comments for non-obvious logic
- Use `{/* Comment */}` in JSX for section labels

```typescript
/**
 * Extract all variable names from content
 * @param content - The prompt content with {{variables}}
 * @returns Array of unique variable names
 */
export function extractVariables(content: string): string[] { ... }
```

## Configuration

- **ESLint**: Flat config with `eslint-config-next/core-web-vitals` and TypeScript rules
- **TypeScript**: Strict mode, ES2017 target, `@/*` path alias
- **Tailwind**: v4 with `@tailwindcss/postcss` plugin
- **shadcn/ui**: New York style, configured in `components.json`
