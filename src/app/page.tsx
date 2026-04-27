import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FileText, Workflow, Folder, Tag, Plus, TrendingUp, Clock, Star, Pin } from 'lucide-react'
import prisma from '@/lib/prisma'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { AnalyticsTrends } from '@/components/shared/AnalyticsTrends'

async function getDashboardStats() {
  const [promptCount, workflowCount, folderCount, tagCount, recentPrompts, favoritePrompts, pinnedPrompts] =
    await Promise.all([
      prisma.prompt.count({ where: { isArchived: false } }),
      prisma.workflow.count({ where: { isArchived: false } }),
      prisma.folder.count(),
      prisma.tag.count(),
      prisma.prompt.findMany({
        where: { isArchived: false },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { folder: true, tags: { include: { tag: true } } },
      }),
      prisma.prompt.findMany({
        where: { isFavorite: true, isArchived: false },
        orderBy: { usageCount: 'desc' },
        take: 5,
        include: { folder: true },
      }),
      prisma.prompt.findMany({
        where: { isPinned: true, isArchived: false },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: { folder: true },
      }),
    ])

  return { promptCount, workflowCount, folderCount, tagCount, recentPrompts, favoritePrompts, pinnedPrompts }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />
      <div className="flex-1 p-6 space-y-6">
        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/prompts/new">
              <Plus className="mr-2 h-4 w-4" />
              New Prompt
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/workflows/new">
              <Plus className="mr-2 h-4 w-4" />
              New Workflow
            </Link>
          </Button>
        </div>

        {/* Pinned Prompts */}
        {stats.pinnedPrompts.length > 0 && (
          <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Pin className="h-4 w-4 text-blue-500" />
                Pinned Prompts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap">
                {stats.pinnedPrompts.map((prompt) => (
                  <Link
                    key={prompt.id}
                    href={`/prompts/${prompt.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background hover:bg-accent transition-colors border"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{prompt.title}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Prompts"
            value={stats.promptCount}
            icon={FileText}
            href="/prompts"
          />
          <StatsCard
            title="Workflows"
            value={stats.workflowCount}
            icon={Workflow}
            href="/workflows"
          />
          <StatsCard
            title="Folders"
            value={stats.folderCount}
            icon={Folder}
            href="/folders"
          />
          <StatsCard
            title="Tags"
            value={stats.tagCount}
            icon={Tag}
            href="/tags"
          />
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Prompts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-medium">
                  <Clock className="inline-block mr-2 h-4 w-4 text-muted-foreground" />
                  Recent Prompts
                </CardTitle>
                <CardDescription>Your recently updated prompts</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/prompts">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {stats.recentPrompts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No prompts yet. Create your first one!
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.recentPrompts.map((prompt) => (
                    <Link
                      key={prompt.id}
                      href={`/prompts/${prompt.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{prompt.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {prompt.folder?.name ?? 'No folder'} •{' '}
                          {new Date(prompt.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {prompt.isFavorite && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 ml-2" />
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Favorite Prompts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-medium">
                  <Star className="inline-block mr-2 h-4 w-4 text-yellow-500" />
                  Favorite Prompts
                </CardTitle>
                <CardDescription>Your most used favorites</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/prompts?isFavorite=true">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {stats.favoritePrompts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No favorite prompts yet. Star some prompts!
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.favoritePrompts.map((prompt) => (
                    <Link
                      key={prompt.id}
                      href={`/prompts/${prompt.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{prompt.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {prompt.folder?.name ?? 'No folder'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {prompt.usageCount} uses
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analytics Trends */}
          <AnalyticsTrends />

          {/* Activity Feed */}
          <ActivityFeed limit={8} />
        </div>
      </div>
    </div>
  )
}

function StatsCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  href: string
}) {
  return (
    <Link href={href}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </Link>
  )
}
