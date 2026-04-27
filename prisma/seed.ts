import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PROMPT_TEMPLATES } from '../src/lib/templates'

const adapter = new PrismaLibSql({
    url: 'file:./prompter.db',
})

const prisma = new PrismaClient({ adapter })
const currentFile = fileURLToPath(import.meta.url)
const currentDirectory = path.dirname(currentFile)
const canonicalSeedPath = path.resolve(currentDirectory, 'seed.sql')
const schemaPath = path.resolve(currentDirectory, 'schema.prisma')

async function main() {
    await runSchemaPush()
    await runCanonicalSeed()

    console.log('🌱 Seeding database...')

    // Create default settings
    await prisma.settings.upsert({
        where: { id: 'settings' },
        update: {},
        create: {
            id: 'settings',
            theme: 'system',
            editorFontSize: 14,
            autoSaveInterval: 30,
        },
    })
    console.log('✅ Settings created')

    // Create folders (find or create)
    let workFolder = await prisma.folder.findFirst({ where: { name: 'Work' } })
    if (!workFolder) {
        workFolder = await prisma.folder.create({
            data: { name: 'Work', icon: '💼', color: '#3B82F6' },
        })
    }
    let personalFolder = await prisma.folder.findFirst({ where: { name: 'Personal' } })
    if (!personalFolder) {
        personalFolder = await prisma.folder.create({
            data: { name: 'Personal', icon: '🏠', color: '#10B981' },
        })
    }
    let templatesFolder = await prisma.folder.findFirst({ where: { name: 'Templates' } })
    if (!templatesFolder) {
        templatesFolder = await prisma.folder.create({
            data: { name: 'Templates', icon: '📋', color: '#8B5CF6' },
        })
    }
    console.log('✅ Folders created')

    // Create tags (upsert to handle re-running)
    const codingTag = await prisma.tag.upsert({
        where: { name: 'coding' },
        update: {},
        create: { name: 'coding', color: '#EF4444' },
    })
    const writingTag = await prisma.tag.upsert({
        where: { name: 'writing' },
        update: {},
        create: { name: 'writing', color: '#F59E0B' },
    })
    const analysisTag = await prisma.tag.upsert({
        where: { name: 'analysis' },
        update: {},
        create: { name: 'analysis', color: '#06B6D4' },
    })
    const creativeTag = await prisma.tag.upsert({
        where: { name: 'creative' },
        update: {},
        create: { name: 'creative', color: '#EC4899' },
    })
    const businessTag = await prisma.tag.upsert({
        where: { name: 'business' },
        update: {},
        create: { name: 'business', color: '#6366F1' },
    })
    const learningTag = await prisma.tag.upsert({
        where: { name: 'learning' },
        update: {},
        create: { name: 'learning', color: '#14B8A6' },
    })
    const repoAnalysisTag = await prisma.tag.upsert({
        where: { name: 'repo-analysis' },
        update: {},
        create: { name: 'repo-analysis', color: '#8B5CF6' },
    })
    const academicTag = await prisma.tag.upsert({
        where: { name: 'academic' },
        update: {},
        create: { name: 'academic', color: '#F97316' },
    })
    const bmadMethodTag = await prisma.tag.upsert({
        where: { name: 'bmad-method' },
        update: {},
        create: { name: 'bmad-method', color: '#0D9488' },
    })
    const specDrivenTag = await prisma.tag.upsert({
        where: { name: 'spec-driven' },
        update: {},
        create: { name: 'spec-driven', color: '#4F46E5' },
    })
    console.log('✅ Tags created')

    // Map category names to tag references
    const categoryTagMap: Record<string, { id: string }> = {
        coding: codingTag,
        writing: writingTag,
        analysis: analysisTag,
        creative: creativeTag,
        business: businessTag,
        learning: learningTag,
        'repo-analysis': repoAnalysisTag,
        academic: academicTag,
        'bmad-method': bmadMethodTag,
        'spec-driven': specDrivenTag,
    }

    // Create sample prompts (skip if already exist)
    let codeReviewPrompt = await prisma.prompt.findFirst({
        where: { title: 'Code Review Assistant', category: 'user' },
    })
    if (!codeReviewPrompt) {
        codeReviewPrompt = await prisma.prompt.create({
            data: {
                title: 'Code Review Assistant',
                content: `Review the following code and provide feedback on:
1. Code quality and best practices
2. Potential bugs or issues
3. Performance optimizations
4. Security concerns

Code to review:
\`\`\`{{language}}
{{code}}
\`\`\`

Please be specific and actionable in your feedback.`,
                description: 'Comprehensive code review prompt for any programming language',
                variables: JSON.stringify(['language', 'code']),
                aiModel: 'gpt-4',
                category: 'user',
                folderId: workFolder.id,
                tags: {
                    create: [{ tagId: codingTag.id }],
                },
            },
        })
    }

    const existingBlogPost = await prisma.prompt.findFirst({
        where: { title: 'Blog Post Writer', category: 'user' },
    })
    if (!existingBlogPost) {
        await prisma.prompt.create({
            data: {
                title: 'Blog Post Writer',
                content: `Write a comprehensive blog post about {{topic}}.

Requirements:
- Tone: {{tone}}
- Target audience: {{audience}}
- Length: approximately {{wordCount}} words

Include:
- Engaging introduction
- Clear subheadings
- Actionable takeaways
- Compelling conclusion`,
                description: 'Generate well-structured blog posts on any topic',
                variables: JSON.stringify(['topic', 'tone', 'audience', 'wordCount']),
                aiModel: 'claude-3',
                category: 'user',
                folderId: personalFolder.id,
                isFavorite: true,
                tags: {
                    create: [{ tagId: writingTag.id }, { tagId: creativeTag.id }],
                },
            },
        })
    }

    const existingDataAnalysis = await prisma.prompt.findFirst({
        where: { title: 'Data Analysis Helper', category: 'user' },
    })
    if (!existingDataAnalysis) {
        await prisma.prompt.create({
            data: {
                title: 'Data Analysis Helper',
                content: `Analyze the following data and provide insights:

Data:
{{data}}

Please provide:
1. Key observations and patterns
2. Statistical summary if applicable
3. Actionable recommendations
4. Visualizations suggestions`,
                description: 'Analyze datasets and extract meaningful insights',
                variables: JSON.stringify(['data']),
                aiModel: 'gpt-4',
                category: 'user',
                folderId: workFolder.id,
                tags: {
                    create: [{ tagId: analysisTag.id }],
                },
            },
        })
    }

    const existingTextSummarizer = await prisma.prompt.findFirst({
        where: { title: 'Text Summarizer', category: 'user' },
    })
    if (!existingTextSummarizer) {
        await prisma.prompt.create({
            data: {
                title: 'Text Summarizer',
                content: `Summarize the following text in {{style}} style:

"""
{{text}}
"""

Provide a {{length}} summary that captures the main points.`,
                description: 'Summarize any text in various styles and lengths',
                variables: JSON.stringify(['text', 'style', 'length']),
                aiModel: 'claude-3',
                category: 'user',
                folderId: templatesFolder.id,
                tags: {
                    create: [{ tagId: writingTag.id }],
                },
            },
        })
    }
    console.log('✅ Prompts created')

    // Seed all templates from PROMPT_TEMPLATES (skip if already exists by title)
    console.log('🔄 Seeding prompt templates...')
    let seededCount = 0
    let skippedCount = 0
    for (const template of PROMPT_TEMPLATES) {
        const existing = await prisma.prompt.findFirst({
            where: { title: template.title, category: 'template' },
        })
        if (existing) {
            skippedCount++
            continue
        }
        const tag = categoryTagMap[template.category]
        await prisma.prompt.create({
            data: {
                title: template.title,
                content: template.content,
                description: template.description,
                variables: JSON.stringify(template.variables),
                aiModel: template.aiModel,
                category: 'template',
                folderId: templatesFolder.id,
                tags: tag
                    ? {
                        create: [{ tagId: tag.id }],
                    }
                    : undefined,
            },
        })
        seededCount++
    }
    console.log(`✅ ${seededCount} prompt templates seeded (${skippedCount} already existed)`)

    // Create sample workflow (skip if exists)
    const existingWorkflow = await prisma.workflow.findFirst({
        where: { name: 'Content Creation Pipeline' },
    })
    if (!existingWorkflow) {
        await prisma.workflow.create({
            data: {
                name: 'Content Creation Pipeline',
                description: 'A complete workflow for creating blog content from research to final polish',
                icon: '📝',
                color: '#8B5CF6',
                isTemplate: true,
                inputSchema: JSON.stringify([
                    { name: 'topic', type: 'text', required: true },
                    { name: 'tone', type: 'select', required: true, options: ['professional', 'casual', 'educational'] },
                    { name: 'wordCount', type: 'number', required: false, defaultValue: '1500' },
                ]),
                folderId: templatesFolder.id,
                steps: {
                    create: [
                        {
                            name: 'Research Topic',
                            description: 'Gather key information and sources',
                            order: 0,
                            inlineContent: 'Research the topic "{{input.topic}}" and provide:\n1. Key facts and statistics\n2. Current trends\n3. Expert opinions\n4. Potential angles for content',
                            outputVariable: 'research',
                        },
                        {
                            name: 'Create Outline',
                            description: 'Structure the content',
                            order: 1,
                            inlineContent: 'Based on this research:\n\n{{step0.research}}\n\nCreate a detailed outline for a {{input.tone}} blog post about {{input.topic}}.',
                            outputVariable: 'outline',
                        },
                        {
                            name: 'Write Draft',
                            description: 'Write the first draft',
                            order: 2,
                            inlineContent: 'Using this outline:\n\n{{step1.outline}}\n\nWrite a complete {{input.wordCount}}-word draft in a {{input.tone}} tone.',
                            outputVariable: 'draft',
                        },
                        {
                            name: 'Edit & Polish',
                            description: 'Refine and improve the draft',
                            order: 3,
                            inlineContent: 'Edit and polish this draft:\n\n{{step2.draft}}\n\nFocus on:\n- Grammar and clarity\n- Flow and transitions\n- Engaging hooks\n- Strong conclusion',
                            outputVariable: 'final',
                        },
                    ],
                },
                tags: {
                    create: [{ tagId: writingTag.id }, { tagId: creativeTag.id }],
                },
            },
        })
    }
    console.log('✅ Workflow created')

    // Create version history for a prompt (skip if exists)
    const existingVersion = await prisma.promptVersion.findFirst({
        where: { promptId: codeReviewPrompt.id, version: 1 },
    })
    if (!existingVersion) {
        await prisma.promptVersion.create({
            data: {
                promptId: codeReviewPrompt.id,
                version: 1,
                content: codeReviewPrompt.content,
                variables: codeReviewPrompt.variables,
                changeNote: 'Initial version',
            },
        })
    }
    console.log('✅ Version history created')

    console.log('🎉 Seeding complete!')
}

async function runSchemaPush() {
    const args = ['prisma', 'db', 'push', '--schema', schemaPath, '--force-reset']

    const result = spawnSync('npx', args, {
        stdio: 'inherit',
        env: process.env,
    })

    if (result.error) {
        throw result.error
    }

    if (result.status !== 0) {
        throw new Error('Failed to apply Prisma schema')
    }
}

async function runCanonicalSeed() {
    if (!fs.existsSync(canonicalSeedPath)) {
        throw new Error(`Canonical seed SQL file not found: ${canonicalSeedPath}`)
    }

    const result = spawnSync(
        'npx',
        ['prisma', 'db', 'execute', '--file', canonicalSeedPath],
        {
            stdio: 'inherit',
            env: process.env,
        }
    )

    if (result.error) {
        throw result.error
    }

    if (result.status !== 0) {
        throw new Error('Failed to execute canonical SQL seed bundle')
    }
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
