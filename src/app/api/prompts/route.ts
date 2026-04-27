import { NextRequest, NextResponse } from 'next/server'
import { createPromptWithVersion, listPrompts, parsePromptListQuery } from '@/lib/services/prompts-service'
import { createPromptSchema } from '@/lib/validators'

// GET /api/prompts - List all prompts with filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = parsePromptListQuery(searchParams)
        const result = await listPrompts(query)

        return NextResponse.json(result)
    } catch (error) {
        console.error('Failed to fetch prompts:', error)
        return NextResponse.json(
            { error: 'Failed to fetch prompts' },
            { status: 500 }
        )
    }
}

// POST /api/prompts - Create new prompt
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const data = createPromptSchema.parse(body)
        const prompt = await createPromptWithVersion(data)

        return NextResponse.json(prompt, { status: 201 })
    } catch (error) {
        console.error('Failed to create prompt:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid prompt data', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to create prompt' },
            { status: 500 }
        )
    }
}
