'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Settings, Palette, Type, Save, Loader2, Lock, LogOut, RotateCcw, Database } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'
import { DuplicateDetector } from '@/components/shared/DuplicateDetector'
import { parseKanbanSettingsPayload } from '@/lib/kanban/settings-defaults'
import type { KanbanSettingsInput } from '@/lib/validators'

interface SettingsData {
    id: string
    theme: string
    defaultAiModel: string | null
    customAiModels: string | null
    sidebarCollapsed: boolean
    editorFontSize: number
    autoSaveInterval: number
    kanban: KanbanSettingsInput
}

interface CustomAiModel {
    value: string
    label: string
}

const AI_MODELS = [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
    { value: 'gemini-pro', label: 'Gemini Pro' },
    { value: 'gemini-ultra', label: 'Gemini Ultra' },
]

export default function SettingsPage() {
    const { setTheme } = useTheme()
    const { username, logout } = useAuth()
    const [settings, setSettings] = useState<SettingsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [resettingUsage, setResettingUsage] = useState(false)
    const [customModels, setCustomModels] = useState<CustomAiModel[]>([])
    const [newModelValue, setNewModelValue] = useState('')
    const [newModelLabel, setNewModelLabel] = useState('')
    const [recognizedExtensionsInput, setRecognizedExtensionsInput] = useState('')
    const [desktopNotificationPermission, setDesktopNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [changingPassword, setChangingPassword] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setDesktopNotificationPermission(Notification.permission)
        } else {
            setDesktopNotificationPermission('unsupported')
        }
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings')
            const data = await res.json() as Partial<SettingsData> & { kanban?: unknown }
            const normalizedKanbanSettings = parseKanbanSettingsPayload(data.kanban)
            const normalizedSettings: SettingsData = {
                id: data.id || 'settings',
                theme: data.theme || 'system',
                defaultAiModel: data.defaultAiModel ?? null,
                customAiModels: data.customAiModels ?? null,
                sidebarCollapsed: data.sidebarCollapsed ?? false,
                editorFontSize: data.editorFontSize ?? 14,
                autoSaveInterval: data.autoSaveInterval ?? 30,
                kanban: normalizedKanbanSettings,
            }
            setSettings(normalizedSettings)
            setRecognizedExtensionsInput(normalizedKanbanSettings.recognizedExtensions.join(', '))
            // Parse custom models from JSON
            if (data.customAiModels) {
                try {
                    setCustomModels(JSON.parse(data.customAiModels))
                } catch {
                    setCustomModels([])
                }
            }
        } catch {
            toast.error('Failed to load settings')
        } finally {
            setLoading(false)
        }
    }

    const saveSettings = async () => {
        if (!settings) return

        const parsedRecognizedExtensions = parseRecognizedExtensionsInput(recognizedExtensionsInput)
        if (parsedRecognizedExtensions.length === 0) {
            toast.error('Enter at least one valid recognized extension (for example: .sh, .py)')
            return
        }

        const kanbanSettingsPayload: KanbanSettingsInput = {
            ...settings.kanban,
            recognizedExtensions: parsedRecognizedExtensions,
        }

        setSaving(true)
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    theme: settings.theme,
                    defaultAiModel: settings.defaultAiModel,
                    customAiModels: JSON.stringify(customModels),
                    editorFontSize: settings.editorFontSize,
                    autoSaveInterval: settings.autoSaveInterval,
                    kanban: kanbanSettingsPayload,
                }),
            })

            if (!res.ok) throw new Error('Failed to save')

            const savedSettings = await res.json() as Partial<SettingsData> & { kanban?: unknown }
            const normalizedKanbanSettings = parseKanbanSettingsPayload(savedSettings.kanban ?? kanbanSettingsPayload)
            setSettings((previous) => (
                previous
                    ? {
                        ...previous,
                        ...savedSettings,
                        kanban: normalizedKanbanSettings,
                    }
                    : null
            ))
            setRecognizedExtensionsInput(normalizedKanbanSettings.recognizedExtensions.join(', '))

            // Sync theme with next-themes
            setTheme(settings.theme)
            toast.success('Settings saved successfully')
        } catch {
            toast.error('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    const changePassword = async () => {
        if (!currentPassword || !newPassword) {
            toast.error('Please fill in all password fields')
            return
        }

        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match')
            return
        }

        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }

        setChangingPassword(true)
        try {
            const res = await fetch('/api/auth/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to change password')
            }

            toast.success('Password changed successfully')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to change password')
        } finally {
            setChangingPassword(false)
        }
    }

    const resetAllUsageCounts = async () => {
        if (!confirm('Reset usage counts for ALL prompts to 0? This cannot be undone.')) return

        setResettingUsage(true)
        try {
            const res = await fetch('/api/settings/reset-usage', {
                method: 'POST',
            })

            if (!res.ok) throw new Error('Failed to reset')

            const data = await res.json()
            toast.success(`Reset usage counts for ${data.count} prompts`)
        } catch {
            toast.error('Failed to reset usage counts')
        } finally {
            setResettingUsage(false)
        }
    }

    const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : null))
    }

    const updateKanbanSetting = <K extends keyof KanbanSettingsInput>(
        key: K,
        value: KanbanSettingsInput[K],
    ) => {
        setSettings((prev) => (
            prev
                ? {
                    ...prev,
                    kanban: {
                        ...prev.kanban,
                        [key]: value,
                    },
                }
                : null
        ))
    }

    const updateKanbanExecutionSetting = <K extends keyof KanbanSettingsInput['execution']>(
        key: K,
        value: KanbanSettingsInput['execution'][K],
    ) => {
        setSettings((prev) => (
            prev
                ? {
                    ...prev,
                    kanban: {
                        ...prev.kanban,
                        execution: {
                            ...prev.kanban.execution,
                            [key]: value,
                        },
                    },
                }
                : null
        ))
    }

    const updateKanbanNotificationSetting = <K extends keyof KanbanSettingsInput['notifications']>(
        key: K,
        value: KanbanSettingsInput['notifications'][K],
    ) => {
        setSettings((prev) => (
            prev
                ? {
                    ...prev,
                    kanban: {
                        ...prev.kanban,
                        notifications: {
                            ...prev.kanban.notifications,
                            [key]: value,
                        },
                    },
                }
                : null
        ))
    }

    const updateKanbanUiSetting = <K extends keyof KanbanSettingsInput['ui']>(
        key: K,
        value: KanbanSettingsInput['ui'][K],
    ) => {
        setSettings((prev) => (
            prev
                ? {
                    ...prev,
                    kanban: {
                        ...prev.kanban,
                        ui: {
                            ...prev.kanban.ui,
                            [key]: value,
                        },
                    },
                }
                : null
        ))
    }

    const requestDesktopNotificationPermission = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            toast.error('Desktop notifications are not supported in this browser')
            return
        }

        try {
            const permission = await Notification.requestPermission()
            setDesktopNotificationPermission(permission)
            if (permission === 'granted') {
                toast.success('Desktop notifications enabled')
            } else {
                toast.error('Desktop notifications were not granted')
            }
        } catch {
            toast.error('Failed to request desktop notification permission')
        }
    }

    const addCustomModel = () => {
        if (!newModelValue.trim() || !newModelLabel.trim()) {
            toast.error('Both value and label are required')
            return
        }
        if (customModels.some((m) => m.value === newModelValue)) {
            toast.error('Model with this value already exists')
            return
        }
        setCustomModels((prev) => [...prev, { value: newModelValue, label: newModelLabel }])
        setNewModelValue('')
        setNewModelLabel('')
        toast.success('Model added - save settings to persist')
    }

    const removeCustomModel = (value: string) => {
        setCustomModels((prev) => prev.filter((m) => m.value !== value))
        toast.success('Model removed - save settings to persist')
    }

    const allModels = [...AI_MODELS, ...customModels]

    if (!mounted || loading) {
        return (
            <div className="flex flex-col h-full">
                <Header title="Settings" />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <Header title="Settings" />
            <div className="flex-1 p-6 space-y-6 overflow-auto">
                {/* Account Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5" />
                            Account
                        </CardTitle>
                        <CardDescription>
                            Logged in as <strong>{username}</strong>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password (min 6 characters)"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={changePassword} disabled={changingPassword}>
                                {changingPassword ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Changing...
                                    </>
                                ) : (
                                    'Change Password'
                                )}
                            </Button>
                            <Button variant="outline" onClick={logout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Theme Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="h-5 w-5" />
                            Appearance
                        </CardTitle>
                        <CardDescription>Customize the look and feel of Prompter</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="theme">Theme</Label>
                            <Select
                                value={settings?.theme || 'system'}
                                onValueChange={(value) => updateSetting('theme', value)}
                            >
                                <SelectTrigger id="theme">
                                    <SelectValue placeholder="Select theme" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="light">Light</SelectItem>
                                    <SelectItem value="dark">Dark</SelectItem>
                                    <SelectItem value="system">System</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Choose between light, dark, or system theme
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Editor Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Type className="h-5 w-5" />
                            Editor
                        </CardTitle>
                        <CardDescription>Configure the prompt editor behavior</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fontSize">Font Size: {settings?.editorFontSize || 14}px</Label>
                            <Input
                                id="fontSize"
                                type="range"
                                min={10}
                                max={24}
                                value={settings?.editorFontSize || 14}
                                onChange={(e) => updateSetting('editorFontSize', parseInt(e.target.value))}
                                className="cursor-pointer"
                            />
                            <p className="text-xs text-muted-foreground">
                                Adjust the editor font size (10-24px)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="autoSave">Auto-save Interval: {settings?.autoSaveInterval || 30}s</Label>
                            <Input
                                id="autoSave"
                                type="range"
                                min={5}
                                max={300}
                                step={5}
                                value={settings?.autoSaveInterval || 30}
                                onChange={(e) => updateSetting('autoSaveInterval', parseInt(e.target.value))}
                                className="cursor-pointer"
                            />
                            <p className="text-xs text-muted-foreground">
                                How often to auto-save your work (5-300 seconds)
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Default AI Model */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Defaults
                        </CardTitle>
                        <CardDescription>Set default values for new prompts</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="defaultModel">Default AI Model</Label>
                            <Select
                                value={settings?.defaultAiModel || 'none'}
                                onValueChange={(value) => updateSetting('defaultAiModel', value === 'none' ? null : value)}
                            >
                                <SelectTrigger id="defaultModel">
                                    <SelectValue placeholder="No default model" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No default</SelectItem>
                                    {allModels.map((model) => (
                                        <SelectItem key={model.value} value={model.value}>
                                            {model.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Pre-select an AI model when creating new prompts
                            </p>
                        </div>

                        {/* Custom AI Models */}
                        <div className="space-y-3 pt-4 border-t">
                            <Label>Custom AI Models</Label>
                            <p className="text-xs text-muted-foreground">
                                Add your own AI models to the dropdown list
                            </p>

                            {customModels.length > 0 && (
                                <div className="space-y-2">
                                    {customModels.map((model) => (
                                        <div key={model.value} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                            <div>
                                                <span className="font-medium">{model.label}</span>
                                                <span className="text-xs text-muted-foreground ml-2">({model.value})</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeCustomModel(model.value)}
                                                className="h-7 text-destructive hover:text-destructive"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    placeholder="Model ID (e.g. gpt-4-turbo)"
                                    value={newModelValue}
                                    onChange={(e) => setNewModelValue(e.target.value)}
                                />
                                <Input
                                    placeholder="Display name"
                                    value={newModelLabel}
                                    onChange={(e) => setNewModelLabel(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={addCustomModel}>
                                Add Model
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Kanban Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Kanban Runtime
                        </CardTitle>
                        <CardDescription>
                            Configure task watcher, runtime defaults, logs, and notification behavior.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="kanban-watch-directory">Watch Directory</Label>
                            <Input
                                id="kanban-watch-directory"
                                value={settings?.kanban.watchDirectory || ''}
                                onChange={(event) => updateKanbanSetting('watchDirectory', event.target.value)}
                                placeholder="~/scripts"
                            />
                            <p className="text-xs text-muted-foreground">
                                Script watcher scans this directory and syncs files into the Backlog column.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="kanban-recognized-extensions">Recognized Extensions</Label>
                            <Input
                                id="kanban-recognized-extensions"
                                value={recognizedExtensionsInput}
                                onChange={(event) => setRecognizedExtensionsInput(event.target.value)}
                                placeholder=".sh, .py, .ts"
                            />
                            <p className="text-xs text-muted-foreground">
                                Comma-separated extensions (include a leading dot).
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="kanban-default-timeout">Default Timeout (seconds)</Label>
                                <Input
                                    id="kanban-default-timeout"
                                    type="number"
                                    min={1}
                                    max={3600}
                                    value={settings?.kanban.execution.defaultTimeout || 300}
                                    onChange={(event) => (
                                        updateKanbanExecutionSetting('defaultTimeout', toInteger(event.target.value))
                                    )}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kanban-grace-period">Grace Period (seconds)</Label>
                                <Input
                                    id="kanban-grace-period"
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={settings?.kanban.execution.gracePeriod || 10}
                                    onChange={(event) => (
                                        updateKanbanExecutionSetting('gracePeriod', toInteger(event.target.value))
                                    )}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <p className="text-sm font-medium">Default Retry on Failure</p>
                                <p className="text-xs text-muted-foreground">
                                    Apply retry policy defaults when task configs omit retry fields.
                                </p>
                            </div>
                            <Switch
                                checked={settings?.kanban.execution.defaultRetryOnFail || false}
                                onCheckedChange={(checked) => (
                                    updateKanbanExecutionSetting('defaultRetryOnFail', checked)
                                )}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="kanban-default-max-retries">Default Max Retries</Label>
                                <Input
                                    id="kanban-default-max-retries"
                                    type="number"
                                    min={0}
                                    max={5}
                                    value={settings?.kanban.execution.defaultMaxRetries || 0}
                                    onChange={(event) => (
                                        updateKanbanExecutionSetting('defaultMaxRetries', toInteger(event.target.value))
                                    )}
                                    disabled={!settings?.kanban.execution.defaultRetryOnFail}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kanban-default-retry-delay">Default Retry Delay (seconds)</Label>
                                <Input
                                    id="kanban-default-retry-delay"
                                    type="number"
                                    min={0}
                                    max={3600}
                                    value={settings?.kanban.execution.defaultRetryDelay || 0}
                                    onChange={(event) => (
                                        updateKanbanExecutionSetting('defaultRetryDelay', toInteger(event.target.value))
                                    )}
                                    disabled={!settings?.kanban.execution.defaultRetryOnFail}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="kanban-max-log-file">Max Log File Size</Label>
                                <Input
                                    id="kanban-max-log-file"
                                    value={settings?.kanban.execution.maxLogFileSize || '10MB'}
                                    onChange={(event) => (
                                        updateKanbanExecutionSetting('maxLogFileSize', event.target.value)
                                    )}
                                    placeholder="10MB"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kanban-max-log-storage">Max Total Log Storage</Label>
                                <Input
                                    id="kanban-max-log-storage"
                                    value={settings?.kanban.execution.maxTotalLogStorage || '1GB'}
                                    onChange={(event) => (
                                        updateKanbanExecutionSetting('maxTotalLogStorage', event.target.value)
                                    )}
                                    placeholder="1GB"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="kanban-live-log-lines">Live Log Line Limit</Label>
                                <Input
                                    id="kanban-live-log-lines"
                                    type="number"
                                    min={100}
                                    max={5000}
                                    value={settings?.kanban.execution.liveLogLineLimit || 1000}
                                    onChange={(event) => (
                                        updateKanbanExecutionSetting('liveLogLineLimit', toInteger(event.target.value))
                                    )}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 border-t pt-4">
                            <div className="flex items-center justify-between rounded-md border p-3">
                                <div>
                                    <p className="text-sm font-medium">In-App Notifications</p>
                                    <p className="text-xs text-muted-foreground">
                                        Show toast notifications for runtime events in the Tasks page.
                                    </p>
                                </div>
                                <Switch
                                    checked={settings?.kanban.notifications.inApp || false}
                                    onCheckedChange={(checked) => (
                                        updateKanbanNotificationSetting('inApp', checked)
                                    )}
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-md border p-3">
                                <div>
                                    <p className="text-sm font-medium">Desktop Notifications</p>
                                    <p className="text-xs text-muted-foreground">
                                        Permission: {desktopNotificationPermission}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={settings?.kanban.notifications.desktop || false}
                                        onCheckedChange={(checked) => (
                                            updateKanbanNotificationSetting('desktop', checked)
                                        )}
                                        disabled={desktopNotificationPermission === 'unsupported'}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void requestDesktopNotificationPermission()}
                                        disabled={desktopNotificationPermission === 'unsupported'}
                                    >
                                        Request
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <NotificationToggle
                                    label="Execution completed"
                                    checked={settings?.kanban.notifications.onTaskCompleted || false}
                                    onCheckedChange={(checked) => (
                                        updateKanbanNotificationSetting('onTaskCompleted', checked)
                                    )}
                                />
                                <NotificationToggle
                                    label="Sound cues"
                                    checked={settings?.kanban.notifications.sound || false}
                                    onCheckedChange={(checked) => (
                                        updateKanbanNotificationSetting('sound', checked)
                                    )}
                                />
                                <NotificationToggle
                                    label="Execution failed"
                                    checked={settings?.kanban.notifications.onTaskFailed || false}
                                    onCheckedChange={(checked) => (
                                        updateKanbanNotificationSetting('onTaskFailed', checked)
                                    )}
                                />
                                <NotificationToggle
                                    label="Queue empty"
                                    checked={settings?.kanban.notifications.onQueueEmpty || false}
                                    onCheckedChange={(checked) => (
                                        updateKanbanNotificationSetting('onQueueEmpty', checked)
                                    )}
                                />
                                <NotificationToggle
                                    label="Dependency blocked"
                                    checked={settings?.kanban.notifications.onDependencyBlocked || false}
                                    onCheckedChange={(checked) => (
                                        updateKanbanNotificationSetting('onDependencyBlocked', checked)
                                    )}
                                />
                                <NotificationToggle
                                    label="Script changes"
                                    checked={settings?.kanban.notifications.onScriptChanged || false}
                                    onCheckedChange={(checked) => (
                                        updateKanbanNotificationSetting('onScriptChanged', checked)
                                    )}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 border-t pt-4">
                            <p className="text-sm font-medium">Tasks UI Behavior</p>
                            <NotificationToggle
                                label="Auto-scroll live logs"
                                checked={settings?.kanban.ui.autoScrollLogs || false}
                                onCheckedChange={(checked) => (
                                    updateKanbanUiSetting('autoScrollLogs', checked)
                                )}
                            />
                            <NotificationToggle
                                label="Auto-select running execution log"
                                checked={settings?.kanban.ui.autoSelectRunningLog || false}
                                onCheckedChange={(checked) => (
                                    updateKanbanUiSetting('autoSelectRunningLog', checked)
                                )}
                            />
                            <div className="space-y-2">
                                <Label htmlFor="kanban-terminal-font-size">
                                    Terminal Font Size: {settings?.kanban.ui.terminalFontSize || 14}px
                                </Label>
                                <Input
                                    id="kanban-terminal-font-size"
                                    type="range"
                                    min={10}
                                    max={24}
                                    value={settings?.kanban.ui.terminalFontSize || 14}
                                    onChange={(event) => (
                                        updateKanbanUiSetting('terminalFontSize', toInteger(event.target.value))
                                    )}
                                    className="cursor-pointer"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Data Management */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            Data Management
                        </CardTitle>
                        <CardDescription>Manage your prompt data and statistics</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Export Data</Label>
                                <p className="text-xs text-muted-foreground">
                                    Export all prompts, workflows, folders, and tags
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => window.open('/api/export?format=json', '_blank')}
                                >
                                    Export JSON
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => window.open('/api/export?format=yaml', '_blank')}
                                >
                                    Export YAML
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Reset Usage Counts</Label>
                                <p className="text-xs text-muted-foreground">
                                    Reset usage counts for all prompts to 0
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={resetAllUsageCounts}
                                disabled={resettingUsage}
                            >
                                {resettingUsage ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting...
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Reset All
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Duplicate Detection */}
                <DuplicateDetector />

                {/* Save Button */}
                <Button onClick={saveSettings} disabled={saving} className="w-full">
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Settings
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}

interface NotificationToggleProps {
    label: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}

function NotificationToggle({ label, checked, onCheckedChange }: NotificationToggleProps) {
    return (
        <div className="flex items-center justify-between rounded-md border p-3">
            <p className="text-sm font-medium">{label}</p>
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    )
}

function parseRecognizedExtensionsInput(rawValue: string): string[] {
    const uniqueExtensions = new Set<string>()

    for (const candidate of rawValue.split(',')) {
        const trimmedCandidate = candidate.trim().toLowerCase()
        if (!trimmedCandidate) {
            continue
        }

        const normalized = trimmedCandidate.startsWith('.') ? trimmedCandidate : `.${trimmedCandidate}`
        if (!/^\.[a-z0-9]+$/i.test(normalized)) {
            continue
        }

        uniqueExtensions.add(normalized)
    }

    return Array.from(uniqueExtensions)
}

function toInteger(value: string): number {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
}
