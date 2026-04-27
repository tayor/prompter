import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import {
    createWorkflow,
    listWorkflows,
    getWorkflowById,
    updateWorkflowById,
    deleteWorkflowById,
    startWorkflowRun,
    listWorkflowRuns,
    getWorkflowRunById,
    updateWorkflowRunById,
    parseWorkflowListQuery,
    buildWorkflowWhere,
    getWorkflowListOrderBy,
} from '@/lib/services/workflows-service'

let workflowId: string
let runId: string

before(async () => {
    await prisma.workflowStepRun.deleteMany({})
    await prisma.workflowRun.deleteMany({})
    await prisma.workflowVersion.deleteMany({})
    await prisma.workflowStep.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.workflow.deleteMany({})
})

after(async () => {
    await prisma.workflowStepRun.deleteMany({})
    await prisma.workflowRun.deleteMany({})
    await prisma.workflowVersion.deleteMany({})
    await prisma.workflowStep.deleteMany({})
    await prisma.tagsOnWorkflows.deleteMany({})
    await prisma.workflow.deleteMany({})
    await prisma.$disconnect()
})

describe('parseWorkflowListQuery', () => {
    it('returns defaults for empty search params', () => {
        const query = parseWorkflowListQuery(new URLSearchParams())
        assert.equal(query.page, 1)
        assert.equal(query.limit, 20)
        assert.equal(query.sort, 'updated')
    })
})

describe('buildWorkflowWhere', () => {
    it('defaults isArchived to false', () => {
        const where = buildWorkflowWhere({ page: 1, limit: 20, sort: 'updated', order: 'desc' })
        assert.equal(where.isArchived, false)
    })
})

describe('getWorkflowListOrderBy', () => {
    it('returns updatedAt by default', () => {
        assert.deepEqual(getWorkflowListOrderBy('updated', 'desc'), { updatedAt: 'desc' })
    })

    it('returns name for name sort', () => {
        assert.deepEqual(getWorkflowListOrderBy('name', 'asc'), { name: 'asc' })
    })
})

describe('createWorkflow', () => {
    it('creates a workflow', async () => {
        const result = await createWorkflow({
            name: 'Test Workflow',
            description: 'A test workflow',
        })
        workflowId = result.id
        assert.ok(result.id)
        assert.equal(result.name, 'Test Workflow')

        // Add steps separately
        await prisma.workflowStep.createMany({
            data: [
                {
                    workflowId,
                    name: 'Step 1',
                    order: 0,
                    outputVariable: 'output1',
                    inlineContent: 'Do something',
                },
                {
                    workflowId,
                    name: 'Step 2',
                    order: 1,
                    outputVariable: 'output2',
                    inlineContent: 'Process step 1',
                },
            ],
        })
    })
})

describe('listWorkflows', () => {
    it('lists workflows with pagination', async () => {
        const result = await listWorkflows({ page: 1, limit: 20, sort: 'updated', order: 'desc' })
        assert.ok(result.workflows.length >= 1)
        assert.ok(result.pagination)
    })
})

describe('getWorkflowById', () => {
    it('returns workflow with steps', async () => {
        const wf = await getWorkflowById(workflowId)
        assert.ok(wf)
        assert.equal(wf!.name, 'Test Workflow')
        assert.ok(wf!.steps.length >= 2)
    })

    it('returns null for non-existent id', async () => {
        const wf = await getWorkflowById('nonexistent')
        assert.equal(wf, null)
    })
})

describe('updateWorkflowById', () => {
    it('updates workflow name', async () => {
        const updated = await updateWorkflowById(workflowId, { name: 'Renamed Workflow' })
        assert.ok(updated)
        assert.equal(updated!.name, 'Renamed Workflow')
    })
})

describe('startWorkflowRun', () => {
    it('creates a run with step runs', async () => {
        const run = await startWorkflowRun(workflowId, { topic: 'AI Testing' })
        assert.ok(run)
        runId = run!.id
        assert.equal(run!.status, 'running')
        assert.ok(run!.stepRuns.length >= 2)
        assert.equal(run!.stepRuns[0].status, 'running')
    })

    it('returns null for non-existent workflow', async () => {
        const run = await startWorkflowRun('nonexistent')
        assert.equal(run, null)
    })
})

describe('listWorkflowRuns', () => {
    it('lists runs for a workflow', async () => {
        const runs = await listWorkflowRuns(workflowId)
        assert.ok(runs.length >= 1)
    })
})

describe('getWorkflowRunById', () => {
    it('returns run with step runs', async () => {
        const run = await getWorkflowRunById(workflowId, runId)
        assert.ok(run)
        assert.ok(run!.stepRuns.length >= 2)
    })
})

describe('updateWorkflowRunById', () => {
    it('completes a step with output', async () => {
        const updated = await updateWorkflowRunById(workflowId, runId, {
            completeStep: 0,
            output: 'Step 1 output',
        })
        assert.ok(updated)
    })

    it('cancels a run', async () => {
        const run2 = await startWorkflowRun(workflowId)
        assert.ok(run2)
        const cancelled = await updateWorkflowRunById(workflowId, run2!.id, { cancel: true })
        assert.ok(cancelled)
        assert.equal(cancelled!.status, 'cancelled')
    })
})

describe('deleteWorkflowById', () => {
    it('deletes workflow and returns true', async () => {
        const result = await deleteWorkflowById(workflowId)
        assert.equal(result, true)
    })

    it('returns false for non-existent workflow', async () => {
        const result = await deleteWorkflowById('nonexistent')
        assert.equal(result, false)
    })
})
