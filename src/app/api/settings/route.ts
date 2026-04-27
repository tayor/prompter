import { NextResponse } from 'next/server'
import { getSettingsWithKanban, updateSettingsWithKanban } from '@/lib/services/settings-service'
import { updateSettingsSchema } from '@/lib/validators'

// GET /api/settings - Get current settings
export async function GET() {
    try {
        const settings = await getSettingsWithKanban()
        return NextResponse.json(settings)
    } catch (error) {
        console.error('Failed to fetch settings:', error)
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        )
    }
}

// PUT /api/settings - Update settings
export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const validatedData = updateSettingsSchema.parse(body)
        const settings = await updateSettingsWithKanban(validatedData)
        return NextResponse.json(settings)
    } catch (error) {
        console.error('Failed to update settings:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid settings data', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to update settings' },
            { status: 500 }
        )
    }
}
