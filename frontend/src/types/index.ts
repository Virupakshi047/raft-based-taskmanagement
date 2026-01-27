// Types for Raft state

export type NodeState = 'leader' | 'follower' | 'candidate' | 'stopped'
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface NodeStatus {
    node_id: number
    state: NodeState
    term: number
    voted_for: number | null
    log_length: number
    commit_index: number
    last_heartbeat: number
    is_leader: boolean
    leader_id: number | null
}

export interface RaftEvent {
    timestamp: number
    event_type: string
    node_id: number
    term: number
    details: Record<string, unknown>
}

export interface LogEntry {
    index: number
    term: number
    key: string
    value: unknown
    timestamp: number
}

export interface Task {
    id: string
    title: string
    description: string | null
    status: TaskStatus
    priority: TaskPriority
    created_at: string
    updated_at: string
    created_by_node: number | null
    log_index: number | null
}

export interface ClusterStatus {
    this_node: NodeStatus
    cluster_nodes: string[]
    leader_id: number | null
    term: number
}
