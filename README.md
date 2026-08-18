\# Task Management System



A full-stack task management application built as part of the frontend/backend engineering assessment.



The application provides task, project, team, collaboration, authentication, realtime updates, subtasks, resources, comments, and responsive UI functionality.



\---



\## 🚀 Live Application



\*\*Frontend:\*\* Coming soon



\*\*Backend API:\*\* Coming soon



> The live deployment URLs will be added here after deployment.



\---



\## ✨ Features



\### Authentication

\- Guest login

\- Google/Gmail authentication

\- User profile management



\### Teams

\- Create a team/workspace

\- Join a team using a share option

\- View team members

\- Team collaboration



\### Projects

\- Create projects

\- Edit projects

\- Delete projects

\- Project details

\- Project task management



\### Tasks

\- Create and edit tasks

\- Task status

\- Priority

\- Assignee

\- Due date

\- Task locking

\- Task activity/updates

\- Task deletion

\- Responsive task interface



\### Subtasks

\- Create subtasks

\- Edit subtasks

\- Delete subtasks

\- Complete/incomplete subtasks

\- Subtask action menu

\- Dedicated scrolling when subtasks overflow



\### Comments \& Collaboration

\- Task comments

\- Comment replies

\- Activity/update section

\- Realtime task collaboration



\### Resources

\- Add task resources

\- Upload resources

\- Edit resources

\- Delete resources



\### UI \& UX

\- Responsive desktop, tablet and mobile layouts

\- Theme support

\- Collapsible task details and updates sections

\- Responsive sidebar/toggle navigation

\- Responsive task details modal

\- Responsive project and task views



\---



\## 🛠️ Tech Stack



\### Frontend



\- Next.js

\- React

\- TypeScript

\- Tailwind CSS



\### Backend



\- NestJS

\- TypeScript

\- Prisma ORM

\- Socket.IO



\### Database



\- PostgreSQL

\- Supabase



\### Authentication



\- Guest authentication

\- Google authentication



\---



\## 🏗️ Project Structure



```text

task-management-system/

│

├── client/

│   ├── src/

│   │   ├── app/

│   │   ├── components/

│   │   ├── lib/

│   │   ├── store/

│   │   └── types/

│   ├── public/

│   └── package.json

│

├── server/

│   ├── prisma/

│   │   ├── schema.prisma

│   │   └── migrations/

│   ├── src/

│   │   ├── auth/

│   │   ├── projects/

│   │   ├── realtime/

│   │   ├── tasks/

│   │   ├── teams/

│   │   └── prisma/

│   └── package.json

│

├── .gitignore

└── README.md





```markdown

\## 🚀 Deployment Architecture



```text

Browser

&#x20;  │

&#x20;  ▼

Next.js Frontend

&#x20;  │

&#x20;  │ HTTPS / REST API / Socket.IO

&#x20;  ▼

NestJS Backend

&#x20;  │

&#x20;  ▼

Prisma ORM

&#x20;  │

&#x20;  ▼

Supabase PostgreSQL

