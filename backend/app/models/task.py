from sqlalchemy import Column, String, Text, Enum, DateTime, Integer, BigInteger, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Task(Base):
    """Task model for the distributed task management system."""
    __tablename__ = "tasks"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        Enum('pending', 'in_progress', 'completed', name='task_status'),
        default='pending'
    )
    priority = Column(
        Enum('low', 'medium', 'high', name='task_priority'),
        default='medium'
    )
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by_node = Column(Integer, nullable=True)
    log_index = Column(BigInteger, nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_node": self.created_by_node,
            "log_index": self.log_index
        }


class RaftLog(Base):
    """Raft log entries for observability."""
    __tablename__ = "raft_log"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    term = Column(Integer, nullable=False)
    log_index = Column(BigInteger, nullable=False)
    operation = Column(
        Enum('create', 'update', 'delete', name='log_operation'),
        nullable=False
    )
    task_id = Column(String(36), nullable=True)
    data = Column(Text, nullable=True)  # JSON data for the operation
    committed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "term": self.term,
            "log_index": self.log_index,
            "operation": self.operation,
            "task_id": self.task_id,
            "data": self.data,
            "committed": self.committed,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
