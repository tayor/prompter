import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/prompts/[id]/resolve - Resolve variables in prompt
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { variables } = body as { variables?: Record<string, string> }

        // Get prompt
        const prompt = await prisma.prompt.findUnique({
            where: { id },
        })

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        let resolvedContent = prompt.content

        // Replace all {{variable}} patterns with provided values
        if (variables) {
            // Match {{variable}} patterns
            resolvedContent = resolvedContent.replace(
                /\{\{([^}]+)\}\}/g,
                (match, varName) => {
                    const trimmedName = varName.trim()
                    // Check for dot notation like input.topic or step1.output
                    const parts = trimmedName.split('.')
                    if (parts.length > 1) {
                        // Try to find the value using the full path
                        if (variables[trimmedName] !== undefined) {
                            return variables[trimmedName]
                        }
                        // Try just the last part
                        const lastPart = parts[parts.length - 1]
                        if (variables[lastPart] !== undefined) {
                            return variables[lastPart]
                        }
                    }
                    // Direct variable lookup
                    if (variables[trimmedName] !== undefined) {
                        return variables[trimmedName]
                    }
                    // Return original if not found
                    return match
                }
            )
        }

        // Extract variables that weren't resolved
        const unresolvedVars: string[] = []
        resolvedContent.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
            unresolvedVars.push(varName.trim())
            return match
        })

        return NextResponse.json({
            original: prompt.content,
            resolved: resolvedContent,
            provided: variables || {},
            unresolved: unresolvedVars,
        })
    } catch (error) {
        console.error('Failed to resolve prompt:', error)
        return NextResponse.json(
            { error: 'Failed to resolve prompt' },
            { status: 500 }
        )
    }
}
