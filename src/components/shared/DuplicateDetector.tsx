'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Loader2, Search, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface DuplicatePrompt {
    id: string
    title: string
    content: string
    updatedAt: string
    usageCount: number
}

interface DuplicateGroup {
    prompts: DuplicatePrompt[]
    similarity: number
}

export function DuplicateDetector() {
    const [loading, setLoading] = useState(false)
    const [groups, setGroups] = useState<DuplicateGroup[]>([])
    const [totalDuplicates, setTotalDuplicates] = useState(0)
    const [threshold, setThreshold] = useState([0.7])
    const [hasSearched, setHasSearched] = useState(false)

    const findDuplicates = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/prompts/duplicates?threshold=${threshold[0]}`)
            const data = await res.json()
            setGroups(data.groups || [])
            setTotalDuplicates(data.totalDuplicates || 0)
            setHasSearched(true)

            if (data.groups.length === 0) {
                toast.success('No duplicates found!')
            } else {
                toast.info(`Found ${data.totalDuplicates} potential duplicates in ${data.groups.length} groups`)
            }
        } catch {
            toast.error('Failed to detect duplicates')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Copy className="h-5 w-5" />
                    Duplicate Detection
                </CardTitle>
                <CardDescription>
                    Find prompts with similar titles or content
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Similarity Threshold: {Math.round(threshold[0] * 100)}%</Label>
                    </div>
                    <Slider
                        value={threshold}
                        onValueChange={setThreshold}
                        min={0.5}
                        max={0.95}
                        step={0.05}
                        className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                        Higher values find only very similar prompts
                    </p>
                </div>

                <Button onClick={findDuplicates} disabled={loading} className="w-full">
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Scanning...
                        </>
                    ) : (
                        <>
                            <Search className="mr-2 h-4 w-4" />
                            Find Duplicates
                        </>
                    )}
                </Button>

                {hasSearched && groups.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                        ✓ No duplicates found at {Math.round(threshold[0] * 100)}% threshold
                    </div>
                )}

                {groups.length > 0 && (
                    <div className="space-y-3">
                        <div className="text-sm font-medium">
                            Found {totalDuplicates} duplicates in {groups.length} groups
                        </div>
                        {groups.map((group, idx) => (
                            <Card key={idx} className="border-dashed">
                                <CardContent className="p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Badge variant="secondary">
                                            {group.prompts.length} similar
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {Math.round(group.similarity * 100)}% match
                                        </span>
                                    </div>
                                    {group.prompts.map((prompt) => (
                                        <div
                                            key={prompt.id}
                                            className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{prompt.title}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    Used {prompt.usageCount}x • Updated {new Date(prompt.updatedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/prompts/${prompt.id}`}>
                                                    <ExternalLink className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
