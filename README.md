<div align="center">

# Invox

### AI-Powered Knowledge Sharing, Professional Networking & Innovation Platform

*Empowering people to learn, build, showcase, and collaborate through knowledge.*

---

![Status](https://img.shields.io/badge/Status-Active%20Development-blue)
![Frontend](https://img.shields.io/badge/Frontend-React%2019-61DAFB)
![Backend](https://img.shields.io/badge/Backend-Firebase-orange)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6)
![License](https://img.shields.io/badge/License-Private-red)

</div>

---

# 📖 About Invox

Invox is an AI-powered professional platform built to transform how people share knowledge, showcase projects, discover innovations, and collaborate with others.

Unlike traditional professional networking platforms, Invox combines:

- 📚 Knowledge Sharing
- 🚀 Project Showcasing
- 🤝 Professional Networking
- 💬 Technical Discussions
- 🏢 Communities
- 🤖 AI Assistance
- 🌍 Innovation Discovery

Our goal is to create a modern ecosystem where students, developers, professionals, researchers, creators, and innovators can learn, contribute, and grow together.

---

# ✨ Core Features

## ✅ Completed

- User Authentication
- User Profiles
- Profile Media Upload
- Account Settings
- Firebase Integration
- Protected Routes
- Firestore Database
- Firebase Storage

## 🚧 In Development

- Content Publishing
- Explore Feed
- Comments
- Likes
- Bookmarks
- Media Posts

## 📅 Planned

- Spotlight (Project Showcase)
- Communities
- Networking
- Messaging
- Notifications
- Spark AI
- Analytics
- Reputation System

---

# 🏗 System Architecture

```text

                    ┌─────────────────┐
                    │      Users      │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   React Pages & UI       │
              │  (Frontend Components)   │
              └──────────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │  Context API & Hooks     │
              │ (State Management Layer) │
              └──────────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │      Service Layer       │
              │                          │
              │ • authService            │
              │ • userService            │
              │ • postService            │
              │ • storageService         │
              └──────────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │        Firebase          │
              │                          │
              │ • Authentication         │
              │ • Cloud Firestore        │
              │ • Firebase Storage       │
              └──────────────────────────┘

```

---

# 🛠 Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | React 19 |
| Language | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Storage | Firebase Storage |
| Hosting | Vercel |

---

# 📂 Repository Structure

```text
src/
│
├── assets/
├── components/
│   ├── auth/
│   ├── profile/
│   ├── feed/
│   ├── shared/
│   └── ui/
│
├── contexts/
├── hooks/
├── pages/
├── services/
├── types/
├── utils/
├── lib/
│
└── App.tsx
```

---

# 🚀 Getting Started

## Prerequisites

- Node.js 20+
- npm
- Firebase Project
- Git

---

## Installation

Clone the repository.

```bash
git clone <repository-url>
```

Move into the project.

```bash
cd invox
```

Install dependencies.

```bash
npm install
```

---

# 🔑 Environment Variables

Create a `.env.local` file.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

# ▶ Running the Project

Development

```bash
npm run dev
```

Production Build

```bash
npm run build
```

Preview Production Build

```bash
npm run preview
```

---

# 🗂 Firestore Collections

Current

```text
users
posts
comments
likes
bookmarks
```

Future

```text
projects
communities
followers
connections
messages
notifications
analytics
reports
```

---

# 👥 Team Roles

## Project Lead

Responsible for

- Product Vision
- Frontend Development
- UI / UX
- System Architecture
- Product Roadmap
- Feature Planning

---

## Backend Developer

Responsible for

- Firestore Schema
- Firebase Security Rules
- Backend Services
- Query Optimization
- Data Validation
- Performance
- API & Service Layer

---

# 📈 Development Roadmap

| Stage | Status |
|---------|:------:|
| Foundation & Security | ✅ |
| Authentication | ✅ |
| User Profiles | ✅ |
| Content & Feed | 🚧 |
| Spotlight | 📅 |
| Communities | 📅 |
| Networking | 📅 |
| Messaging | 📅 |
| Notifications | 📅 |
| Spark AI | 📅 |
| Reputation | 📅 |
| Analytics | 📅 |

---

# 🤝 Contributing

## Branch Naming

```
feature/feed-system
feature/profile
fix/auth
hotfix/storage
```

---

## Commit Convention

```
feat:

fix:

refactor:

style:

docs:

test:

chore:
```

Example

```
feat: implement realtime feed pagination
```

---

## Pull Request Checklist

- Project builds successfully
- TypeScript has no errors
- No console errors
- UI follows existing design language
- Code is documented
- Feature tested

---

# 📚 Documentation

Additional documentation is located inside the `/docs` directory.

Recommended documents:

```
docs/
│
├── architecture.md
├── backend.md
├── frontend.md
├── firestore-schema.md
├── roadmap.md
├── deployment.md
└── coding-standards.md
```

---

# 🔒 Security

- Never commit `.env.local`
- Never expose Firebase secrets
- Use Firestore Security Rules
- Validate all client data
- Keep Firebase SDK versions updated

---

# 📄 License

This project is currently private.

All rights reserved.

---

<div align="center">

### Built with ❤️ to redefine knowledge sharing, innovation and professional collaboration.

**Invox • Learn • Build • Connect • Innovate**

</div>
