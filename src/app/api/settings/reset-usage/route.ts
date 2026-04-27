import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// POST /api/settings/reset-usage - Reset all prompt usage counts to 0
export async function POST() {
    try {
        const result = await prisma.prompt.updateMany({
            data: { usageCount: 0 },
        })

        return NextResponse.json({
            success: true,
            count: result.count,
            message: `Reset usage counts for ${result.count} prompts`
        })
    } catch (error) {
        console.error('Failed to reset usage counts:', error)
        return NextResponse.json(
            { error: 'Failed to reset usage counts' },
            { status: 500 }
        )
    }
}
