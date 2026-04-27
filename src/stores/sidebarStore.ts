'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
    isCollapsed: boolean
    toggleCollapsed: () => void
    setCollapsed: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarStore>()(
    persist(
        (set) => ({
            isCollapsed: false,
            toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
            setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
        }),
        {
            name: 'sidebar-store',
        }
    )
)
