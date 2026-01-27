import { useEffect, useCallback } from 'react'
import { useRaftStore } from '@/stores/raftStore'
import { raftApi } from '@/lib/api'

export function useRaftStatus() {
    const {
        updateNodeStatus,
        setEvents,
        setLogEntries,
        nodes,
        leaderId,
        currentTerm,
        events,
        logEntries
    } = useRaftStore()

    const fetchAllNodeStatuses = useCallback(async () => {
        // Fetch status from all 3 nodes
        for (let nodeId = 1; nodeId <= 3; nodeId++) {
            try {
                const status = await raftApi.getNodeStatus(nodeId)
                updateNodeStatus(nodeId, status)
            } catch (error) {
                // Node might be down, mark as stopped
                updateNodeStatus(nodeId, {
                    node_id: nodeId,
                    state: 'stopped',
                    term: 0,
                    voted_for: null,
                    log_length: 0,
                    commit_index: 0,
                    last_heartbeat: 0,
                    is_leader: false,
                    leader_id: null
                })
            }
        }
    }, [updateNodeStatus])

    const fetchEvents = useCallback(async () => {
        try {
            const activeNode = leaderId || 1
            const events = await raftApi.getEvents(activeNode)
            setEvents(events)
        } catch (error) {
            console.error('Failed to fetch events:', error)
        }
    }, [leaderId, setEvents])

    const fetchLog = useCallback(async () => {
        try {
            const activeNode = leaderId || 1
            const data = await raftApi.getLog(activeNode)
            setLogEntries(data.memory_log)
        } catch (error) {
            console.error('Failed to fetch log:', error)
        }
    }, [leaderId, setLogEntries])

    // Poll for status updates every 3s
    useEffect(() => {
        fetchAllNodeStatuses()
        const interval = setInterval(fetchAllNodeStatuses, 3000)
        return () => clearInterval(interval)
    }, [fetchAllNodeStatuses])

    // Fetch events and logs every 5s
    useEffect(() => {
        fetchEvents()
        fetchLog()
        const interval = setInterval(() => {
            fetchEvents()
            fetchLog()
        }, 5000)
        return () => clearInterval(interval)
    }, [fetchEvents, fetchLog])

    return {
        nodes,
        leaderId,
        currentTerm,
        events,
        logEntries,
        refetch: fetchAllNodeStatuses
    }
}
