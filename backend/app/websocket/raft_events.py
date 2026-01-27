"""
WebSocket handlers for real-time Raft status updates.
"""
import asyncio
import json
from quart import Blueprint, websocket
from ..services.raft_cluster import get_raft_service

ws_bp = Blueprint('websocket', __name__)


@ws_bp.websocket('/ws/raft')
async def raft_websocket():
    """WebSocket endpoint for real-time Raft status updates."""
    raft = get_raft_service()
    
    # Queue for sending messages to this client
    send_queue = asyncio.Queue()
    
    async def on_status_update(status: dict):
        """Callback for Raft status updates."""
        await send_queue.put({
            "type": "status_update",
            "data": status
        })
    
    # Subscribe to updates
    raft.subscribe(on_status_update)
    
    try:
        # Send initial status
        await websocket.send(json.dumps({
            "type": "initial_status",
            "data": raft.get_status().to_dict()
        }))
        
        # Handle bidirectional communication
        async def sender():
            while True:
                message = await send_queue.get()
                await websocket.send(json.dumps(message))
        
        async def receiver():
            while True:
                data = await websocket.receive()
                # Handle incoming messages (e.g., requests for specific data)
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "get_events":
                        events = raft.get_events(limit=msg.get("limit", 50))
                        await websocket.send(json.dumps({
                            "type": "events",
                            "data": events
                        }))
                    elif msg.get("type") == "get_log":
                        log = raft.get_log()
                        await websocket.send(json.dumps({
                            "type": "log",
                            "data": log
                        }))
                except json.JSONDecodeError:
                    pass
        
        # Periodic status updates
        async def periodic_updates():
            while True:
                await asyncio.sleep(0.5)  # Send status every 500ms
                await send_queue.put({
                    "type": "status_update",
                    "data": raft.get_status().to_dict()
                })
        
        # Run all tasks concurrently
        await asyncio.gather(
            sender(),
            receiver(),
            periodic_updates()
        )
        
    finally:
        # Unsubscribe when connection closes
        raft.unsubscribe(on_status_update)
