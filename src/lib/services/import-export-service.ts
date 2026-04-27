import { z } from 'zod'
import prisma from '@/lib/prisma'
import { importDataSchema } from '@/lib/validators'

export type ImportDataInput = z.infer<typeof importDataSchema>

interface ImportEntityResult {
    created: number
    failed: number
    errors: Array<Record<string, unknown>>
}

export interface ImportResults {
    prompts: ImportEntityResult
    workflows: ImportEntityResult
    folders: ImportEntityResult
    tags: ImportEntityResult
}

export interface ExportOptions {
    includePrompts: boolean
    includeWorkflows: boolean
    includeFolders: boolean
    includeTags: boolean
}

export async function importPrompterData(data: ImportDataInput): Promise<{ success: boolean; results: ImportResults }> {
    const results: ImportResults = {
        prompts: { created: 0, failed: 0, errors: [] },
        workflows: { created: 0, failed: 0, errors: [] },
        folders: { created: 0, failed: 0, errors: [] },
        tags: { created: 0, failed: 0, errors: [] },
    }

    const folderMap = new Map<string, string>()
    const tagMap = new Map<string, string>()
    const promptMap = new Map<string, string>()

    await prisma.$transaction(async (tx) => {
        const folderParentLinks: Array<{ newId: string; oldParentId: string | null }> = []
        if (data.folders?.length) {
            for (const folder of data.folders) {
                try {
                    const created = await tx.folder.create({
                        data: {
                            name: folder.name,
                            icon: folder.icon ?? null,
                            color: folder.color ?? null,
                        },
                    })
                    folderMap.set(folder.id, created.id)
                    folderParentLinks.push({
                        newId: created.id,
                        oldParentId: folder.parentId ?? null,
                    })
                    results.folders.created++
                } catch (error) {
                    results.folders.failed++
                    results.folders.errors.push({
                        id: folder.id,
                        name: folder.name,
                        error: error instanceof Error ? error.message : String(error),
                    })
                }
            }

            for (const link of folderParentLinks) {
                if (!link.oldParentId) {
                    continue
                }

                const parentId = folderMap.get(link.oldParentId)
                if (!parentId) {
                    continue
                }

                try {
                    await tx.folder.update({
                        where: { id: link.newId },
                        data: { parentId },
                    })
                } catch (error) {
                    results.folders.failed++
                    results.folders.errors.push({
                        id: link.newId,
                        parentId,
                        error: error instanceof Error ? error.message : String(error),
                    })
                }
            }
        }

        if (data.tags?.length) {
            for (const tag of data.tags) {
                try {
                    let existing = await tx.tag.findUnique({
                        where: { name: tag.name },
                    })

                    if (!existing) {
                        existing = await tx.tag.create({
                            data: { name: tag.name, color: tag.color ?? null },
                        })
                        results.tags.created++
                    }

                    tagMap.set(tag.id, existing.id)
                } catch (error) {
                    results.tags.failed++
                    results.tags.errors.push({
                        id: tag.id,
                        name: tag.name,
                        error: error instanceof Error ? error.message : String(error),
                    })
                }
            }
        }

        if (data.prompts?.length) {
            for (const prompt of data.prompts) {
                try {
                    const folderId = prompt.folderId
                        ? folderMap.get(prompt.folderId) ?? null
                        : null

                    const variables =
                        prompt.variables === undefined || prompt.variables === null
                            ? null
                            : Array.isArray(prompt.variables)
                                ? JSON.stringify(prompt.variables)
                                : prompt.variables

                    const created = await tx.prompt.create({
                        data: {
                            title: prompt.title,
                            content: prompt.content,
                            description: prompt.description ?? null,
                            variables,
                            aiModel: prompt.aiModel ?? null,
                            category: prompt.category ?? 'user',
                            folderId,
                        },
                    })

                    if (prompt.id) {
                        promptMap.set(prompt.id, created.id)
                    }

                    if (prompt.tags?.length) {
                        const tagIds = prompt.tags
                            .map((tag) => tagMap.get(tag.id))
                            .filter((tagId): tagId is string => Boolean(tagId))

                        if (tagIds.length) {
                            await tx.tagsOnPrompts.createMany({
                                data: tagIds.map((tagId) => ({
                                    promptId: created.id,
                                    tagId,
                                })),
                            })
                        }
                    }

                    await tx.promptVersion.create({
                        data: {
                            promptId: created.id,
                            version: 1,
                            content: created.content,
                            variables: created.variables,
                            changeNote: 'Imported',
                        },
                    })

                    results.prompts.created++
                } catch (error) {
                    results.prompts.failed++
                    results.prompts.errors.push({
                        title: prompt.title,
                        error: error instanceof Error ? error.message : String(error),
                    })
                }
            }
        }

        if (data.workflows?.length) {
            for (const workflow of data.workflows) {
                let createdWorkflowId: string | null = null

                try {
                    const folderId = workflow.folderId
                        ? folderMap.get(workflow.folderId) ?? null
                        : null

                    const created = await tx.workflow.create({
                        data: {
                            name: workflow.name,
                            description: workflow.description ?? null,
                            icon: workflow.icon ?? null,
                            color: workflow.color ?? null,
                            inputSchema: workflow.inputSchema ?? null,
                            isTemplate: workflow.isTemplate ?? false,
                            folderId,
                        },
                    })
                    createdWorkflowId = created.id

                    if (workflow.tags?.length) {
                        const tagIds = workflow.tags
                            .map((tag) => tagMap.get(tag.id))
                            .filter((tagId): tagId is string => Boolean(tagId))

                        if (tagIds.length) {
                            await tx.tagsOnWorkflows.createMany({
                                data: tagIds.map((tagId) => ({
                                    workflowId: created.id,
                                    tagId,
                                })),
                            })
                        }
                    }

                    if (workflow.steps?.length) {
                        const stepIdMap = new Map<string, string>()
                        const pendingNext: Array<{
                            newId: string
                            oldNextSuccess?: string | null
                            oldNextFailure?: string | null
                        }> = []

                        const steps = [...workflow.steps].sort((left, right) => left.order - right.order)

                        for (const step of steps) {
                            const createdStep = await tx.workflowStep.create({
                                data: {
                                    workflowId: created.id,
                                    name: step.name,
                                    description: step.description ?? null,
                                    order: step.order,
                                    promptId: step.promptId
                                        ? promptMap.get(step.promptId) ?? null
                                        : null,
                                    inlineContent: step.inlineContent ?? null,
                                    inputMapping: step.inputMapping ?? null,
                                    outputVariable: step.outputVariable || `step${step.order}`,
                                    isOptional: step.isOptional ?? false,
                                    condition: step.condition ?? null,
                                    aiModelOverride: step.aiModelOverride ?? null,
                                    notes: step.notes ?? null,
                                    estimatedTokens: step.estimatedTokens ?? null,
                                    nextStepOnSuccess: null,
                                    nextStepOnFailure: null,
                                },
                            })

                            if (step.id) {
                                stepIdMap.set(step.id, createdStep.id)
                            }

                            pendingNext.push({
                                newId: createdStep.id,
                                oldNextSuccess: step.nextStepOnSuccess,
                                oldNextFailure: step.nextStepOnFailure,
                            })
                        }

                        for (const item of pendingNext) {
                            const nextStepOnSuccess = item.oldNextSuccess
                                ? stepIdMap.get(item.oldNextSuccess) ?? undefined
                                : undefined
                            const nextStepOnFailure = item.oldNextFailure
                                ? stepIdMap.get(item.oldNextFailure) ?? undefined
                                : undefined

                            if (nextStepOnSuccess || nextStepOnFailure) {
                                await tx.workflowStep.update({
                                    where: { id: item.newId },
                                    data: {
                                        ...(nextStepOnSuccess ? { nextStepOnSuccess } : {}),
                                        ...(nextStepOnFailure ? { nextStepOnFailure } : {}),
                                    },
                                })
                            }
                        }
                    }

                    results.workflows.created++
                } catch (error) {
                    if (createdWorkflowId) {
                        try {
                            await tx.workflow.delete({ where: { id: createdWorkflowId } })
                        } catch (cleanupError) {
                            console.error('Failed to rollback workflow import:', cleanupError)
                        }
                    }

                    results.workflows.failed++
                    results.workflows.errors.push({
                        name: workflow.name,
                        error: error instanceof Error ? error.message : String(error),
                    })
                }
            }
        }
    })

    const success =
        results.prompts.failed
        + results.workflows.failed
        + results.folders.failed
        + results.tags.failed
        === 0

    return {
        success,
        results,
    }
}

export async function buildPrompterExportData(options: ExportOptions): Promise<Record<string, unknown>> {
    const exportData: Record<string, unknown> = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
    }

    if (options.includeFolders) {
        exportData.folders = await prisma.folder.findMany({
            select: {
                id: true,
                name: true,
                icon: true,
                color: true,
                parentId: true,
            },
        })
    }

    if (options.includeTags) {
        exportData.tags = await prisma.tag.findMany({
            select: {
                id: true,
                name: true,
                color: true,
            },
        })
    }

    if (options.includePrompts) {
        const prompts = await prisma.prompt.findMany({
            where: { isArchived: false },
            select: {
                id: true,
                title: true,
                content: true,
                description: true,
                variables: true,
                aiModel: true,
                category: true,
                folderId: true,
                tags: {
                    select: {
                        tag: { select: { id: true, name: true } },
                    },
                },
            },
        })

        exportData.prompts = prompts.map((prompt) => ({
            ...prompt,
            tags: prompt.tags.map((tag) => tag.tag),
        }))
    }

    if (options.includeWorkflows) {
        const workflows = await prisma.workflow.findMany({
            where: { isArchived: false },
            select: {
                id: true,
                name: true,
                description: true,
                icon: true,
                color: true,
                inputSchema: true,
                isTemplate: true,
                folderId: true,
                steps: {
                    orderBy: { order: 'asc' },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        order: true,
                        promptId: true,
                        inlineContent: true,
                        inputMapping: true,
                        outputVariable: true,
                        isOptional: true,
                        condition: true,
                        aiModelOverride: true,
                        notes: true,
                        estimatedTokens: true,
                        nextStepOnSuccess: true,
                        nextStepOnFailure: true,
                    },
                },
                tags: {
                    select: {
                        tag: { select: { id: true, name: true } },
                    },
                },
            },
        })

        exportData.workflows = workflows.map((workflow) => ({
            ...workflow,
            tags: workflow.tags.map((tag) => tag.tag),
        }))
    }

    return exportData
}
