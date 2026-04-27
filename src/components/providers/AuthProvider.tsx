'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface AuthContextType {
    isAuthenticated: boolean
    username: string | null
    loading: boolean
    logout: () => Promise<void>
    refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    username: null,
    loading: true,
    logout: async () => { },
    refreshAuth: async () => { },
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [username, setUsername] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const checkAuth = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/login')
            const data = await res.json()

            setIsAuthenticated(data.authenticated)
            setUsername(data.username || null)

            // Redirect to login if not authenticated and not on login page
            if (!data.authenticated && pathname !== '/login') {
                router.push('/login')
            }
        } catch {
            setIsAuthenticated(false)
            setUsername(null)
            if (pathname !== '/login') {
                router.push('/login')
            }
        } finally {
            setLoading(false)
        }
    }, [pathname, router])

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            setIsAuthenticated(false)
            setUsername(null)
            router.push('/login')
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }

    const refreshAuth = checkAuth

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    return (
        <AuthContext.Provider value={{ isAuthenticated, username, loading, logout, refreshAuth }}>
            {children}
        </AuthContext.Provider>
    )
}
