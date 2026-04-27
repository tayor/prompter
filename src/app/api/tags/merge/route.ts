import { NextRequest, NextResponse } from 'next/server'
import { mergeTags } from '@/lib/services/tags-service'
import { mergeTagsSchema } from '@/lib/validators'

// POST /api/tags/merge - Merge multiple tags into one
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { sourceTagIds, targetTagId } = mergeTagsSchema.parse(body)
        const result = await mergeTags(sourceTagIds, targetTagId)

        if (result.status === 'target_not_found') {
            return NextResponse.json(
                { error: 'Target tag not found' },
                { status: 404 }
            )
        }

        if (result.status === 'source_not_found') {
            return NextResponse.json(
                { error: 'Some source tags not found' },
                { status: 404 }
            )
        }

        if (result.status === 'no_source') {
            return NextResponse.json(
                { error: 'No source tags to merge' },
                { status: 400 }
            )
        }

        return NextResponse.json({
            success: true,
            mergedTag: result.mergedTag,
            mergedCount: result.mergedCount,
            newAssociations: result.newAssociations,
        })
    } catch (error) {
        console.error('Failed to merge tags:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid merge data', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to merge tags' },
            { status: 500 }
        )
    }
}
