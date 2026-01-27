"""
Real Raft Cluster Service - Network-based log replication.
Each node maintains its own log and replicates via HTTP calls.
"""
import asyncio
import time
import random
import aiohttp
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from enum import Enum


class NodeState(str, Enum):
    FOLLOWER = "follower"
    CANDIDATE = "candidate"
    LEADER = "leader"
    STOPPED = "stopped"


@dataclass
class RaftEvent:
    """Represents a Raft event for observability."""
    timestamp: float
    event_type: str
    node_id: int
    term: int
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self):
        return {
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "node_id": self.node_id,
            "term": self.term,
            "details": self.details
        }


@dataclass
class NodeStatus:
    """Current status of a Raft node."""
    node_id: int
    state: NodeState
    term: int
    voted_for: Optional[int]
    log_length: int
    commit_index: int
    last_heartbeat: float
    is_leader: bool
    leader_id: Optional[int]
    
    def to_dict(self):
        return {
            "node_id": self.node_id,
            "state": self.state.value,
            "term": self.term,
            "voted_for": self.voted_for,
            "log_length": self.log_length,
            "commit_index": self.commit_index,
            "last_heartbeat": self.last_heartbeat,
            "is_leader": self.is_leader,
            "leader_id": self.leader_id
        }


class RaftClusterService:
    """
    Real Raft cluster with network-based log replication.
    Each node maintains its own log and communicates via HTTP.
    """
    
    def __init__(self, node_id: int, cluster_nodes: List[str]):
        self.node_id = node_id
        self.cluster_nodes = cluster_nodes  # ['127.0.0.1:9001', ...]
        self.http_ports = {1: 8001, 2: 8002, 3: 8003}
        
        # Raft state
        self.state = NodeState.FOLLOWER
        self.term = 0
        self.voted_for: Optional[int] = None
        self.leader_id: Optional[int] = None
        
        # Each node has its OWN local log (not shared!)
        self.local_log: List[Dict[str, Any]] = []
        self.commit_index = -1
        self.last_heartbeat = time.time()
        
        # Tracking replication status per entry
        self.replication_acks: Dict[int, set] = {}  # log_index -> set of node_ids that acked
        
        # Event tracking for observability
        self.events: List[RaftEvent] = []
        self.max_events = 100
        
        # WebSocket subscribers
        self.subscribers: List[Callable] = []
        
        self.running = False
        
    async def start(self):
        """Start the Raft node."""
        self.running = True
        self.state = NodeState.FOLLOWER
        self._add_event("node_started", {})
        
        print(f"Node {self.node_id} started on port {self.http_ports[self.node_id]}")
        print(f"Raft cluster: {self.cluster_nodes}")
        
        # Start election process
        asyncio.create_task(self._election_loop())
        asyncio.create_task(self._heartbeat_loop())
        
    async def stop(self):
        """Stop the node (simulate failure)."""
        self.running = False
        old_state = self.state
        self.state = NodeState.STOPPED
        self._add_event("node_stopped", {"old_state": old_state.value})
        await self._notify_subscribers()
        
    async def _election_loop(self):
        """Handle leader election and failure detection."""
        await asyncio.sleep(2)  # Initial wait
        
        # For demo: Node 1 becomes leader first
        if self.node_id == 1:
            await self._become_leader()
        
        # Monitor for leader failure and trigger elections
        election_timeout = 5.0  # 5 seconds without heartbeat = leader is dead
        
        while self.running:
            await asyncio.sleep(1)  # Check every second
            
            if self.state == NodeState.FOLLOWER:
                # Check if we haven't heard from leader in a while
                time_since_heartbeat = time.time() - self.last_heartbeat
                
                if time_since_heartbeat > election_timeout:
                    print(f"⚠️  Node {self.node_id}: No heartbeat for {time_since_heartbeat:.1f}s, starting election!")
                    await self._start_election()
                    
            elif self.state == NodeState.LEADER:
                # Simulate occasional leadership changes for demo (less frequent now)
                if random.random() < 0.01:  # 1% chance per second
                    await self._trigger_election()
                    
    async def _start_election(self):
        """Start an election when leader failure is detected."""
        # Become candidate
        old_state = self.state
        self.state = NodeState.CANDIDATE
        self.term += 1
        self.voted_for = self.node_id
        
        print(f"🗳️  Node {self.node_id} starting election for term {self.term}")
        
        self._add_event("state_change", {
            "old_state": old_state.value,
            "new_state": "candidate"
        })
        await self._notify_subscribers()
        
        # In a real implementation, we'd request votes from other nodes
        # For simplicity, we'll just become leader if we're the first to notice
        await asyncio.sleep(0.5)  # Brief delay
        
        if self.state == NodeState.CANDIDATE:
            await self._become_leader()
                    
    async def _become_leader(self):
        """This node becomes the leader."""
        self.term += 1
        old_state = self.state
        self.state = NodeState.LEADER
        self.leader_id = self.node_id
        
        print(f"🎯 Node {self.node_id} became LEADER for term {self.term}")
        
        self._add_event("state_change", {
            "old_state": old_state.value,
            "new_state": "leader"
        })
        
        # Notify followers about new leader
        await self._send_heartbeat_to_all()
        await self._notify_subscribers()
        
    async def _trigger_election(self):
        """Trigger a new election (for demo) - notifies new leader via HTTP."""
        running_nodes = [1, 2, 3]
        new_leader = random.choice(running_nodes)
        
        self.term += 1
        print(f"🗳️  Election: Term {self.term}, New leader requested: Node {new_leader}")
        
        if new_leader == self.node_id:
            # We stay as leader
            self._add_event("state_change", {
                "old_state": "leader",
                "new_state": "leader",
                "reelected": True
            })
            await self._notify_subscribers()
        else:
            # Step down and notify new leader to take over
            old_state = self.state
            self.state = NodeState.FOLLOWER
            self.leader_id = new_leader
            
            self._add_event("state_change", {
                "old_state": old_state.value,
                "new_state": "follower",
                "leader": new_leader
            })
            await self._notify_subscribers()
            
            # Send HTTP request to new leader to become leader
            try:
                url = f"http://127.0.0.1:{self.http_ports[new_leader]}/api/raft/rpc/promote"
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=2)) as session:
                    await session.post(url, json={
                        "term": self.term,
                        "previous_leader": self.node_id
                    })
                print(f"  → Notified Node {new_leader} to become leader")
            except Exception as e:
                print(f"  ✗ Failed to notify Node {new_leader}: {e}")
            
    async def _heartbeat_loop(self):
        """Send periodic heartbeats if leader."""
        while True:
            await asyncio.sleep(0.5)
            
            # Only leader sends heartbeats and updates its own timer
            if self.state == NodeState.LEADER and self.running:
                self.last_heartbeat = time.time()  # Leader is always "alive"
                await self._send_heartbeat_to_all()
                
    async def _send_heartbeat_to_all(self):
        """Leader sends heartbeat with current state to all followers."""
        for node_id in [1, 2, 3]:
            if node_id != self.node_id:
                asyncio.create_task(self._send_heartbeat(node_id))
                
    async def _send_heartbeat(self, target_node: int):
        """Send heartbeat to a specific node."""
        try:
            url = f"http://127.0.0.1:{self.http_ports[target_node]}/api/raft/rpc/heartbeat"
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=1)) as session:
                async with session.post(url, json={
                    "leader_id": self.node_id,
                    "term": self.term,
                    "leader_commit": self.commit_index,
                    "leader_log_length": len(self.local_log)  # For log catch-up
                }) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        # Check if follower needs catch-up
                        follower_log_length = data.get("log_length", 0)
                        if follower_log_length < len(self.local_log):
                            # Send missing entries
                            asyncio.create_task(self._send_missing_entries(target_node, follower_log_length))
        except Exception:
            pass  # Node might be down
            
    async def replicate_data(self, key: str, value: Any) -> bool:
        """
        Replicate data across the cluster (leader only).
        This is the REAL Raft AppendEntries flow!
        """
        if self.state != NodeState.LEADER:
            print(f"⚠️  Node {self.node_id} is not leader, cannot replicate")
            return False
            
        # 1. Append to LOCAL log first
        log_index = len(self.local_log)
        log_entry = {
            "index": log_index,
            "term": self.term,
            "key": key,
            "value": value,
            "timestamp": time.time()
        }
        self.local_log.append(log_entry)
        
        # Initialize acks - leader counts as one ack
        self.replication_acks[log_index] = {self.node_id}
        
        print(f"📝 Leader appended to local log: {key} at index {log_index}")
        
        self._add_event("log_append", {"key": key, "index": log_index})
        
        # 2. Send to ALL followers via HTTP
        ack_count = 1  # Leader already has it
        
        for node_id in [1, 2, 3]:
            if node_id != self.node_id:
                success = await self._send_append_entries(node_id, log_entry)
                if success:
                    ack_count += 1
                    self.replication_acks[log_index].add(node_id)
                    print(f"  ✓ Node {node_id} acknowledged")
                else:
                    print(f"  ✗ Node {node_id} failed to acknowledge")
        
        # 3. Check if majority (2 out of 3) acknowledged
        if ack_count >= 2:
            self.commit_index = log_index
            print(f"✅ Entry {log_index} COMMITTED (acks: {ack_count}/3)")
            
            self._add_event("log_commit", {"index": log_index, "acks": ack_count})
            
            # Notify followers to commit
            await self._send_commit_notification(log_index)
            await self._notify_subscribers()
            return True
        else:
            print(f"❌ Entry {log_index} NOT committed (acks: {ack_count}/3)")
            return False
            
    async def _send_append_entries(self, target_node: int, entry: Dict) -> bool:
        """Send AppendEntries RPC to a follower."""
        try:
            url = f"http://127.0.0.1:{self.http_ports[target_node]}/api/raft/rpc/append-entries"
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=2)) as session:
                async with session.post(url, json={
                    "leader_id": self.node_id,
                    "term": self.term,
                    "entry": entry
                }) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("success", False)
        except Exception as e:
            print(f"  RPC to Node {target_node} failed: {e}")
        return False
        
    async def _send_commit_notification(self, commit_index: int):
        """Notify followers that an entry was committed."""
        for node_id in [1, 2, 3]:
            if node_id != self.node_id:
                try:
                    url = f"http://127.0.0.1:{self.http_ports[node_id]}/api/raft/rpc/commit"
                    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=1)) as session:
                        await session.post(url, json={"commit_index": commit_index})
                except Exception:
                    pass
                    
    async def _send_missing_entries(self, target_node: int, follower_log_length: int):
        """Send missing log entries to a follower that's behind (log catch-up)."""
        if follower_log_length >= len(self.local_log):
            return  # No catch-up needed
            
        missing_entries = self.local_log[follower_log_length:]
        
        print(f"📤 Sending {len(missing_entries)} missing entries to Node {target_node} (has {follower_log_length}, leader has {len(self.local_log)})")
        
        try:
            url = f"http://127.0.0.1:{self.http_ports[target_node]}/api/raft/rpc/catch-up"
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                async with session.post(url, json={
                    "leader_id": self.node_id,
                    "term": self.term,
                    "entries": missing_entries,
                    "leader_commit": self.commit_index
                }) as resp:
                    if resp.status == 200:
                        print(f"  ✓ Node {target_node} caught up!")
        except Exception as e:
            print(f"  ✗ Catch-up to Node {target_node} failed: {e}")
                    
    async def receive_append_entries(self, leader_id: int, term: int, entry: Dict) -> bool:
        """
        Receive AppendEntries from leader (follower side).
        This is called via the RPC endpoint.
        """
        # Update term if leader has higher term
        if term >= self.term:
            self.term = term
            self.leader_id = leader_id
            
            if self.state != NodeState.FOLLOWER:
                self.state = NodeState.FOLLOWER
                self._add_event("state_change", {
                    "old_state": self.state.value,
                    "new_state": "follower",
                    "leader": leader_id
                })
        
        # Append entry to our local log
        # Check if we already have this entry
        if entry["index"] < len(self.local_log):
            # Already have it
            return True
            
        self.local_log.append(entry)
        self.last_heartbeat = time.time()
        
        print(f"📥 Node {self.node_id} received log entry {entry['index']} from leader")
        
        self._add_event("log_replicated", {
            "index": entry["index"],
            "from_leader": leader_id
        })
        
        await self._notify_subscribers()
        return True
        
    async def receive_heartbeat(self, leader_id: int, term: int, leader_commit: int):
        """Receive heartbeat from leader."""
        if term >= self.term:
            self.term = term
            self.leader_id = leader_id
            self.last_heartbeat = time.time()
            
            if self.state != NodeState.FOLLOWER and self.state != NodeState.STOPPED:
                old_state = self.state
                self.state = NodeState.FOLLOWER
                self._add_event("state_change", {
                    "old_state": old_state.value,
                    "new_state": "follower",
                    "leader": leader_id
                })
                await self._notify_subscribers()
                
        # Update commit index
        if leader_commit > self.commit_index:
            self.commit_index = min(leader_commit, len(self.local_log) - 1)
            
    async def receive_commit(self, commit_index: int):
        """Receive commit notification from leader."""
        if commit_index > self.commit_index and commit_index < len(self.local_log):
            self.commit_index = commit_index
            await self._notify_subscribers()
            
    async def receive_catch_up(self, leader_id: int, term: int, entries: list, leader_commit: int):
        """
        Receive missing log entries from leader (log catch-up).
        Called when follower is behind and needs to sync.
        """
        if term >= self.term:
            self.term = term
            self.leader_id = leader_id
            self.last_heartbeat = time.time()
            
        added_count = 0
        for entry in entries:
            # Only add if we don't already have this entry
            if entry["index"] >= len(self.local_log):
                self.local_log.append(entry)
                added_count += 1
                
        if added_count > 0:
            print(f"📥 Node {self.node_id} caught up: added {added_count} entries (now has {len(self.local_log)})")
            
            self._add_event("log_catch_up", {
                "entries_received": added_count,
                "from_leader": leader_id,
                "new_log_length": len(self.local_log)
            })
            
        # Update commit index
        if leader_commit > self.commit_index:
            self.commit_index = min(leader_commit, len(self.local_log) - 1)
            
        await self._notify_subscribers()
        return True
            
    async def receive_promotion(self, term: int, previous_leader: int):
        """
        Receive promotion request - this node should become leader.
        Called via RPC when another node wants to transfer leadership.
        """
        if term >= self.term and self.state != NodeState.LEADER:
            print(f"🎯 Node {self.node_id} promoted to LEADER by Node {previous_leader}")
            self.term = term
            old_state = self.state
            self.state = NodeState.LEADER
            self.leader_id = self.node_id
            
            self._add_event("state_change", {
                "old_state": old_state.value,
                "new_state": "leader",
                "promoted_by": previous_leader
            })
            
            # Notify followers
            await self._send_heartbeat_to_all()
            await self._notify_subscribers()
            return True
        return False
            
    def _add_event(self, event_type: str, details: Dict[str, Any]):
        """Add a Raft event."""
        event = RaftEvent(
            timestamp=time.time(),
            event_type=event_type,
            node_id=self.node_id,
            term=self.term,
            details=details
        )
        self.events.append(event)
        
        if len(self.events) > self.max_events:
            self.events = self.events[-self.max_events:]
            
    async def _notify_subscribers(self):
        """Notify WebSocket subscribers."""
        status = self.get_status()
        for callback in self.subscribers:
            try:
                await callback(status.to_dict())
            except Exception as e:
                print(f"Subscriber error: {e}")
                
    def subscribe(self, callback: Callable):
        self.subscribers.append(callback)
        
    def unsubscribe(self, callback: Callable):
        if callback in self.subscribers:
            self.subscribers.remove(callback)
            
    def get_status(self) -> NodeStatus:
        """Get current node status."""
        return NodeStatus(
            node_id=self.node_id,
            state=self.state,
            term=self.term,
            voted_for=self.voted_for,
            log_length=len(self.local_log),
            commit_index=self.commit_index,
            last_heartbeat=self.last_heartbeat,
            is_leader=self.state == NodeState.LEADER,
            leader_id=self.leader_id
        )
        
    def get_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.events[-limit:]]
        
    def get_log(self) -> List[Dict[str, Any]]:
        """Get this node's local log."""
        return self.local_log.copy()
    
    def get_replication_status(self, log_index: int) -> Dict[int, bool]:
        """Get which nodes have acknowledged a specific log entry."""
        acks = self.replication_acks.get(log_index, set())
        return {1: 1 in acks, 2: 2 in acks, 3: 3 in acks}
        
    async def get_replicated_data(self, key: str) -> Optional[Any]:
        for entry in reversed(self.local_log):
            if entry.get('key') == key:
                return entry.get('value')
        return None


# Global instance
raft_service: Optional[RaftClusterService] = None


def get_raft_service() -> RaftClusterService:
    global raft_service
    if raft_service is None:
        raise RuntimeError("Raft service not initialized")
    return raft_service


def init_raft_service(node_id: int, cluster_nodes: List[str]) -> RaftClusterService:
    global raft_service
    raft_service = RaftClusterService(node_id, cluster_nodes)
    return raft_service
