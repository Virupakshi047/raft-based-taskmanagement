# Distributed Task Management System with Raft Observability

A fault-tolerant task management system demonstrating Raft consensus algorithm with real-time visualization.

## Quick Start

```bash
# Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Start 3 nodes (in separate terminals)
python run_node.py 1
python run_node.py 2
python run_node.py 3

# Frontend
cd frontend
npm install
npm run dev
```

## Project Structure

```
real-raft/
├── backend/           # Python Quart + Raftos
├── frontend/          # React + Tailwind + shadcn
└── README.md
```

## Features

- **CRUD Tasks** - Create, read, update, delete tasks
- **Raft Visualization** - See leader election, log replication
- **Node Status** - Real-time node states (Leader/Follower/Candidate)
- **Fault Tolerance** - System works with node failures
