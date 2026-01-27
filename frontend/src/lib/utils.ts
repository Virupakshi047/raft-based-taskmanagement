import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleTimeString()
}

export function getNodeColor(state: string): string {
    switch (state) {
        case 'leader':
            return 'var(--leader)'
        case 'follower':
            return 'var(--follower)'
        case 'candidate':
            return 'var(--candidate)'
        case 'stopped':
            return 'var(--stopped)'
        default:
            return 'var(--muted)'
    }
}

export function getStateBgClass(state: string): string {
    switch (state) {
        case 'leader':
            return 'bg-green-500/20 text-green-400 border-green-500/30'
        case 'follower':
            return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        case 'candidate':
            return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        case 'stopped':
            return 'bg-red-500/20 text-red-400 border-red-500/30'
        default:
            return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
}
