import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

class Config:
    # MySQL Configuration
    MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "raft_tasks")
    
    # Database URL with properly encoded password
    DATABASE_URL = f"mysql+aiomysql://{MYSQL_USER}:{quote_plus(MYSQL_PASSWORD)}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"
    
    # Raft Node Configuration
    NODE_PORTS = {
        1: 8001,
        2: 8002,
        3: 8003,
        4: 8004,
        5: 8005
    }
    
    # Raft Internal Ports (for consensus communication)
    RAFT_PORTS = {
        1: 9001,
        2: 9002,
        3: 9003,
        4: 9004,
        5: 9005
    }
    
    # Initial cluster (starting with 3 nodes)
    INITIAL_CLUSTER_SIZE = 3
    
    # Raft timing (in seconds)
    HEARTBEAT_INTERVAL = 0.1  # 100ms
    ELECTION_TIMEOUT_MIN = 0.15  # 150ms
    ELECTION_TIMEOUT_MAX = 0.3   # 300ms

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

config = DevelopmentConfig()
