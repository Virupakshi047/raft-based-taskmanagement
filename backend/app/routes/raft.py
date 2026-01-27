"""
Raft Status Routes - Endpoints for Raft cluster observability.
Includes RPC endpoints for inter-node communication.
"""
from quart import Blueprint, jsonify, request
from ..services.raft_cluster import get_raft_service
from ..database import async_session
from ..services.task_service import TaskService

raft_bp = Blueprint('raft', __name__, url_prefix='/api/raft')


# =============================================================================
# RPC Endpoints - For inter-node Raft communication
# =============================================================================

@raft_bp.route('/rpc/append-entries', methods=['POST'])
async def rpc_append_entries():
    """
    Receive AppendEntries RPC from leader.
    This is how the leader replicates log entries to followers.
    """
    raft = get_raft_service()
    data = await request.get_json()
    
    leader_id = data.get('leader_id')
    term = data.get('term')
    entry = data.get('entry')
    
    success = await raft.receive_append_entries(leader_id, term, entry)
    
    return jsonify({
        "success": success,
        "node_id": raft.node_id,
        "term": raft.term
    })


@raft_bp.route('/rpc/heartbeat', methods=['POST'])
async def rpc_heartbeat():
    """Receive heartbeat from leader."""
    raft = get_raft_service()
    data = await request.get_json()
    
    await raft.receive_heartbeat(
        leader_id=data.get('leader_id'),
        term=data.get('term'),
        leader_commit=data.get('leader_commit', -1)
    )
    
    # Return log_length so leader knows if we need catch-up
    return jsonify({
        "success": True,
        "node_id": raft.node_id,
        "log_length": len(raft.local_log)
    })


@raft_bp.route('/rpc/commit', methods=['POST'])
async def rpc_commit():
    """Receive commit notification from leader."""
    raft = get_raft_service()
    data = await request.get_json()
    
    await raft.receive_commit(data.get('commit_index', -1))
    
    return jsonify({"success": True})


@raft_bp.route('/rpc/catch-up', methods=['POST'])
async def rpc_catch_up():
    """Receive missing log entries from leader (log catch-up)."""
    raft = get_raft_service()
    data = await request.get_json()
    
    success = await raft.receive_catch_up(
        leader_id=data.get('leader_id'),
        term=data.get('term', 0),
        entries=data.get('entries', []),
        leader_commit=data.get('leader_commit', -1)
    )
    
    return jsonify({"success": success, "node_id": raft.node_id, "log_length": len(raft.local_log)})


@raft_bp.route('/rpc/promote', methods=['POST'])
async def rpc_promote():
    """Receive promotion request - this node should become leader."""
    raft = get_raft_service()
    data = await request.get_json()
    
    success = await raft.receive_promotion(
        term=data.get('term', 0),
        previous_leader=data.get('previous_leader', 0)
    )
    
    return jsonify({"success": success, "node_id": raft.node_id})


# =============================================================================
# Observability Endpoints - For UI
# =============================================================================


@raft_bp.route('/status', methods=['GET'])
async def get_status():
    """Get current node's Raft status."""
    raft = get_raft_service()
    status = raft.get_status()
    return jsonify(status.to_dict())


@raft_bp.route('/leader', methods=['GET'])
async def get_leader():
    """Get current leader information."""
    raft = get_raft_service()
    return jsonify({
        "leader_id": raft.leader_id,
        "this_node_id": raft.node_id,
        "is_leader": raft.state.value == "leader"
    })


@raft_bp.route('/events', methods=['GET'])
async def get_events():
    """Get recent Raft events."""
    raft = get_raft_service()
    events = raft.get_events(limit=50)
    return jsonify({
        "events": events,
        "count": len(events)
    })


@raft_bp.route('/log', methods=['GET'])
async def get_log():
    """Get Raft log entries with replication status."""
    raft = get_raft_service()
    log = raft.get_log()
    
    # Add replication status to each log entry
    log_with_status = []
    for entry in log:
        entry_copy = entry.copy()
        entry_copy['replication'] = raft.get_replication_status(entry['index'])
        log_with_status.append(entry_copy)
    
    # Also get database raft logs
    async with async_session() as session:
        service = TaskService(session)
        db_logs = await service.get_raft_logs(limit=50)
    
    return jsonify({
        "memory_log": log_with_status,
        "database_log": [l.to_dict() for l in db_logs],
        "log_length": len(log),
        "commit_index": raft.commit_index
    })


@raft_bp.route('/cluster', methods=['GET'])
async def get_cluster():
    """Get cluster overview - combines status of all nodes."""
    raft = get_raft_service()
    
    # Return this node's view of the cluster
    return jsonify({
        "this_node": raft.get_status().to_dict(),
        "cluster_nodes": raft.cluster_nodes,
        "leader_id": raft.leader_id,
        "term": raft.term
    })


@raft_bp.route('/node/<int:node_id>/toggle', methods=['POST'])
async def toggle_node(node_id: int):
    """Toggle a node's running state (simulate failure/recovery)."""
    raft = get_raft_service()
    
    if node_id != raft.node_id:
        return jsonify({
            "error": "Can only toggle this node",
            "message": "Send request to the specific node to toggle it"
        }), 400
    
    if raft.running:
        await raft.stop()
        return jsonify({
            "message": f"Node {node_id} stopped",
            "state": "stopped"
        })
    else:
        await raft.start()
        return jsonify({
            "message": f"Node {node_id} started",
            "state": "running"
        })
