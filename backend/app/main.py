"""
Main application entry point for a Raft node.
"""
import asyncio
import sys
import os
from quart import Quart
from quart_cors import cors

from .config import config
from .database import init_db
from .routes.tasks import tasks_bp
from .routes.raft import raft_bp
from .websocket.raft_events import ws_bp
from .services.raft_cluster import init_raft_service


def create_app(node_id: int) -> Quart:
    """Create and configure the Quart application for a specific node."""
    app = Quart(__name__)
    app = cors(app, allow_origin="*")
    
    # Store node_id in app config
    app.config['NODE_ID'] = node_id
    app.config['PORT'] = config.NODE_PORTS[node_id]
    
    # Register blueprints
    app.register_blueprint(tasks_bp)
    app.register_blueprint(raft_bp)
    app.register_blueprint(ws_bp)
    
    @app.before_serving
    async def startup():
        """Initialize services before serving."""
        # Initialize database
        await init_db()
        
        # Create raft log directory
        os.makedirs(f'./raft_logs/node_{node_id}/', exist_ok=True)
        
        # Build cluster node addresses
        cluster_nodes = [
            f"127.0.0.1:{config.RAFT_PORTS[i]}"
            for i in range(1, config.INITIAL_CLUSTER_SIZE + 1)
        ]
        
        # Initialize Raft service
        raft = init_raft_service(node_id, cluster_nodes)
        await raft.start()
        
        print(f"Node {node_id} started on port {config.NODE_PORTS[node_id]}")
        print(f"Raft cluster: {cluster_nodes}")
    
    @app.route('/health')
    async def health():
        """Health check endpoint."""
        return {"status": "healthy", "node_id": node_id}
    
    return app


def run_node(node_id: int):
    """Run a single Raft node."""
    if node_id not in config.NODE_PORTS:
        print(f"Invalid node ID: {node_id}. Must be 1-5.")
        sys.exit(1)
    
    app = create_app(node_id)
    app.run(
        host='0.0.0.0',
        port=config.NODE_PORTS[node_id],
        debug=config.DEBUG
    )


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python -m app.main <node_id>")
        sys.exit(1)
    
    node_id = int(sys.argv[1])
    run_node(node_id)
