import { NextResponse } from 'next/server'
import { importPrompterData } from '@/lib/services/import-export-service'
import { importDataSchema } from '@/lib/validators'

// POST /api/import - Import prompts/workflows from JSON
export async function POST(request: Request) {
    try {
        const raw = await request.json()
        const parsed = importDataSchema.safeParse(raw)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid import payload', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const result = await importPrompterData(parsed.data)
        return NextResponse.json(result)
    } catch (error) {
        console.error('Import failed:', error)
        return NextResponse.json({ error: 'Import failed' }, { status: 500 })
    }
}
