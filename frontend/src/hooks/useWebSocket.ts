import { useEffect, useRef, useCallback } from 'react'
import { useRaftStore } from '@/stores/raftStore'
import type { NodeStatus } from '@/types'

export function useWebSocket(nodeId: number = 1) {
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<number | null>(null)

    const { updateNodeStatus, addEvent, setWsConnected } = useRaftStore()

    const connect = useCallback(() => {
        const ws = new WebSocket(`ws://localhost:800${nodeId}/ws/raft`)
        wsRef.current = ws

        ws.onopen = () => {
            console.log(`WebSocket connected to node ${nodeId}`)
            setWsConnected(true)
        }

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data)

            if (data.type === 'initial_status' || data.type === 'status_update') {
                const status = data.data as NodeStatus
                updateNodeStatus(status.node_id, status)
            } else if (data.type === 'event') {
                addEvent(data.data)
            }
        }

        ws.onclose = () => {
            console.log(`WebSocket disconnected from node ${nodeId}`)
            setWsConnected(false)

            // Attempt reconnect after 2 seconds
            reconnectTimeoutRef.current = window.setTimeout(() => {
                connect()
            }, 2000)
        }

        ws.onerror = (error) => {
            console.error('WebSocket error:', error)
        }
    }, [nodeId, updateNodeStatus, addEvent, setWsConnected])

    useEffect(() => {
        connect()

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
            if (wsRef.current) {
                wsRef.current.close()
            }
        }
    }, [connect])

    const sendMessage = useCallback((type: string, data?: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data }))
        }
    }, [])

    return { sendMessage }
}
