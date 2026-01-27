"""
Task Routes - CRUD endpoints for tasks.
"""
from quart import Blueprint, request, jsonify
from ..database import async_session
from ..services.task_service import TaskService
from ..services.raft_cluster import get_raft_service

tasks_bp = Blueprint('tasks', __name__, url_prefix='/api/tasks')


@tasks_bp.route('', methods=['GET'])
async def get_tasks():
    """Get all tasks."""
    async with async_session() as session:
        service = TaskService(session)
        tasks = await service.get_all_tasks()
        return jsonify({
            "tasks": [t.to_dict() for t in tasks],
            "count": len(tasks)
        })


@tasks_bp.route('/<task_id>', methods=['GET'])
async def get_task(task_id: str):
    """Get a specific task."""
    async with async_session() as session:
        service = TaskService(session)
        task = await service.get_task(task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(task.to_dict())


@tasks_bp.route('', methods=['POST'])
async def create_task():
    """Create a new task."""
    data = await request.get_json()
    
    if not data or not data.get('title'):
        return jsonify({"error": "Title is required"}), 400
    
    # Check if this node is the leader
    raft = get_raft_service()
    if raft.state.value != "leader":
        return jsonify({
            "error": "Not the leader",
            "leader_id": raft.leader_id,
            "message": "Please send write requests to the leader node"
        }), 307
    
    async with async_session() as session:
        service = TaskService(session)
        task = await service.create_task(
            title=data.get('title'),
            description=data.get('description'),
            priority=data.get('priority', 'medium')
        )
        
        if not task:
            return jsonify({"error": "Failed to create task"}), 500
            
        return jsonify(task.to_dict()), 201


@tasks_bp.route('/<task_id>', methods=['PUT'])
async def update_task(task_id: str):
    """Update a task."""
    data = await request.get_json()
    
    # Check if this node is the leader
    raft = get_raft_service()
    if raft.state.value != "leader":
        return jsonify({
            "error": "Not the leader",
            "leader_id": raft.leader_id,
            "message": "Please send write requests to the leader node"
        }), 307
    
    async with async_session() as session:
        service = TaskService(session)
        task = await service.update_task(
            task_id,
            title=data.get('title'),
            description=data.get('description'),
            status=data.get('status'),
            priority=data.get('priority')
        )
        
        if not task:
            return jsonify({"error": "Task not found or update failed"}), 404
            
        return jsonify(task.to_dict())


@tasks_bp.route('/<task_id>', methods=['DELETE'])
async def delete_task(task_id: str):
    """Delete a task."""
    # Check if this node is the leader
    raft = get_raft_service()
    if raft.state.value != "leader":
        return jsonify({
            "error": "Not the leader",
            "leader_id": raft.leader_id,
            "message": "Please send write requests to the leader node"
        }), 307
    
    async with async_session() as session:
        service = TaskService(session)
        success = await service.delete_task(task_id)
        
        if not success:
            return jsonify({"error": "Task not found or delete failed"}), 404
            
        return jsonify({"message": "Task deleted", "id": task_id})
