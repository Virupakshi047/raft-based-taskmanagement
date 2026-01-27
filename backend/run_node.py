"""
Script to run a single Raft node.
Usage: python run_node.py <node_id>
"""
import sys
from app.main import run_node

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python run_node.py <node_id>")
        print("Example: python run_node.py 1")
        sys.exit(1)
    
    node_id = int(sys.argv[1])
    run_node(node_id)
