import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, GitCommit } from 'lucide-react'
import { VersionList } from '@/components/shared/VersionList'

interface PageProps {
    params: Promise<{ id: string }>
}

async function getPromptWithVersions(id: string) {
    const prompt = await prisma.prompt.findUnique({
        where: { id },
        include: {
            folder: true,
            versions: {
                orderBy: { version: 'desc' },
            },
        },
    })

    return prompt
}

export default async function PromptHistoryPage({ params }: PageProps) {
    const { id } = await params
    const prompt = await getPromptWithVersions(id)

    if (!prompt) {
        notFound()
    }

    // Serialize versions for client component
    const serializedVersions = prompt.versions.map((v) => ({
        id: v.id,
        version: v.version,
        content: v.content,
        changeNote: v.changeNote,
        createdAt: v.createdAt.toISOString(),
    }))

    return (
        <div className="flex flex-col h-full">
            <Header title="Version History" />
            <div className="flex-1 p-6 space-y-6 overflow-auto">
                {/* Back Link */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={`/prompts/${id}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Prompt
                        </Link>
                    </Button>
                    <div className="flex-1" />
                    <Badge variant="outline">{prompt.versions.length} versions</Badge>
                </div>

                {/* Prompt Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>{prompt.title}</CardTitle>
                        <CardDescription>
                            {prompt.folder?.name || 'No folder'} • Created {new Date(prompt.createdAt).toLocaleDateString()}
                        </CardDescription>
                    </CardHeader>
                </Card>

                {/* Versions List */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <GitCommit className="h-5 w-5" />
                        Version History
                    </h2>

                    {prompt.versions.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No versions yet.</p>
                                <p className="text-sm">Versions are created automatically when you save changes.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <VersionList
                            promptId={id}
                            currentContent={prompt.content}
                            versions={serializedVersions}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

