import { NextRequest, NextResponse } from 'next/server'
import type { SearchType } from '@/lib/services/search-service'
import { parseSearchParams, searchPromptsAndWorkflows } from '@/lib/services/search-service'

// GET /api/search - Global search across prompts and workflows
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const { query } = parseSearchParams(searchParams)
        const type = (searchParams.get('type') || 'all') as SearchType
        const result = await searchPromptsAndWorkflows(query, type)

        return NextResponse.json(result)
    } catch (error) {
        console.error('Search failed:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid search parameters', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Search failed' },
            { status: 500 }
        )
    }
}
