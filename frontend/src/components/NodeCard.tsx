import { Crown, Circle, Star, XCircle, Zap } from 'lucide-react'
import { cn, getStateBgClass } from '@/lib/utils'
import type { NodeStatus } from '@/types'

interface NodeCardProps {
  status: NodeStatus
  onClick?: () => void
  isSelected?: boolean
}

export function NodeCard({ status, onClick, isSelected }: NodeCardProps) {
  const stateIcons = {
    leader: <Crown className="w-5 h-5 text-green-400" />,
    follower: <Circle className="w-5 h-5 text-blue-400" />,
    candidate: <Star className="w-5 h-5 text-amber-400" />,
    stopped: <XCircle className="w-5 h-5 text-red-400" />,
  }
  
  const timeSinceHeartbeat = status.last_heartbeat 
    ? Math.round((Date.now() / 1000 - status.last_heartbeat) * 1000)
    : null

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card rounded-xl p-4 cursor-pointer transition-all duration-300',
        'hover:scale-105 hover:border-indigo-500/50',
        isSelected && 'ring-2 ring-indigo-500',
        status.state === 'leader' && 'animate-pulse-leader',
        status.state === 'candidate' && 'animate-pulse-candidate'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            getStateBgClass(status.state)
          )}>
            {stateIcons[status.state]}
          </div>
          <div>
            <h3 className="font-semibold text-white">Node {status.node_id}</h3>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full border capitalize',
              getStateBgClass(status.state)
            )}>
              {status.state}
            </span>
          </div>
        </div>
        
        {status.is_leader && (
          <div className="flex items-center gap-1 text-green-400 text-sm">
            <Zap className="w-4 h-4" />
            Leader
          </div>
        )}
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-muted-foreground text-xs">Term</div>
          <div className="text-white font-mono text-lg">{status.term}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-muted-foreground text-xs">Log Length</div>
          <div className="text-white font-mono text-lg">{status.log_length}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-muted-foreground text-xs">Commit Index</div>
          <div className="text-white font-mono text-lg">{status.commit_index}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-muted-foreground text-xs">Last Heartbeat</div>
          <div className="text-white font-mono text-sm">
            {timeSinceHeartbeat !== null ? `${timeSinceHeartbeat}ms` : 'N/A'}
          </div>
        </div>
      </div>
      
      {/* Voted For */}
      {status.voted_for && (
        <div className="mt-3 text-xs text-muted-foreground">
          Voted for: Node {status.voted_for}
        </div>
      )}
      
      {/* Leader Info */}
      {!status.is_leader && status.leader_id && (
        <div className="mt-2 text-xs text-muted-foreground">
          Following: Node {status.leader_id}
        </div>
      )}
    </div>
  )
}
