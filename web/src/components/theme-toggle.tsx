import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const STORAGE_KEY = 'greencube-theme'

function getStoredOrSystemTheme(): 'dark' | 'light' {
  const stored = localStorage.getItem(STORAGE_KEY) as 'dark' | 'light' | null
  return stored ?? getSystemTheme()
}

function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

applyTheme(getStoredOrSystemTheme())

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getStoredOrSystemTheme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        const sys = mq.matches ? 'dark' : 'light'
        setTheme(sys)
        applyTheme(sys)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }

  return (
    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={toggle}>
      {theme === 'dark' ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
    </Button>
  )
}
