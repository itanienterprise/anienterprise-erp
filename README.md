# ERP ANI Enterprise

A MERN Stack (MongoDB, Express, React, Node.js) ERP Application with Docker support.

## 🚀 Quick Start (Recommended)

To run the entire application (Client, Server, Database) using Docker:

```bash
npm run run:full
```
*This runs `docker-compose up --build` under the hood.*

### Access the Application
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **API Health Check**: [http://localhost:5000/health](http://localhost:5000/health)

## 🛠 Manual Setup (Without Docker)

If you prefer to run services individually:

### 1. Backend (Server)
```bash
cd server
npm install
npm run dev
```
*Requires a local MongoDB instance running on port 27017 or a valid `MONGODB_URI` in `.env`.*

### 2. Frontend (Client)
```bash
cd client
npm install
npm run dev
```
*The frontend will start on http://localhost:5173 by default when running fast via Vite manually.*

## 🐳 Docker Commands

- **Start**: `docker-compose up` (or `npm run run:full`)
- **Stop**: `docker-compose down`
- **Rebuild**: `docker-compose up --build`
