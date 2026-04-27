import { NextRequest, NextResponse } from 'next/server'
import { restorePromptVersion } from '@/lib/services/prompts-service'

interface RouteParams {
    params: Promise<{ id: string; versionId: string }>
}

// POST /api/prompts/[id]/restore/[versionId] - Restore a specific version
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, versionId } = await params
        const restoredPrompt = await restorePromptVersion(id, versionId)
        if (!restoredPrompt) {
            return NextResponse.json(
                { error: 'Version not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(restoredPrompt)
    } catch (error) {
        console.error('Failed to restore prompt version:', error)
        return NextResponse.json(
            { error: 'Failed to restore prompt version' },
            { status: 500 }
        )
    }
}
