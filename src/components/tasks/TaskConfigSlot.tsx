import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { KanbanTask } from '@/components/tasks/types'
import { TaskConfigPanel } from '@/components/tasks/TaskConfigPanel'

interface TaskConfigSlotProps {
    task: KanbanTask | null
    children?: ReactNode
}

export function TaskConfigSlot({ task, children }: TaskConfigSlotProps) {
    if (children) {
        return <>{children}</>
    }

    if (task) {
        return <TaskConfigPanel taskId={task.id} />
    }

    return (
        <Card className="h-fit xl:sticky xl:top-20">
            <CardHeader>
                <CardTitle>Task Configuration</CardTitle>
                <CardDescription>
                    Select a task card to view configuration details.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                    Configuration tabs include tool/model, prompt variables, execution, and dependencies.
                </p>
                <div className="flex items-center gap-2">
                    <Badge variant="outline">Reusable Panel</Badge>
                    <Badge variant="secondary">Board-ready</Badge>
                </div>
            </CardContent>
        </Card>
    )
}
