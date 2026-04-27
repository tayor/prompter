import { NextRequest, NextResponse } from 'next/server'
import { discoverKanbanModels } from '@/lib/services/models-service'
import {
    discoverKanbanModelsQuerySchema,
    kanbanModelProviderParamsSchema,
} from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
    params: Promise<{ provider: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const parsedParams = kanbanModelProviderParamsSchema.safeParse(await params)
        if (!parsedParams.success) {
            return NextResponse.json(
                { error: 'Invalid provider', details: parsedParams.error.flatten() },
                { status: 400 }
            )
        }

        const { searchParams } = new URL(request.url)
        const parsedQuery = discoverKanbanModelsQuerySchema.safeParse({
            refresh: searchParams.get('refresh') ?? undefined,
        })

        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: 'Invalid query parameters', details: parsedQuery.error.flatten() },
                { status: 400 }
            )
        }

        const provider = parsedParams.data.provider
        const { refresh } = parsedQuery.data

        const payload = await discoverKanbanModels(provider, { refresh })
        return NextResponse.json(payload)
    } catch (error) {
        console.error('Failed to discover models:', error)
        return NextResponse.json(
            { error: 'Failed to discover models' },
            { status: 500 }
        )
    }
}
