# Task Management System

A full-stack task management application built with Next.js and NestJS.

The application provides task management, project management, workspace collaboration, authentication, real-time updates, subtasks, resources, comments, labels, responsive layouts, and theme support.

---

## 🚀 Live Application

**Frontend:**  
https://task-management-system-omega-weld.vercel.app/

**Backend API:**  
https://task-management-api-4ekx.onrender.com/api/

**GitHub Repository:**  
https://github.com/jayadev-patra2002/task-management-system

---

## ✨ Features

### 🔐 Authentication

- Guest Login
- Google OAuth authentication
- User profile management
- Authentication token handling
- Production Google OAuth callback flow

### 👥 Teams / Workspaces

- Create a workspace
- Join a workspace using an invite code
- View workspace members
- Leave a workspace
- Workspace collaboration
- Workspace information management

### 📁 Projects

- Create projects
- Edit projects
- Delete projects
- View project details
- Manage tasks inside projects
- Project-based task organization

### ✅ Tasks

- Create tasks
- Edit tasks
- Delete tasks
- Task status management
- Priority management
- Assignee management
- Start dates
- Due dates
- Task locking
- Task labels
- Reporter information
- Task activity / updates
- Task details
- Responsive task interface

### ☑️ Subtasks

- Create subtasks
- Edit subtasks
- Delete subtasks
- Complete / incomplete subtasks
- Subtask action menu
- Dedicated scrolling when subtasks overflow

### 💬 Comments & Collaboration

- Task comments
- Comment replies
- Activity / updates section
- Real-time task collaboration
- Real-time updates using Socket.IO

### 📎 Resources

- Add task resources
- Upload resources
- Edit resources
- Delete resources
- Resource management inside tasks

### 🎨 UI / UX

- Responsive desktop layout
- Responsive tablet layout
- Responsive mobile layout
- Theme switching
- Persistent theme preference
- Responsive sidebar navigation
- Collapsible task details
- Collapsible updates section
- Responsive task details modal
- Responsive project views
- Responsive task views
- Responsive subtasks section
- Responsive label handling

---

## 🛠️ Tech Stack

### Frontend

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Zustand
- Lucide React
- Socket.IO Client

### Backend

- NestJS
- TypeScript
- Prisma ORM
- Socket.IO
- Passport
- Google OAuth

### Database

- PostgreSQL
- Supabase

### Deployment

- Vercel — Frontend
- Render — Backend
- Supabase — PostgreSQL Database

---

## 🏗️ Application Architecture

```text
                         ┌──────────────────────┐
                         │       Browser        │
                         └──────────┬───────────┘
                                    │
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │   Next.js Frontend   │
                         │       Vercel         │
                         └──────────┬───────────┘
                                    │
                         REST API / Socket.IO
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    NestJS Backend    │
                         │       Render         │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Prisma ORM       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ PostgreSQL / Supabase│
                         └──────────────────────┘




```

---

## 📂 Project Structure

```text
task-management-system/
│
├── client/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── task-dashboard/
│   │   │   └── tasks/
│   │   ├── lib/
│   │   ├── store/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── next.config.ts
│
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── src/
│   │   ├── auth/
│   │   ├── projects/
│   │   ├── prisma/
│   │   ├── realtime/
│   │   ├── tasks/
│   │   └── teams/
│   │
│   └── package.json
│
├── .gitignore
└── README.md
```
