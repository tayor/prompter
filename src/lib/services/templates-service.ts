import prisma from '@/lib/prisma'

export async function listWorkflowTemplates() {
    return prisma.workflow.findMany({
        where: { isTemplate: true, isArchived: false },
        orderBy: { runCount: 'desc' },
        include: {
            folder: true,
            tags: { include: { tag: true } },
            _count: { select: { steps: true } },
        },
    })
}

export async function createWorkflowFromTemplate(templateId: string, name?: string) {
    const template = await prisma.workflow.findUnique({
        where: { id: templateId },
        include: {
            steps: { orderBy: { order: 'asc' } },
            tags: true,
        },
    })

    if (!template) {
        return null
    }

    const workflow = await prisma.workflow.create({
        data: {
            name: name || `${template.name} (Copy)`,
            description: template.description,
            icon: template.icon,
            color: template.color,
            inputSchema: template.inputSchema,
            isTemplate: false,
            folderId: template.folderId,
            tags: {
                create: template.tags.map((tag) => ({ tagId: tag.tagId })),
            },
        },
    })

    if (template.steps.length > 0) {
        await prisma.workflowStep.createMany({
            data: template.steps.map((step) => ({
                workflowId: workflow.id,
                name: step.name,
                description: step.description,
                order: step.order,
                inlineContent: step.inlineContent,
                outputVariable: step.outputVariable,
                inputMapping: step.inputMapping,
                condition: step.condition,
                promptId: step.promptId,
            })),
        })
    }

    return prisma.workflow.findUnique({
        where: { id: workflow.id },
        include: {
            folder: true,
            tags: { include: { tag: true } },
            steps: { orderBy: { order: 'asc' } },
            _count: { select: { steps: true } },
        },
    })
}
