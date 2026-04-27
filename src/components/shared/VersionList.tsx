'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VersionDiff } from '@/components/shared/VersionDiff'
import { RotateCcw, GitCompare } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Version {
    id: string
    version: number
    content: string
    changeNote: string | null
    createdAt: string
}

interface VersionListProps {
    promptId: string
    currentContent: string
    versions: Version[]
}

export function VersionList({ promptId, currentContent, versions }: VersionListProps) {
    const router = useRouter()
    const [comparingVersion, setComparingVersion] = useState<Version | null>(null)
    const [restoring, setRestoring] = useState<string | null>(null)

    const handleRestore = async (versionId: string) => {
        setRestoring(versionId)
        try {
            const res = await fetch(`/api/prompts/${promptId}/restore/${versionId}`, {
                method: 'POST',
            })
            if (!res.ok) throw new Error('Failed to restore')
            toast.success('Version restored')
            router.refresh()
        } catch {
            toast.error('Failed to restore version')
        } finally {
            setRestoring(null)
        }
    }

    return (
        <div className="space-y-4">
            {/* Current Version with Diff Comparison */}
            <Card className="border-primary/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge>Current</Badge>
                            <span className="text-sm text-muted-foreground">Latest version</span>
                        </div>
                        {versions.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setComparingVersion(
                                    comparingVersion === versions[0] ? null : versions[0]
                                )}
                            >
                                <GitCompare className="mr-2 h-4 w-4" />
                                {comparingVersion ? 'Hide Diff' : 'Compare to Previous'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <pre className="text-sm bg-muted p-4 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
                        {currentContent.slice(0, 500)}
                        {currentContent.length > 500 && '...'}
                    </pre>

                    {comparingVersion && (
                        <VersionDiff
                            currentContent={currentContent}
                            previousContent={comparingVersion.content}
                            currentVersion="Current"
                            previousVersion={`v${comparingVersion.version}`}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Historical Versions */}
            {versions.map((version, idx) => (
                <Card key={version.id}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline">v{version.version}</Badge>
                                <span className="text-sm text-muted-foreground">
                                    {new Date(version.createdAt).toLocaleString()}
                                </span>
                                {version.changeNote && (
                                    <span className="text-sm text-muted-foreground italic">
                                        &quot;{version.changeNote}&quot;
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {idx < versions.length - 1 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setComparingVersion(
                                            comparingVersion === version ? null : version
                                        )}
                                    >
                                        <GitCompare className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRestore(version.id)}
                                    disabled={restoring === version.id}
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    {restoring === version.id ? 'Restoring...' : 'Restore'}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <pre className="text-sm bg-muted p-4 rounded-md overflow-auto max-h-32 whitespace-pre-wrap">
                            {version.content.slice(0, 300)}
                            {version.content.length > 300 && '...'}
                        </pre>

                        {/* Show diff with next older version */}
                        {comparingVersion === version && idx < versions.length - 1 && (
                            <VersionDiff
                                currentContent={version.content}
                                previousContent={versions[idx + 1].content}
                                currentVersion={`v${version.version}`}
                                previousVersion={`v${versions[idx + 1].version}`}
                            />
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
