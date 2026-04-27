import { cn } from '@/lib/utils'
import { FileText, Workflow, Folder, Search, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type EmptyStateType = 'prompts' | 'workflows' | 'folders' | 'tags' | 'search' | 'generic'

const emptyStateConfig: Record<
    EmptyStateType,
    {
        icon: React.ComponentType<{ className?: string }>
        title: string
        description: string
        actionLabel?: string
        actionHref?: string
    }
> = {
    prompts: {
        icon: FileText,
        title: 'No prompts yet',
        description: 'Create your first prompt to get started with your AI prompt library.',
        actionLabel: 'Create Prompt',
        actionHref: '/prompts/new',
    },
    workflows: {
        icon: Workflow,
        title: 'No workflows yet',
        description: 'Create your first workflow to chain prompts together.',
        actionLabel: 'Create Workflow',
        actionHref: '/workflows/new',
    },
    folders: {
        icon: Folder,
        title: 'No folders yet',
        description: 'Create folders to organize your prompts and workflows.',
        actionLabel: 'Create Folder',
        actionHref: '/folders?new=true',
    },
    tags: {
        icon: Inbox,
        title: 'No tags yet',
        description: 'Create tags to categorize and filter your content.',
        actionLabel: 'Create Tag',
        actionHref: '/tags?new=true',
    },
    search: {
        icon: Search,
        title: 'No results found',
        description: 'Try adjusting your search terms or filters.',
    },
    generic: {
        icon: Inbox,
        title: 'Nothing here yet',
        description: 'Get started by adding some content.',
    },
}

interface EmptyStateProps {
    type?: EmptyStateType
    title?: string
    description?: string
    actionLabel?: string
    actionHref?: string
    className?: string
}

export function EmptyState({
    type = 'generic',
    title,
    description,
    actionLabel,
    actionHref,
    className,
}: EmptyStateProps) {
    const config = emptyStateConfig[type]
    const Icon = config.icon

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-16 px-4 text-center',
                className
            )}
        >
            <div className="rounded-full bg-muted p-4 mb-4">
                <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{title ?? config.title}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {description ?? config.description}
            </p>
            {(actionLabel ?? config.actionLabel) && (actionHref ?? config.actionHref) && (
                <Button asChild>
                    <Link href={actionHref ?? config.actionHref!}>
                        {actionLabel ?? config.actionLabel}
                    </Link>
                </Button>
            )}
        </div>
    )
}
