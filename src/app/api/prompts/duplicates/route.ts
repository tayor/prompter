import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Simple string similarity using Dice coefficient
function similarity(s1: string, s2: string): number {
    const getBigrams = (str: string): Set<string> => {
        const bigrams = new Set<string>()
        const normalized = str.toLowerCase().replace(/\s+/g, ' ').trim()
        for (let i = 0; i < normalized.length - 1; i++) {
            bigrams.add(normalized.substring(i, i + 2))
        }
        return bigrams
    }

    const bigrams1 = getBigrams(s1)
    const bigrams2 = getBigrams(s2)

    if (bigrams1.size === 0 || bigrams2.size === 0) return 0

    let intersection = 0
    bigrams1.forEach((bigram) => {
        if (bigrams2.has(bigram)) intersection++
    })

    return (2 * intersection) / (bigrams1.size + bigrams2.size)
}

interface DuplicateGroup {
    prompts: Array<{
        id: string
        title: string
        content?: string
        updatedAt: Date
        usageCount: number
    }>
    similarity: number
}

// GET /api/prompts/duplicates - Find potential duplicate prompts
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const threshold = parseFloat(searchParams.get('threshold') || '0.7')
        const checkContent = searchParams.get('checkContent') !== 'false'
        const requestedLimit = parseInt(searchParams.get('limit') || '200', 10)

        if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
            return NextResponse.json(
                { error: 'threshold must be a number between 0 and 1' },
                { status: 400 }
            )
        }

        const MAX_LIMIT = 500
        const limit =
            Number.isNaN(requestedLimit) || requestedLimit < 1
                ? 200
                : Math.min(requestedLimit, MAX_LIMIT)

        const prompts = await prisma.prompt.findMany({
            where: { isArchived: false },
            select: {
                id: true,
                title: true,
                content: checkContent,
                updatedAt: true,
                usageCount: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: limit,
        })

        const duplicateGroups: DuplicateGroup[] = []
        const processed = new Set<string>()

        for (let i = 0; i < prompts.length; i++) {
            if (processed.has(prompts[i].id)) continue

            const group: DuplicateGroup = {
                prompts: [prompts[i]],
                similarity: 1,
            }

            for (let j = i + 1; j < prompts.length; j++) {
                if (processed.has(prompts[j].id)) continue

                // Check title similarity
                const titleSim = similarity(prompts[i].title, prompts[j].title)

                // Check content similarity if enabled
                let contentSim = 0
                if (checkContent && prompts[i].content && prompts[j].content) {
                    contentSim = similarity(prompts[i].content, prompts[j].content)
                }

                // Use max of title and content similarity
                const maxSim = Math.max(titleSim, contentSim)

                if (maxSim >= threshold) {
                    group.prompts.push(prompts[j])
                    group.similarity = Math.min(group.similarity, maxSim)
                    processed.add(prompts[j].id)
                }
            }

            if (group.prompts.length > 1) {
                duplicateGroups.push(group)
                processed.add(prompts[i].id)
            }
        }

        // Sort groups by number of duplicates (descending)
        duplicateGroups.sort((a, b) => b.prompts.length - a.prompts.length)

        return NextResponse.json({
            groups: duplicateGroups,
            totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.prompts.length - 1, 0),
            totalChecked: prompts.length,
            limitApplied: limit,
        })
    } catch (error) {
        console.error('Duplicate detection failed:', error)
        return NextResponse.json({ error: 'Failed to detect duplicates' }, { status: 500 })
    }
}
