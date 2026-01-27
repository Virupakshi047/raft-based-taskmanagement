import { create } from 'zustand'
import type { NodeStatus, RaftEvent, LogEntry, Task } from '@/types'
import { setLeaderNode } from '@/lib/api'

interface RaftStore {
    // Node statuses (one per node in cluster)
    nodes: Map<number, NodeStatus>

    // Current leader ID
    leaderId: number | null

    // Current term
    currentTerm: number

    // Raft events for timeline
    events: RaftEvent[]

    // Raft log entries
    logEntries: LogEntry[]

    // Tasks
    tasks: Task[]

    // WebSocket connection status
    wsConnected: boolean

    // Selected node for detail view
    selectedNode: number | null

    // Actions
    updateNodeStatus: (nodeId: number, status: NodeStatus) => void
    addEvent: (event: RaftEvent) => void
    setEvents: (events: RaftEvent[]) => void
    setLogEntries: (entries: LogEntry[]) => void
    setTasks: (tasks: Task[]) => void
    addTask: (task: Task) => void
    updateTask: (task: Task) => void
    removeTask: (taskId: string) => void
    setWsConnected: (connected: boolean) => void
    setSelectedNode: (nodeId: number | null) => void
    setLeaderId: (leaderId: number | null) => void
    setCurrentTerm: (term: number) => void
}

export const useRaftStore = create<RaftStore>((set) => ({
    nodes: new Map(),
    leaderId: null,
    currentTerm: 0,
    events: [],
    logEntries: [],
    tasks: [],
    wsConnected: false,
    selectedNode: null,

    updateNodeStatus: (nodeId, status) =>
        set((state) => {
            const newNodes = new Map(state.nodes)
            newNodes.set(nodeId, status)

            // If this node is the leader, update API client
            if (status.is_leader && nodeId !== state.leaderId) {
                setLeaderNode(nodeId)
            }

            return {
                nodes: newNodes,
                leaderId: status.is_leader ? nodeId : state.leaderId,
                currentTerm: Math.max(state.currentTerm, status.term)
            }
        }),

    addEvent: (event) =>
        set((state) => ({
            events: [...state.events.slice(-99), event]
        })),

    setEvents: (events) =>
        set({ events }),

    setLogEntries: (entries) =>
        set({ logEntries: entries }),

    setTasks: (tasks) =>
        set({ tasks }),

    addTask: (task) =>
        set((state) => ({
            tasks: [...state.tasks, task]
        })),

    updateTask: (task) =>
        set((state) => ({
            tasks: state.tasks.map((t) => (t.id === task.id ? task : t))
        })),

    removeTask: (taskId) =>
        set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== taskId)
        })),

    setWsConnected: (connected) =>
        set({ wsConnected: connected }),

    setSelectedNode: (nodeId) =>
        set({ selectedNode: nodeId }),

    setLeaderId: (leaderId) =>
        set({ leaderId }),

    setCurrentTerm: (term) =>
        set({ currentTerm: term }),
}))
