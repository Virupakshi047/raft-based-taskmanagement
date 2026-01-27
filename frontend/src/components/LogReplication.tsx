import { useMemo, useState, useEffect } from 'react'
import { useRaftStore } from '@/stores/raftStore'
import { cn } from '@/lib/utils'
import { FileText, Check, Clock, Server } from 'lucide-react'
import axios from 'axios'

interface NodeLog {
  index: number
  term: number
  key: string
  timestamp: number
  replication?: Record<string, boolean>
}

export function LogReplication() {
  const { nodes } = useRaftStore()
  const [nodeLogs, setNodeLogs] = useState<Map<number, NodeLog[]>>(new Map())
  const [selectedView, setSelectedView] = useState<'combined' | 'individual'>('combined')
  
  // Fetch logs from all nodes
  useEffect(() => {
    const fetchAllLogs = async () => {
      const newLogs = new Map<number, NodeLog[]>()
      
      for (const nodeId of [1, 2, 3]) {
        try {
          const resp = await axios.get(`http://localhost:800${nodeId}/api/raft/log`, { timeout: 1000 })
          newLogs.set(nodeId, resp.data.memory_log || [])
        } catch {
          newLogs.set(nodeId, [])
        }
      }
      
      setNodeLogs(newLogs)
    }
    
    fetchAllLogs()
    const interval = setInterval(fetchAllLogs, 5000)
    return () => clearInterval(interval)
  }, [])
  
  // Get commit indices for each node
  const nodeCommitIndices = useMemo(() => {
    const indices: Record<number, number> = {}
    nodes.forEach((status, nodeId) => {
      indices[nodeId] = status.commit_index
    })
    return indices
  }, [nodes])
  
  // Combined log entries from leader (node with most entries)
  const leaderLogs = useMemo(() => {
    let maxLogs: NodeLog[] = []
    nodeLogs.forEach((logs) => {
      if (logs.length > maxLogs.length) {
        maxLogs = logs
      }
    })
    return maxLogs
  }, [nodeLogs])
  
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Log Replication</h2>
        
        {/* View Toggle */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setSelectedView('combined')}
            className={cn(
              'px-3 py-1 rounded text-sm transition-all',
              selectedView === 'combined' 
                ? 'bg-indigo-500 text-white' 
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Combined
          </button>
          <button
            onClick={() => setSelectedView('individual')}
            className={cn(
              'px-3 py-1 rounded text-sm transition-all',
              selectedView === 'individual' 
                ? 'bg-indigo-500 text-white' 
                : 'text-muted-foreground hover:text-white'
            )}
          >
            Per Node
          </button>
        </div>
      </div>
      
      {selectedView === 'combined' ? (
        /* Combined View - shows all entries with replication status */
        leaderLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No log entries yet</p>
            <p className="text-sm">Create a task to see log replication</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Index</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Term</th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Key</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Node 1</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Node 2</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">Node 3</th>
                </tr>
              </thead>
              <tbody>
                {leaderLogs.slice(-10).map((entry) => (
                  <tr key={entry.index} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3 font-mono text-indigo-400">{entry.index}</td>
                    <td className="py-2 px-3 font-mono text-white">{entry.term}</td>
                    <td className="py-2 px-3 text-white truncate max-w-[150px]">{entry.key}</td>
                    {[1, 2, 3].map((nodeId) => {
                      const nodeLog = nodeLogs.get(nodeId) || []
                      const hasEntry = nodeLog.some(e => e.index === entry.index)
                      const isCommitted = nodeCommitIndices[nodeId] >= entry.index
                      
                      return (
                        <td key={nodeId} className="py-2 px-3 text-center">
                          {hasEntry ? (
                            <span className={cn(
                              'inline-flex items-center justify-center w-6 h-6 rounded-full',
                              isCommitted ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                            )}>
                              {isCommitted ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Individual View - shows each node's log separately */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((nodeId) => {
            const logs = nodeLogs.get(nodeId) || []
            const nodeStatus = nodes.get(nodeId)
            const isLeader = nodeStatus?.is_leader
            
            return (
              <div key={nodeId} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Server className={cn(
                    'w-4 h-4',
                    isLeader ? 'text-amber-400' : 'text-indigo-400'
                  )} />
                  <span className="font-medium text-white">Node {nodeId}</span>
                  {isLeader && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                      Leader
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {logs.length} entries
                  </span>
                </div>
                
                {logs.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No entries
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {logs.slice(-8).map((entry) => {
                      const isCommitted = nodeCommitIndices[nodeId] >= entry.index
                      return (
                        <div
                          key={entry.index}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1 rounded text-xs',
                            isCommitted ? 'bg-green-500/10' : 'bg-amber-500/10'
                          )}
                        >
                          <span className="font-mono text-indigo-400 w-6">#{entry.index}</span>
                          <span className="text-white truncate flex-1">{entry.key}</span>
                          {isCommitted ? (
                            <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20">
            <Check className="w-3 h-3 text-green-400" />
          </span>
          <span className="text-muted-foreground">Committed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20">
            <Clock className="w-3 h-3 text-amber-400" />
          </span>
          <span className="text-muted-foreground">Pending</span>
        </div>
      </div>
    </div>
  )
}
