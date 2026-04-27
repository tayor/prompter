'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Search, Code, PenTool, BarChart3, Sparkles, Briefcase, GraduationCap, Plus, Eye, Copy } from 'lucide-react'
import { PROMPT_TEMPLATES, TEMPLATE_CATEGORIES, type PromptTemplate } from '@/lib/templates'
import { toast } from 'sonner'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    coding: <Code className="h-4 w-4" />,
    writing: <PenTool className="h-4 w-4" />,
    analysis: <BarChart3 className="h-4 w-4" />,
    creative: <Sparkles className="h-4 w-4" />,
    business: <Briefcase className="h-4 w-4" />,
    learning: <GraduationCap className="h-4 w-4" />,
}

export default function TemplatesPage() {
    const router = useRouter()
    const [templates, setTemplates] = useState<PromptTemplate[]>(PROMPT_TEMPLATES)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [previewTemplate, setPreviewTemplate] = useState<PromptTemplate | null>(null)
    const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        content: '',
        aiModel: '',
    })

    const filteredTemplates = useMemo(() => {
        let filtered = templates

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(
                (template) =>
                    template.title.toLowerCase().includes(query) ||
                    template.description.toLowerCase().includes(query) ||
                    template.category.toLowerCase().includes(query)
            )
        } else if (selectedCategory !== 'all') {
            filtered = filtered.filter((template) => template.category === selectedCategory)
        }

        return filtered
    }, [templates, searchQuery, selectedCategory])

    const handleUseTemplate = (template: PromptTemplate) => {
        // Navigate to new prompt page with template pre-filled
        const params = new URLSearchParams({
            title: template.title,
            content: template.content,
            description: template.description,
            aiModel: template.aiModel || '',
        })
        router.push(`/prompts/new?${params.toString()}`)
    }

    const handleCopyContent = (content: string) => {
        navigator.clipboard.writeText(content)
        toast.success('Template copied to clipboard')
    }

    const handleEditTemplate = (template: PromptTemplate) => {
        setEditingTemplate(template)
        setEditForm({
            title: template.title,
            description: template.description,
            content: template.content,
            aiModel: template.aiModel || '',
        })
    }

    const handleSaveTemplate = () => {
        if (!editingTemplate) {
            return
        }

        const title = editForm.title.trim()
        const description = editForm.description.trim()
        const content = editForm.content.trim()

        if (!title || !description || !content) {
            toast.error('Title, description, and content are required')
            return
        }

        const variables = Array.from(new Set(content.match(/\{\{(.*?)\}\}/g)?.map((match) => match.slice(2, -2).trim()).filter(Boolean) || []))

        const updatedTemplate: PromptTemplate = {
            ...editingTemplate,
            title,
            description,
            content,
            aiModel: editForm.aiModel.trim() || null,
            variables,
        }

        setTemplates((prev) => prev.map((template) => (template.id === updatedTemplate.id ? updatedTemplate : template)))
        setPreviewTemplate((prev) => (prev?.id === updatedTemplate.id ? updatedTemplate : prev))
        setEditingTemplate(null)
        toast.success('Template updated')
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Templates" />
            <div className="flex-1 p-6 space-y-6 overflow-auto">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Prompt Templates</h1>
                        <p className="text-muted-foreground">
                            Start with proven templates for common use cases
                        </p>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Category Tabs */}
                <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                    <TabsList className="flex-wrap h-auto gap-1">
                        <TabsTrigger value="all">All</TabsTrigger>
                        {TEMPLATE_CATEGORIES.map((cat) => (
                            <TabsTrigger key={cat.value} value={cat.value} className="gap-1">
                                {CATEGORY_ICONS[cat.value]}
                                {cat.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {/* Templates Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTemplates.map((template) => (
                        <Card key={template.id} className="flex flex-col hover:border-primary/50 transition-colors">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        {CATEGORY_ICONS[template.category]}
                                        <CardTitle className="text-lg">{template.title}</CardTitle>
                                    </div>
                                    {template.aiModel && (
                                        <Badge variant="secondary" className="text-xs">
                                            {template.aiModel}
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription className="line-clamp-2">
                                    {template.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-end pt-0">
                                {template.variables.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {template.variables.slice(0, 3).map((v) => (
                                            <Badge key={v} variant="outline" className="text-xs font-mono">
                                                {`{{${v}}}`}
                                            </Badge>
                                        ))}
                                        {template.variables.length > 3 && (
                                            <Badge variant="outline" className="text-xs">
                                                +{template.variables.length - 3}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleEditTemplate(template)}
                                    >
                                        <PenTool className="mr-1 h-3 w-3" />
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => setPreviewTemplate(template)}
                                    >
                                        <Eye className="mr-1 h-3 w-3" />
                                        Preview
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleUseTemplate(template)}
                                    >
                                        <Plus className="mr-1 h-3 w-3" />
                                        Use
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {filteredTemplates.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No templates found matching your search.</p>
                    </div>
                )}

                {/* Preview Dialog */}
                <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        {previewTemplate && (
                            <>
                                <DialogHeader>
                                    <div className="flex items-center gap-2">
                                        {CATEGORY_ICONS[previewTemplate.category]}
                                        <DialogTitle>{previewTemplate.title}</DialogTitle>
                                    </div>
                                    <DialogDescription>
                                        {previewTemplate.description}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium mb-2">Template Content</h4>
                                        <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto whitespace-pre-wrap">
                                            {previewTemplate.content}
                                        </pre>
                                    </div>
                                    {previewTemplate.variables.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-medium mb-2">Variables</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {previewTemplate.variables.map((v) => (
                                                    <Badge key={v} variant="outline" className="font-mono">
                                                        {`{{${v}}}`}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleCopyContent(previewTemplate.content)}
                                    >
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copy
                                    </Button>
                                    <Button onClick={() => handleUseTemplate(previewTemplate)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Use Template
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        {editingTemplate && (
                            <>
                                <DialogHeader>
                                    <DialogTitle>Edit Template</DialogTitle>
                                    <DialogDescription>
                                        Update template details for this session.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium">Title</h4>
                                        <Input
                                            value={editForm.title}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium">Description</h4>
                                        <Input
                                            value={editForm.description}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium">AI Model</h4>
                                        <Input
                                            placeholder="Optional"
                                            value={editForm.aiModel}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, aiModel: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium">Content</h4>
                                        <Textarea
                                            value={editForm.content}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, content: e.target.value }))}
                                            className="min-h-40"
                                        />
                                    </div>
                                </div>
                                <DialogFooter className="gap-2">
                                    <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSaveTemplate}>Save Changes</Button>
                                </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
