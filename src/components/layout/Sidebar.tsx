'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebarStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { FolderTree } from '@/components/shared/FolderTree'
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Workflow,
    ListTodo,
    Folder,
    Tag,
    Search,
    BarChart3,
    Settings,
    Home,
    Star,
    Archive,
    BookTemplate,
} from 'lucide-react'

const mainNavItems = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/prompts', label: 'Prompts', icon: FileText },
    { href: '/workflows', label: 'Workflows', icon: Workflow },
    { href: '/tasks', label: 'Tasks & Schedules', icon: ListTodo },
]

const organizationItems = [
    { href: '/folders', label: 'Folders', icon: Folder },
    { href: '/tags', label: 'Tags', icon: Tag },
]

const toolItems = [
    { href: '/search', label: 'Search', icon: Search },
    { href: '/templates', label: 'Templates', icon: BookTemplate },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

const quickFilters = [
    { href: '/prompts?isFavorite=true', label: 'Favorites', icon: Star },
    { href: '/archive', label: 'Archive', icon: Archive },
]

export function Sidebar() {
    const pathname = usePathname()
    const { isCollapsed, toggleCollapsed } = useSidebarStore()

    return (
        <aside
            className={cn(
                'relative flex flex-col border-r bg-background transition-all duration-300',
                isCollapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo */}
            <div className="flex h-14 items-center border-b px-4">
                {!isCollapsed && (
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <FileText className="h-4 w-4" />
                        </div>
                        <span>Prompter</span>
                    </Link>
                )}
                {isCollapsed && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground mx-auto">
                        <FileText className="h-4 w-4" />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 px-2 py-4">
                <nav className="space-y-6">
                    {/* Main Navigation */}
                    <div className="space-y-1">
                        {!isCollapsed && (
                            <h4 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Main
                            </h4>
                        )}
                        {mainNavItems.map((item) => (
                            <NavItem
                                key={item.href}
                                {...item}
                                isActive={pathname === item.href}
                                isCollapsed={isCollapsed}
                            />
                        ))}
                    </div>

                    <Separator />

                    {/* Organization */}
                    <div className="space-y-1">
                        {!isCollapsed && (
                            <h4 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Organization
                            </h4>
                        )}
                        {organizationItems.map((item) => (
                            <NavItem
                                key={item.href}
                                {...item}
                                isActive={pathname === item.href}
                                isCollapsed={isCollapsed}
                            />
                        ))}
                    </div>

                    <Separator />

                    {/* Folder Tree */}
                    {!isCollapsed && <FolderTree collapsed={isCollapsed} />}

                    <Separator />

                    {/* Tools */}
                    <div className="space-y-1">
                        {!isCollapsed && (
                            <h4 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Tools
                            </h4>
                        )}
                        {toolItems.map((item) => (
                            <NavItem
                                key={item.href}
                                {...item}
                                isActive={pathname === item.href}
                                isCollapsed={isCollapsed}
                            />
                        ))}
                    </div>

                    <Separator />

                    {/* Quick Filters */}
                    <div className="space-y-1">
                        {!isCollapsed && (
                            <h4 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Quick Filters
                            </h4>
                        )}
                        {quickFilters.map((item) => (
                            <NavItem
                                key={item.href}
                                {...item}
                                isActive={pathname === item.href}
                                isCollapsed={isCollapsed}
                            />
                        ))}
                    </div>
                </nav>
            </ScrollArea>

            {/* Settings & Collapse */}
            <div className="border-t p-2">
                <NavItem
                    href="/settings"
                    label="Settings"
                    icon={Settings}
                    isActive={pathname === '/settings'}
                    isCollapsed={isCollapsed}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleCollapsed}
                    className={cn('w-full mt-2', isCollapsed ? 'justify-center' : 'justify-start')}
                >
                    {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <>
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            Collapse
                        </>
                    )}
                </Button>
            </div>
        </aside>
    )
}

interface NavItemProps {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    isActive: boolean
    isCollapsed: boolean
}

function NavItem({ href, label, icon: Icon, isActive, isCollapsed }: NavItemProps) {
    return (
        <Link
            href={href}
            className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                isCollapsed && 'justify-center px-2'
            )}
            title={isCollapsed ? label : undefined}
        >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span>{label}</span>}
        </Link>
    )
}
