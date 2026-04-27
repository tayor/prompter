import { createReadStream, promises as fsPromises } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { NextRequest, NextResponse } from 'next/server'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { resolveExecutionLogFilePath } from '@/lib/kanban/log-storage'
import prisma from '@/lib/prisma'
import { kanbanExecutionParamsSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/executions/[id]/log - Stream or download execution log
export async function GET(request: NextRequest, { params }: RouteParams) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const { id } = kanbanExecutionParamsSchema.parse(await params)
        const download = new URL(request.url).searchParams.get('download') === 'true'

        const execution = await prisma.kanbanExecution.findUnique({
            where: { id },
            select: {
                id: true,
                logFile: true,
            },
        })

        if (!execution) {
            return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
        }

        if (!execution.logFile) {
            return NextResponse.json({ error: 'Execution log is unavailable' }, { status: 404 })
        }

        const absolutePath = resolveExecutionLogFilePath(execution.logFile)
        const stats = await fsPromises.stat(absolutePath)

        if (!stats.isFile()) {
            return NextResponse.json({ error: 'Execution log is unavailable' }, { status: 404 })
        }

        const fileStream = createReadStream(absolutePath)
        const webStream = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>

        return new NextResponse(webStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Length': stats.size.toString(),
                'Cache-Control': 'no-store',
                ...(download ? { 'Content-Disposition': `attachment; filename="${path.basename(absolutePath)}"` } : {}),
            },
        })
    } catch (error) {
        console.error('Failed to stream execution log:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid execution id', details: error },
                { status: 400 },
            )
        }
        if (error instanceof Error && error.message.includes('Unsafe log file path')) {
            return NextResponse.json({ error: 'Unsafe log file path' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Failed to fetch execution log' }, { status: 500 })
    }
}
