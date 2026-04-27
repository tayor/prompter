'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Save, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

const WORKFLOW_ICONS = ['⚡', '🔄', '📝', '🎯', '🚀', '💡', '🔧', '📊', '🎨', '🤖']
const WORKFLOW_COLORS = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

export default function NewWorkflowPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        icon: '⚡',
        color: '#8B5CF6',
        isTemplate: false,
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name.trim()) {
            toast.error('Name is required')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            if (!res.ok) throw new Error('Failed to create workflow')

            const workflow = await res.json()
            toast.success('Workflow created')
            router.push(`/workflows/${workflow.id}`)
        } catch {
            toast.error('Failed to create workflow')
        } finally {
            setSaving(false)
        }
    }

    const updateField = (field: string, value: string | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="New Workflow" />
            <form onSubmit={handleSubmit} className="flex-1 overflow-auto">
                <div className="max-w-2xl mx-auto p-6 space-y-6">
                    <Button variant="ghost" asChild className="mb-4">
                        <Link href="/workflows">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Workflows
                        </Link>
                    </Button>

                    <Card>
                        <CardHeader>
                            <CardTitle>Workflow Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="Enter workflow name..."
                                    value={formData.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Describe what this workflow does..."
                                    value={formData.description}
                                    onChange={(e) => updateField('description', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Icon</Label>
                                <div className="flex flex-wrap gap-2">
                                    {WORKFLOW_ICONS.map((icon) => (
                                        <Button
                                            key={icon}
                                            type="button"
                                            variant={formData.icon === icon ? 'secondary' : 'outline'}
                                            size="icon"
                                            onClick={() => updateField('icon', icon)}
                                        >
                                            {icon}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex flex-wrap gap-2">
                                    {WORKFLOW_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`h-8 w-8 rounded-full border-2 transition-all ${formData.color === color ? 'border-primary scale-110' : 'border-transparent'
                                                }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => updateField('color', color)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t">
                                <div>
                                    <Label htmlFor="isTemplate">Save as Template</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Templates can be reused to create new workflows
                                    </p>
                                </div>
                                <Switch
                                    id="isTemplate"
                                    checked={formData.isTemplate}
                                    onCheckedChange={(checked) => updateField('isTemplate', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" asChild>
                            <Link href="/workflows">Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Create Workflow
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}
