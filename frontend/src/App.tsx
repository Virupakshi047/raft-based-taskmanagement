import { useRaftStatus } from '@/hooks/useRaftStatus'
import { ClusterVisualization } from '@/components/ClusterVisualization'
import { LeaderTimeline } from '@/components/LeaderTimeline'
import { LogReplication } from '@/components/LogReplication'
import { TaskManager } from '@/components/TaskManager'
import { useRaftStore } from '@/stores/raftStore'
import { Wifi, WifiOff, Server } from 'lucide-react'

function App() {
  // Initialize polling
  useRaftStatus()
  
  const { wsConnected, currentTerm, leaderId } = useRaftStore()

  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 max-w-[1600px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Raft Cluster Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">Distributed Task Management System</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Term:</span>
                <span className="font-mono font-bold text-indigo-400">{currentTerm}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Leader:</span>
                <span className="font-mono font-bold text-green-400">
                  {leaderId ? `Node ${leaderId}` : 'Election...'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {wsConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Polling</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-[1600px]">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column - Cluster Visualization */}
          <div className="space-y-6">
            <ClusterVisualization />
            <LeaderTimeline />
          </div>
          
          {/* Right Column - Tasks and Logs */}
          <div className="space-y-6">
            <TaskManager />
            <LogReplication />
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 mt-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 max-w-[1600px] text-center text-sm text-muted-foreground">
          <p>Distributed Task Management System using Raft Consensus Algorithm</p>
          <p className="mt-1">3-Node Cluster • Python + Quart + Raftos • React + Tailwind</p>
        </div>
      </footer>
    </div>
  )
}

export default App
