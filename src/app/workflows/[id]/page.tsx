'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
    Save,
    ArrowLeft,
    Plus,
    Trash2,
    GripVertical,
    Play,
    Loader2,
    ChevronDown,
    ChevronUp,
} from 'lucide-react'
import Link from 'next/link'

interface WorkflowStep {
    id: string
    name: string
    description: string | null
    order: number
    inlineContent: string | null
    outputVariable: string
    promptId: string | null
    prompt?: { id: string; title: string; content: string } | null
}

interface Workflow {
    id: string
    name: string
    description: string | null
    icon: string | null
    color: string | null
    steps: WorkflowStep[]
}

export default function WorkflowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [workflow, setWorkflow] = useState<Workflow | null>(null)
    const [steps, setSteps] = useState<WorkflowStep[]>([])
    const [stepDialogOpen, setStepDialogOpen] = useState(false)
    const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null)
    const [stepForm, setStepForm] = useState({
        name: '',
        description: '',
        inlineContent: '',
        outputVariable: '',
    })

    const fetchWorkflow = useCallback(async () => {
        try {
            const res = await fetch(`/api/workflows/${id}`)
            if (!res.ok) throw new Error('Not found')
            const data = await res.json()
            setWorkflow(data)
            setSteps(data.steps || [])
        } catch {
            toast.error('Workflow not found')
            router.push('/workflows')
        } finally {
            setLoading(false)
        }
    }, [id, router])

    useEffect(() => {
        fetchWorkflow()
    }, [fetchWorkflow])

    const handleSaveWorkflow = async () => {
        if (!workflow) return

        setSaving(true)
        try {
            await fetch(`/api/workflows/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: workflow.name,
                    description: workflow.description,
                }),
            })
            toast.success('Workflow saved')
        } catch {
            toast.error('Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const openNewStepDialog = () => {
        setEditingStep(null)
        setStepForm({ name: '', description: '', inlineContent: '', outputVariable: '' })
        setStepDialogOpen(true)
    }

    const openEditStepDialog = (step: WorkflowStep) => {
        setEditingStep(step)
        setStepForm({
            name: step.name,
            description: step.description || '',
            inlineContent: step.inlineContent || '',
            outputVariable: step.outputVariable,
        })
        setStepDialogOpen(true)
    }

    const handleSaveStep = async () => {
        if (!stepForm.name.trim() || !stepForm.outputVariable.trim()) {
            toast.error('Name and output variable are required')
            return
        }

        try {
            if (editingStep) {
                const res = await fetch(`/api/workflows/${id}/steps/${editingStep.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(stepForm),
                })
                const updated = await res.json()
                setSteps((prev) => prev.map((s) => (s.id === editingStep.id ? updated : s)))
                toast.success('Step updated')
            } else {
                const res = await fetch(`/api/workflows/${id}/steps`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...stepForm, order: steps.length }),
                })
                const created = await res.json()
                setSteps((prev) => [...prev, created])
                toast.success('Step added')
            }
            setStepDialogOpen(false)
        } catch {
            toast.error('Failed to save step')
        }
    }

    const handleDeleteStep = async (stepId: string) => {
        if (!confirm('Delete this step?')) return

        try {
            await fetch(`/api/workflows/${id}/steps/${stepId}`, { method: 'DELETE' })
            setSteps((prev) => prev.filter((s) => s.id !== stepId))
            toast.success('Step deleted')
        } catch {
            toast.error('Failed to delete step')
        }
    }

    const moveStep = async (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= steps.length) return

        const newSteps = [...steps]
        const temp = newSteps[index]
        newSteps[index] = newSteps[newIndex]
        newSteps[newIndex] = temp

        // Update orders
        const reordered = newSteps.map((s, i) => ({ ...s, order: i }))
        setSteps(reordered)

        try {
            await fetch(`/api/workflows/${id}/steps`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ steps: reordered.map((s) => ({ id: s.id, order: s.order })) }),
            })
        } catch {
            toast.error('Failed to reorder')
            fetchWorkflow() // Revert
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Workflow Builder" />
                <div className="flex-1 p-6">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <Skeleton className="h-10 w-32" />
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-20 w-full" />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Workflow Builder" />
            <div className="flex-1 overflow-auto">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" asChild>
                            <Link href="/workflows">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" asChild>
                                <Link href={`/workflows/${id}/run`}>
                                    <Play className="mr-2 h-4 w-4" />
                                    Run
                                </Link>
                            </Button>
                            <Button onClick={handleSaveWorkflow} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save
                            </Button>
                        </div>
                    </div>

                    {/* Workflow Info */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex items-center justify-center h-12 w-12 rounded-lg text-2xl"
                                    style={{ backgroundColor: `${workflow?.color || '#8B5CF6'}20` }}
                                >
                                    {workflow?.icon || '⚡'}
                                </div>
                                <div>
                                    <Input
                                        value={workflow?.name || ''}
                                        onChange={(e) => setWorkflow((w) => w ? { ...w, name: e.target.value } : null)}
                                        className="text-xl font-semibold border-none p-0 h-auto focus-visible:ring-0"
                                        placeholder="Workflow name"
                                    />
                                    <Input
                                        value={workflow?.description || ''}
                                        onChange={(e) => setWorkflow((w) => w ? { ...w, description: e.target.value } : null)}
                                        className="text-sm text-muted-foreground border-none p-0 h-auto focus-visible:ring-0"
                                        placeholder="Add a description..."
                                    />
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Steps */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Steps</CardTitle>
                                <CardDescription>Define the sequence of prompts in this workflow</CardDescription>
                            </div>
                            <Button onClick={openNewStepDialog}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Step
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {steps.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No steps yet. Add your first step to get started.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {steps.map((step, index) => (
                                        <div
                                            key={step.id}
                                            className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                                        >
                                            <div className="flex flex-col gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => moveStep(index, 'up')}
                                                    disabled={index === 0}
                                                >
                                                    <ChevronUp className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => moveStep(index, 'down')}
                                                    disabled={index === steps.length - 1}
                                                >
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <Badge variant="secondary" className="mt-1">
                                                {index + 1}
                                            </Badge>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-medium">{step.name}</h4>
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {`{{${step.outputVariable}}}`}
                                                    </Badge>
                                                </div>
                                                {step.description && (
                                                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                                                )}
                                                {step.inlineContent && (
                                                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto max-h-20">
                                                        {step.inlineContent.slice(0, 150)}
                                                        {step.inlineContent.length > 150 && '...'}
                                                    </pre>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => openEditStepDialog(step)}>
                                                    <GripVertical className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteStep(step.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Step Dialog */}
            <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingStep ? 'Edit Step' : 'Add Step'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="stepName">Step Name *</Label>
                                <Input
                                    id="stepName"
                                    value={stepForm.name}
                                    onChange={(e) => setStepForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g., Research Topic"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="outputVar">Output Variable *</Label>
                                <Input
                                    id="outputVar"
                                    value={stepForm.outputVariable}
                                    onChange={(e) => setStepForm((f) => ({ ...f, outputVariable: e.target.value }))}
                                    placeholder="e.g., research"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="stepDesc">Description</Label>
                            <Input
                                id="stepDesc"
                                value={stepForm.description}
                                onChange={(e) => setStepForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="What does this step do?"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="content">Prompt Content</Label>
                            <Textarea
                                id="content"
                                value={stepForm.inlineContent}
                                onChange={(e) => setStepForm((f) => ({ ...f, inlineContent: e.target.value }))}
                                placeholder="Enter the prompt for this step. Use {{input.variable}} for workflow inputs and {{stepN.variable}} for previous step outputs."
                                className="min-h-[200px] font-mono text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStepDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveStep}>
                            {editingStep ? 'Save Changes' : 'Add Step'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
