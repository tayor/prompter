import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/workflows/[id]/export - Export workflow as JSON or YAML
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const format = searchParams.get('format') || 'json'

        // Get workflow with all related data
        const workflow = await prisma.workflow.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                    include: {
                        prompt: {
                            select: {
                                title: true,
                                content: true,
                                variables: true,
                            },
                        },
                    },
                },
                tags: { include: { tag: true } },
                folder: true,
            },
        })

        if (!workflow) {
            return NextResponse.json(
                { error: 'Workflow not found' },
                { status: 404 }
            )
        }

        // Build export data
        const exportData = {
            name: workflow.name,
            description: workflow.description,
            icon: workflow.icon,
            color: workflow.color,
            inputSchema: parseStoredJsonField(workflow.inputSchema),
            tags: workflow.tags.map(t => t.tag.name),
            folder: workflow.folder?.name || null,
            steps: workflow.steps.map(step => ({
                name: step.name,
                description: step.description,
                order: step.order,
                outputVariable: step.outputVariable,
                isOptional: step.isOptional,
                aiModel: step.aiModelOverride,
                notes: step.notes,
                // Include either prompt reference or inline content
                ...(step.prompt
                    ? {
                        promptTitle: step.prompt.title,
                        promptContent: step.prompt.content,
                    }
                    : {
                        inlineContent: step.inlineContent,
                    }),
                inputMapping: parseStoredJsonField(step.inputMapping),
                condition: parseStoredJsonField(step.condition),
            })),
            metadata: {
                exportedAt: new Date().toISOString(),
                version: '1.0',
            },
        }

        if (format === 'yaml') {
            // Simple YAML conversion for workflow
            const yamlContent = convertToYaml(exportData)
            return new NextResponse(yamlContent, {
                headers: {
                    'Content-Type': 'text/yaml',
                    'Content-Disposition': `attachment; filename="${workflow.name.replace(/[^a-z0-9]/gi, '_')}.yaml"`,
                },
            })
        }

        // Default to JSON
        return new NextResponse(JSON.stringify(exportData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${workflow.name.replace(/[^a-z0-9]/gi, '_')}.json"`,
            },
        })
    } catch (error) {
        console.error('Failed to export workflow:', error)
        return NextResponse.json(
            { error: 'Failed to export workflow' },
            { status: 500 }
        )
    }
}

function parseStoredJsonField(rawValue: string | null): unknown {
    if (!rawValue) {
        return null
    }

    try {
        return JSON.parse(rawValue)
    } catch {
        return null
    }
}

// Simple YAML converter for workflow export
function convertToYaml(obj: unknown, indent = 0): string {
    const spaces = '  '.repeat(indent)

    if (obj === null || obj === undefined) {
        return 'null'
    }

    if (typeof obj === 'string') {
        // Multi-line strings use literal block scalar
        if (obj.includes('\n')) {
            const lines = obj.split('\n').map(line => `${spaces}  ${line}`).join('\n')
            return `|\n${lines}`
        }
        // Strings that need quoting
        if (obj.match(/[:#\[\]{}|>!&*?'",@`]/)) {
            return `"${obj.replace(/"/g, '\\"')}"`
        }
        return obj
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj)
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]'
        return obj.map(item => {
            if (typeof item === 'object' && item !== null) {
                const content = convertToYaml(item, indent + 1)
                return `\n${spaces}- ${content.trim().replace(/\n/g, `\n${spaces}  `)}`
            }
            return `\n${spaces}- ${convertToYaml(item, indent)}`
        }).join('')
    }

    if (typeof obj === 'object') {
        const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
        if (entries.length === 0) return '{}'
        return entries.map(([key, value]) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                return `${key}:\n${spaces}  ${convertToYaml(value, indent + 1).trim().replace(/\n/g, `\n${spaces}  `)}`
            }
            return `${key}: ${convertToYaml(value, indent)}`
        }).join(`\n${spaces}`)
    }

    return String(obj)
}
