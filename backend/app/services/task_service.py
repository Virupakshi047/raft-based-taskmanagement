"""
Task Service - Handles CRUD operations with Raft replication.
"""
import json
import uuid
from typing import List, Optional
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.task import Task, RaftLog
from .raft_cluster import get_raft_service


class TaskService:
    """Service for managing tasks with Raft consensus."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        
    async def create_task(self, title: str, description: str = None, 
                          priority: str = "medium") -> Optional[Task]:
        """Create a new task and replicate via Raft."""
        raft = get_raft_service()
        
        task_id = str(uuid.uuid4())
        task = Task(
            id=task_id,
            title=title,
            description=description,
            priority=priority,
            status="pending",
            created_by_node=raft.node_id,
            log_index=len(raft.local_log)
        )
        
        # Replicate through Raft if we're leader
        if raft.state.value == "leader":
            success = await raft.replicate_data(
                f"task:{task_id}",
                task.to_dict()
            )
            if not success:
                return None
                
            # Log the operation
            raft_log = RaftLog(
                term=raft.term,
                log_index=len(raft.local_log) - 1,
                operation="create",
                task_id=task_id,
                data=json.dumps(task.to_dict()),
                committed=True
            )
            self.session.add(raft_log)
        
        self.session.add(task)
        await self.session.commit()
        await self.session.refresh(task)
        
        return task
        
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID."""
        result = await self.session.execute(
            select(Task).where(Task.id == task_id)
        )
        return result.scalar_one_or_none()
        
    async def get_all_tasks(self) -> List[Task]:
        """Get all tasks."""
        result = await self.session.execute(select(Task))
        return result.scalars().all()
        
    async def update_task(self, task_id: str, **kwargs) -> Optional[Task]:
        """Update a task."""
        raft = get_raft_service()
        
        task = await self.get_task(task_id)
        if not task:
            return None
            
        # Update fields
        for key, value in kwargs.items():
            if hasattr(task, key) and value is not None:
                setattr(task, key, value)
        
        # Replicate through Raft if we're leader
        if raft.state.value == "leader":
            success = await raft.replicate_data(
                f"task:{task_id}",
                task.to_dict()
            )
            if not success:
                return None
                
            # Log the operation
            raft_log = RaftLog(
                term=raft.term,
                log_index=len(raft.local_log) - 1,
                operation="update",
                task_id=task_id,
                data=json.dumps(kwargs),
                committed=True
            )
            self.session.add(raft_log)
        
        await self.session.commit()
        await self.session.refresh(task)
        
        return task
        
    async def delete_task(self, task_id: str) -> bool:
        """Delete a task."""
        raft = get_raft_service()
        
        task = await self.get_task(task_id)
        if not task:
            return False
            
        # Replicate deletion through Raft if we're leader
        if raft.state.value == "leader":
            success = await raft.replicate_data(
                f"task:{task_id}:deleted",
                True
            )
            if not success:
                return False
                
            # Log the operation
            raft_log = RaftLog(
                term=raft.term,
                log_index=len(raft.local_log) - 1,
                operation="delete",
                task_id=task_id,
                data=None,
                committed=True
            )
            self.session.add(raft_log)
        
        await self.session.delete(task)
        await self.session.commit()
        
        return True
        
    async def get_raft_logs(self, limit: int = 50) -> List[RaftLog]:
        """Get recent Raft log entries."""
        result = await self.session.execute(
            select(RaftLog).order_by(RaftLog.id.desc()).limit(limit)
        )
        return result.scalars().all()
