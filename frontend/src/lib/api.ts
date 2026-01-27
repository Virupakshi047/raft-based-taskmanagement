import axios from 'axios'
import type { Task, ClusterStatus, RaftEvent, LogEntry } from '@/types'

// Base URLs for each node
const NODE_URLS = {
    1: 'http://localhost:8001',
    2: 'http://localhost:8002',
    3: 'http://localhost:8003',
}

// Default to node 1 (will auto-redirect if not leader)
const api = axios.create({
    baseURL: NODE_URLS[1],
    timeout: 5000,
})

// Track current leader
let currentLeaderNode = 1

export const getLeaderNode = () => currentLeaderNode

export const setLeaderNode = (nodeId: number) => {
    currentLeaderNode = nodeId
    api.defaults.baseURL = NODE_URLS[nodeId as keyof typeof NODE_URLS] || NODE_URLS[1]
}

// Task API
export const taskApi = {
    getAll: async (): Promise<Task[]> => {
        const response = await api.get('/api/tasks')
        return response.data.tasks
    },

    get: async (id: string): Promise<Task> => {
        const response = await api.get(`/api/tasks/${id}`)
        return response.data
    },

    create: async (data: { title: string; description?: string; priority?: string }): Promise<Task> => {
        try {
            const response = await api.post('/api/tasks', data)
            return response.data
        } catch (error: unknown) {
            // Handle leader redirect
            if (axios.isAxiosError(error) && error.response?.status === 307) {
                const leaderId = error.response.data.leader_id
                if (leaderId) {
                    setLeaderNode(leaderId)
                    const response = await api.post('/api/tasks', data)
                    return response.data
                }
            }
            throw error
        }
    },

    update: async (id: string, data: Partial<Task>): Promise<Task> => {
        try {
            const response = await api.put(`/api/tasks/${id}`, data)
            return response.data
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 307) {
                const leaderId = error.response.data.leader_id
                if (leaderId) {
                    setLeaderNode(leaderId)
                    const response = await api.put(`/api/tasks/${id}`, data)
                    return response.data
                }
            }
            throw error
        }
    },

    delete: async (id: string): Promise<void> => {
        try {
            await api.delete(`/api/tasks/${id}`)
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 307) {
                const leaderId = error.response.data.leader_id
                if (leaderId) {
                    setLeaderNode(leaderId)
                    await api.delete(`/api/tasks/${id}`)
                }
            }
            throw error
        }
    },
}

// Raft API
export const raftApi = {
    getClusterStatus: async (nodeId: number): Promise<ClusterStatus> => {
        const baseUrl = NODE_URLS[nodeId as keyof typeof NODE_URLS]
        const response = await axios.get(`${baseUrl}/api/raft/cluster`)
        return response.data
    },

    getNodeStatus: async (nodeId: number) => {
        const baseUrl = NODE_URLS[nodeId as keyof typeof NODE_URLS]
        const response = await axios.get(`${baseUrl}/api/raft/status`)
        return response.data
    },

    getEvents: async (nodeId: number = 1): Promise<RaftEvent[]> => {
        const baseUrl = NODE_URLS[nodeId as keyof typeof NODE_URLS]
        const response = await axios.get(`${baseUrl}/api/raft/events`)
        return response.data.events
    },

    getLog: async (nodeId: number = 1): Promise<{ memory_log: LogEntry[]; database_log: unknown[] }> => {
        const baseUrl = NODE_URLS[nodeId as keyof typeof NODE_URLS]
        const response = await axios.get(`${baseUrl}/api/raft/log`)
        return response.data
    },

    toggleNode: async (nodeId: number): Promise<{ state: string }> => {
        const baseUrl = NODE_URLS[nodeId as keyof typeof NODE_URLS]
        const response = await axios.post(`${baseUrl}/api/raft/node/${nodeId}/toggle`)
        return response.data
    },
}
