'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ReactMarkdown from 'react-markdown'
import { Eye, ClipboardCopy, Check } from 'lucide-react'
import { resolveVariables } from '@/lib/variable-resolver'

interface VariableSubstitutionPreviewProps {
    content: string
    variables: string[]
}

export function VariableSubstitutionPreview({ content, variables }: VariableSubstitutionPreviewProps) {
    const [values, setValues] = useState<Record<string, string>>({})
    const [copied, setCopied] = useState(false)

    const resolvedContent = useMemo(() => {
        if (Object.keys(values).length === 0) return content
        return resolveVariables(content, values)
    }, [content, values])

    const updateValue = (variable: string, value: string) => {
        setValues((prev) => ({ ...prev, [variable]: value }))
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(resolvedContent)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const filledCount = Object.values(values).filter((v) => v.trim()).length

    if (variables.length === 0) {
        return null
    }

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Variable Substitution Preview
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                        {filledCount}/{variables.length} filled
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Variable Inputs */}
                <div className="grid gap-3 sm:grid-cols-2">
                    {variables.map((variable) => (
                        <div key={variable} className="space-y-1">
                            <Label htmlFor={`var-${variable}`} className="text-xs font-mono">
                                {`{{${variable}}}`}
                            </Label>
                            <Input
                                id={`var-${variable}`}
                                placeholder={`Enter value for ${variable}`}
                                value={values[variable] || ''}
                                onChange={(e) => updateValue(variable, e.target.value)}
                                className="h-8 text-sm"
                            />
                        </div>
                    ))}
                </div>

                {/* Resolved Preview */}
                {filledCount > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Preview</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="h-7 text-xs"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-3 w-3 mr-1" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <ClipboardCopy className="h-3 w-3 mr-1" />
                                        Copy Result
                                    </>
                                )}
                            </Button>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-md text-sm prose prose-sm dark:prose-invert max-w-none overflow-auto max-h-64">
                            <ReactMarkdown>{resolvedContent}</ReactMarkdown>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
