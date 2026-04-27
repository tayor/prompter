import { NextRequest, NextResponse } from 'next/server'
import { trackAnalyticsAction } from '@/lib/services/analytics-service'
import { findPromptById, incrementPromptUsage } from '@/lib/services/prompts-service'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/prompts/[id]/copy - Copy prompt to clipboard and increment usage
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const prompt = await findPromptById(id)
        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        const updated = await incrementPromptUsage(id)
        await trackAnalyticsAction('prompt', id, 'copy')

        return NextResponse.json({
            content: updated.content,
            usageCount: updated.usageCount,
        })
    } catch (error) {
        console.error('Failed to copy prompt:', error)
        return NextResponse.json(
            { error: 'Failed to copy prompt' },
            { status: 500 }
        )
    }
}
