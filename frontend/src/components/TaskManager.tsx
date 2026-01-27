import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRaftStore } from '@/stores/raftStore'
import { taskApi } from '@/lib/api'
import type { Task, TaskStatus, TaskPriority } from '@/types'

export function TaskManager() {
  const { tasks, setTasks, addTask, updateTask, removeTask, leaderId } = useRaftStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority
  })
  
  // Fetch tasks on mount
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tasks = await taskApi.getAll()
        setTasks(tasks)
      } catch (error) {
        console.error('Failed to fetch tasks:', error)
      }
    }
    fetchTasks()
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [setTasks])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      if (editingTask) {
        const updated = await taskApi.update(editingTask.id, formData)
        updateTask(updated)
      } else {
        const created = await taskApi.create(formData)
        addTask(created)
      }
      setFormData({ title: '', description: '', priority: 'medium' })
      setShowForm(false)
      setEditingTask(null)
    } catch (error) {
      console.error('Failed to save task:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority
    })
    setShowForm(true)
  }
  
  const handleDelete = async (taskId: string) => {
    try {
      await taskApi.delete(taskId)
      removeTask(taskId)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }
  
  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      const updated = await taskApi.update(task.id, { status: newStatus })
      updateTask(updated)
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }
  
  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'in_progress':
        return <Clock className="w-4 h-4 text-amber-400" />
      default:
        return <AlertCircle className="w-4 h-4 text-blue-400" />
    }
  }
  
  const getPriorityBadge = (priority: TaskPriority) => {
    const classes = {
      high: 'bg-red-500/20 text-red-400 border-red-500/30',
      medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      low: 'bg-green-500/20 text-green-400 border-green-500/30'
    }
    return (
      <span className={cn('text-xs px-2 py-0.5 rounded-full border capitalize', classes[priority])}>
        {priority}
      </span>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Task Management</h2>
          <p className="text-sm text-muted-foreground">
            {leaderId ? `Writing to Node ${leaderId} (Leader)` : 'No leader available'}
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditingTask(null)
            setFormData({ title: '', description: '', priority: 'medium' })
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>
      
      {/* Task Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-black/30 rounded-xl space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              placeholder="Enter task title..."
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Enter description..."
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingTask ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setEditingTask(null)
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      
      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No tasks yet</p>
          <p className="text-sm">Create a task to test Raft replication</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-4 p-4 bg-black/30 rounded-xl hover:bg-black/40 transition-colors"
            >
              {/* Status Toggle */}
              <button
                onClick={() => {
                  const nextStatus: Record<TaskStatus, TaskStatus> = {
                    pending: 'in_progress',
                    in_progress: 'completed',
                    completed: 'pending'
                  }
                  handleStatusChange(task, nextStatus[task.status])
                }}
                className="mt-1"
              >
                {getStatusIcon(task.status)}
              </button>
              
              {/* Task Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={cn(
                    'font-medium text-white',
                    task.status === 'completed' && 'line-through opacity-50'
                  )}>
                    {task.title}
                  </h3>
                  {getPriorityBadge(task.priority)}
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {task.created_by_node && (
                    <span>Created by Node {task.created_by_node}</span>
                  )}
                  {task.log_index !== null && (
                    <span>Log #{task.log_index}</span>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(task)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
