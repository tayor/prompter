'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
    ArrowLeft,
    Loader2,
    Check,
    Clock,
    XCircle,
    ChevronRight,
    Copy,
} from 'lucide-react'
import Link from 'next/link'

interface WorkflowStep {
    id: string
    name: string
    description: string | null
    order: number
    inlineContent: string | null
    outputVariable: string
}

interface StepRun {
    id: string
    stepOrder: number
    stepName: string
    status: string
    resolvedPrompt: string | null
    output: string | null
}

interface WorkflowRun {
    id: string
    status: string
    currentStep: number
    inputs: string | null
    outputs: string | null
    stepRuns: StepRun[]
    workflow: {
        id: string
        name: string
        icon: string | null
        color: string | null
        steps: WorkflowStep[]
    }
}

export default function WorkflowRunPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [run, setRun] = useState<WorkflowRun | null>(null)
    const [currentOutput, setCurrentOutput] = useState('')

    const startRun = useCallback(async () => {
        try {
            const res = await fetch(`/api/workflows/${id}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: {} }),
            })

            if (!res.ok) throw new Error('Failed to start')

            const data = await res.json()
            setRun(data)
            resolveCurrentPrompt(data)
        } catch {
            toast.error('Failed to start workflow')
            router.push(`/workflows/${id}`)
        } finally {
            setLoading(false)
        }
    }, [id, router])

    useEffect(() => {
        startRun()
    }, [startRun])

    const resolveCurrentPrompt = (runData: WorkflowRun) => {
        const currentStepDef = runData.workflow.steps.find(
            (s) => s.order === runData.currentStep
        )
        if (currentStepDef?.inlineContent) {
            // Simple variable substitution from previous step outputs
            let resolved = currentStepDef.inlineContent
            runData.stepRuns.forEach((sr) => {
                if (sr.status === 'completed' && sr.output) {
                    const stepDef = runData.workflow.steps.find((s) => s.order === sr.stepOrder)
                    if (stepDef) {
                        resolved = resolved.replace(
                            new RegExp(`\\{\\{${stepDef.outputVariable}\\}\\}`, 'g'),
                            sr.output
                        )
                    }
                }
            })
            // Update the step run with resolved prompt
            const currentStepRun = runData.stepRuns.find((sr) => sr.stepOrder === runData.currentStep)
            if (currentStepRun) {
                currentStepRun.resolvedPrompt = resolved
            }
        }
    }

    const completeStep = async () => {
        if (!run || !currentOutput.trim()) {
            toast.error('Please enter the output')
            return
        }

        try {
            const res = await fetch(`/api/workflows/${id}/run/${run.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    completeStep: run.currentStep,
                    output: currentOutput,
                }),
            })

            if (!res.ok) throw new Error('Failed')

            const updated = await res.json()
            setRun(updated)
            setCurrentOutput('')
            resolveCurrentPrompt(updated)

            if (updated.status === 'completed') {
                toast.success('Workflow completed!')
            }
        } catch {
            toast.error('Failed to complete step')
        }
    }

    const cancelRun = async () => {
        if (!run || !confirm('Cancel this run?')) return

        try {
            await fetch(`/api/workflows/${id}/run/${run.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancel: true }),
            })
            toast.success('Run cancelled')
            router.push(`/workflows/${id}`)
        } catch {
            toast.error('Failed to cancel')
        }
    }

    const copyPrompt = async (text: string) => {
        await navigator.clipboard.writeText(text)
        toast.success('Copied to clipboard')
    }

    if (loading) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Running Workflow" />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                        <p className="text-muted-foreground">Starting workflow...</p>
                    </div>
                </div>
            </div>
        )
    }

    const currentStepDef = run?.workflow.steps.find((s) => s.order === run.currentStep)
    const currentStepRun = run?.stepRuns.find((sr) => sr.stepOrder === run.currentStep)

    return (
        <div className="flex flex-col h-full">
            <Header title="Running Workflow" />
            <div className="flex-1 overflow-auto">
                <div className="max-w-4xl mx-auto p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" asChild>
                            <Link href={`/workflows/${id}`}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Workflow
                            </Link>
                        </Button>
                        <div className="flex items-center gap-2">
                            <Badge variant={run?.status === 'completed' ? 'default' : run?.status === 'cancelled' ? 'destructive' : 'secondary'}>
                                {run?.status}
                            </Badge>
                            {run?.status === 'running' && (
                                <Button variant="destructive" size="sm" onClick={cancelRun}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Workflow Info */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex items-center justify-center h-12 w-12 rounded-lg text-2xl"
                                    style={{ backgroundColor: `${run?.workflow.color || '#8B5CF6'}20` }}
                                >
                                    {run?.workflow.icon || '⚡'}
                                </div>
                                <div>
                                    <CardTitle>{run?.workflow.name}</CardTitle>
                                    <CardDescription>
                                        Step {(run?.currentStep ?? 0) + 1} of {run?.workflow.steps.length}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* Steps Progress */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {run?.workflow.steps.map((step, i) => {
                            const stepRun = run.stepRuns.find((sr) => sr.stepOrder === step.order)
                            const status = stepRun?.status || 'pending'
                            return (
                                <div key={step.id} className="flex items-center">
                                    <div
                                        className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium ${status === 'completed'
                                            ? 'bg-green-500 text-white'
                                            : status === 'running'
                                                ? 'bg-primary text-primary-foreground'
                                                : status === 'skipped'
                                                    ? 'bg-muted text-muted-foreground'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}
                                    >
                                        {status === 'completed' ? <Check className="h-4 w-4" /> : i + 1}
                                    </div>
                                    {i < run.workflow.steps.length - 1 && (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Current Step */}
                    {run?.status === 'running' && currentStepDef && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" />
                                    {currentStepDef.name}
                                </CardTitle>
                                {currentStepDef.description && (
                                    <CardDescription>{currentStepDef.description}</CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Show Prompt */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Prompt</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                copyPrompt(
                                                    currentStepRun?.resolvedPrompt || currentStepDef.inlineContent || ''
                                                )
                                            }
                                        >
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy
                                        </Button>
                                    </div>
                                    <pre className="p-4 bg-muted rounded-lg whitespace-pre-wrap font-mono text-sm max-h-64 overflow-auto">
                                        {currentStepRun?.resolvedPrompt || currentStepDef.inlineContent || 'No prompt content'}
                                    </pre>
                                </div>

                                {/* Output Input */}
                                <div className="space-y-2">
                                    <Label htmlFor="output">
                                        Your Output <span className="text-muted-foreground">(paste AI response here)</span>
                                    </Label>
                                    <Textarea
                                        id="output"
                                        value={currentOutput}
                                        onChange={(e) => setCurrentOutput(e.target.value)}
                                        placeholder="Paste the AI's response here..."
                                        className="min-h-[200px] font-mono text-sm"
                                    />
                                </div>

                                <Button onClick={completeStep} className="w-full" disabled={!currentOutput.trim()}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Complete Step & Continue
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Completed State */}
                    {run?.status === 'completed' && (
                        <Card className="border-green-500">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-green-600">
                                    <Check className="h-5 w-5" />
                                    Workflow Completed
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {run.stepRuns.map((sr) => (
                                        <div key={sr.id} className="border rounded-lg p-4">
                                            <h4 className="font-medium mb-2">{sr.stepName}</h4>
                                            <pre className="p-3 bg-muted rounded text-sm whitespace-pre-wrap max-h-40 overflow-auto">
                                                {sr.output || 'No output'}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Cancelled State */}
                    {run?.status === 'cancelled' && (
                        <Card className="border-destructive">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-destructive">
                                    <XCircle className="h-5 w-5" />
                                    Workflow Cancelled
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
