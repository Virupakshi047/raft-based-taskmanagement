import { useMemo } from 'react'
import { useRaftStore } from '@/stores/raftStore'
import { NodeCard } from './NodeCard'
import type { NodeStatus } from '@/types'

export function ClusterVisualization() {
  const { nodes, leaderId, currentTerm, selectedNode, setSelectedNode } = useRaftStore()
  
  // Get node statuses as array
  const nodeStatuses = useMemo(() => {
    const statuses: NodeStatus[] = []
    for (let i = 1; i <= 3; i++) {
      const status = nodes.get(i)
      if (status) {
        statuses.push(status)
      } else {
        // Default status for missing nodes
        statuses.push({
          node_id: i,
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
    return statuses
  }, [nodes])
  
  // Calculate node positions in a triangle
  const nodePositions = [
    { x: 50, y: 15 },   // Top
    { x: 15, y: 75 },   // Bottom left
    { x: 85, y: 75 },   // Bottom right
  ]
  
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Raft Cluster</h2>
          <p className="text-sm text-muted-foreground">3-node consensus cluster</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Current Term: </span>
            <span className="text-indigo-400 font-mono font-bold">{currentTerm}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Leader: </span>
            <span className="text-green-400 font-mono font-bold">
              {leaderId ? `Node ${leaderId}` : 'None'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Cluster Visualization */}
      <div className="relative w-full aspect-[16/10] mb-6">
        {/* Connection Lines SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Lines connecting all nodes */}
          <line
            x1="50%" y1="20%"
            x2="20%" y2="75%"
            className={`connection-line ${leaderId ? 'active' : ''}`}
          />
          <line
            x1="50%" y1="20%"
            x2="80%" y2="75%"
            className={`connection-line ${leaderId ? 'active' : ''}`}
          />
          <line
            x1="20%" y1="75%"
            x2="80%" y2="75%"
            className={`connection-line ${leaderId ? 'active' : ''}`}
          />
        </svg>
        
        {/* Node Cards */}
        {nodeStatuses.map((status, index) => (
          <div
            key={status.node_id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${nodePositions[index].x}%`,
              top: `${nodePositions[index].y}%`,
              width: '200px'
            }}
          >
            <NodeCard
              status={status}
              isSelected={selectedNode === status.node_id}
              onClick={() => setSelectedNode(
                selectedNode === status.node_id ? null : status.node_id
              )}
            />
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-muted-foreground">Leader</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-muted-foreground">Follower</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-muted-foreground">Candidate</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-muted-foreground">Stopped</span>
        </div>
      </div>
    </div>
  )
}
