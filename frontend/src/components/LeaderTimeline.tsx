import { useMemo } from 'react'
import { useRaftStore } from '@/stores/raftStore'
import { formatTimestamp } from '@/lib/utils'
import { Clock, ArrowRight, Vote, Zap, FileText } from 'lucide-react'

export function LeaderTimeline() {
  const { events } = useRaftStore()
  
  const recentEvents = useMemo(() => {
    return [...events].reverse().slice(0, 20)
  }, [events])
  
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'state_change':
        return <ArrowRight className="w-4 h-4 text-indigo-400" />
      case 'vote_granted':
        return <Vote className="w-4 h-4 text-amber-400" />
      case 'node_started':
        return <Zap className="w-4 h-4 text-green-400" />
      case 'node_stopped':
        return <Zap className="w-4 h-4 text-red-400" />
      case 'log_append':
        return <FileText className="w-4 h-4 text-blue-400" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }
  
  const getEventDescription = (event: {
    event_type: string
    node_id: number
    details: Record<string, unknown>
  }) => {
    switch (event.event_type) {
      case 'state_change':
        return `Node ${event.node_id}: ${event.details.old_state} → ${event.details.new_state}`
      case 'vote_granted':
        return `Node ${event.node_id} voted for Node ${event.details.candidate_id}`
      case 'node_started':
        return `Node ${event.node_id} started`
      case 'node_stopped':
        return `Node ${event.node_id} stopped`
      case 'log_append':
        return `Node ${event.node_id} appended log entry #${event.details.index}`
      default:
        return `Node ${event.node_id}: ${event.event_type}`
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-4">Leader Election Timeline</h2>
      
      {recentEvents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No events yet</p>
          <p className="text-sm">Start the cluster to see events</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {recentEvents.map((event, index) => (
            <div
              key={`${event.timestamp}-${index}`}
              className="flex items-start gap-3 p-3 bg-black/30 rounded-lg hover:bg-black/40 transition-colors"
            >
              <div className="mt-0.5">{getEventIcon(event.event_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{getEventDescription(event)}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>Term {event.term}</span>
                  <span>•</span>
                  <span>{formatTimestamp(event.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
