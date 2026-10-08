# Acxiom CRM

> **A modern, role-based Sales & Customer Relationship Management (CRM) platform.**
> Built with React 19, TypeScript, Express 5, PostgreSQL, Drizzle ORM, and Tailwind CSS.

---

## 📌 Overview

**Acxiom CRM** is an enterprise-grade sales workspace designed to help sales teams manage customer relationships, qualify leads, track opportunity pipelines, coordinate follow-ups, and analyze performance. It provides complete role-based permissions, automated audit tracking, and real-time activity dashboards.

---

## ✨ Features

- **🔐 Role-Based Access Control (RBAC)**
  - **Admin**: Full access to team permissions, audit logs, CRM records, and business reporting.
  - **Manager**: Manage CRM records, review pipeline and analytics reports, and view audit trails.
  - **Sales Executive**: Work day-to-day with assigned customers, leads, opportunities, and follow-ups.
- **👥 Customer & Lead Management**
  - Track complete contact info, company details, status, and notes.
  - Seamless **1-Click Lead Conversion** into paying Customers and linked Opportunities.
- **💼 Opportunity Pipeline**
  - Track deals across visual stages (Prospecting, Qualification, Proposal, Negotiation, Closed Won / Lost).
  - Track expected revenue, probability, and projected close dates.
- **📅 Scheduled Follow-ups & Reminders**
  - Plan calls, emails, and meetings linked directly to customers, leads, or deals.
  - Track completed vs. overdue tasks to maintain high sales momentum.
- **📊 Interactive Analytics & Reports**
  - Pipeline stage distributions, lead source conversion rates, revenue projections, and rep performance.
- **🛡️ Audit Logging & Security**
  - Automated activity history tracking critical record updates and team operations.
  - Secured with Clerk authentication and API token verification.

---

## 🛠️ Tech Stack

### Frontend (`@workspace/acxiom-crm`)
- **Framework**: React 19 + TypeScript
- **Bundler & Tooling**: Vite
- **Styling**: Tailwind CSS + Radix UI / shadcn/ui components
- **State & Data Fetching**: TanStack React Query + Orval-generated API hooks
- **Icons & Animations**: Lucide React + Framer Motion
- **Authentication**: Clerk

### Backend (`@workspace/api-server`)
- **Framework**: Express 5 (Node.js 24)
- **Database ORM**: Drizzle ORM + PostgreSQL
- **Validation**: Zod + `drizzle-zod`
- **API Spec & Codegen**: OpenAPI 3.0 contract + Orval
- **Build**: esbuild (CJS bundle)

### Monorepo Architecture
- Managed with **pnpm workspaces**

```
Acxiom-CRM/
├── artifacts/
│   ├── acxiom-crm/          # React + Vite frontend web application
│   ├── api-server/          # Express 5 REST API server
│   └── mockup-sandbox/      # Component preview / sandbox
├── lib/
│   ├── api-spec/            # OpenAPI 3.0 specification (`openapi.yaml`)
│   ├── api-client-react/    # Generated React Query API hooks
│   ├── api-zod/             # Generated runtime Zod validation schemas
│   └── db/                  # Drizzle ORM schema, migrations & DB client
├── package.json             # Root monorepo workspace configuration
├── pnpm-workspace.yaml      # pnpm workspace definition
└── README.md                # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v20+ or v24 recommended)
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** instance (local or hosted e.g. Neon, Supabase)
- **Clerk** account for authentication keys

### 1. Clone the Repository
```bash
git clone https://github.com/saisanjana-konapala/Acxiom-CRM.git
cd Acxiom-CRM
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Create a `.env` file in the project root or configure the following variables:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/acxiom_crm

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Server Port (optional, defaults to 5000)
PORT=5000
```

### 4. Push Database Schema
Apply the Drizzle ORM schema to your PostgreSQL database:
```bash
pnpm --filter @workspace/db run push
```

### 5. Start Development Servers

Run the API server (Backend):
```bash
pnpm --filter @workspace/api-server run dev
```

In a separate terminal, run the Frontend application:
```bash
pnpm --filter @workspace/acxiom-crm run dev
```

Open your browser at `http://localhost:5173` (or the port indicated by Vite).

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `pnpm run build` | Typechecks and builds all workspaces and packages |
| `pnpm run typecheck` | Runs TypeScript type checking across all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Re-generates React Query hooks and Zod schemas from `openapi.yaml` |
| `pnpm --filter @workspace/db run push` | Pushes Drizzle schema changes directly to PostgreSQL |
| `pnpm --filter @workspace/acxiom-crm run build` | Produces an optimized production build of the frontend |

---

## 🌐 API Overview

The backend REST API is mounted under `/api`:

| Endpoint | Description |
|---|---|
| `GET /api/me` | Current authenticated user profile and permissions |
| `GET /api/dashboard` | Dashboard metrics, pipeline summaries, and recent activity |
| `GET /api/customers` | List, search, and filter customers |
| `GET /api/leads` | List, filter, create, and convert sales leads |
| `GET /api/opportunities` | Manage deals and sales pipeline stages |
| `GET /api/follow-ups` | Follow-up activities, reminders, and scheduling |
| `GET /api/reports` | Aggregated sales metrics and pipeline reports |
| `GET /api/audit` | Audit log trail (Admin & Manager) |
| `GET /api/users` | User and team role management (Admin only) |
| `GET /api/healthz` | API health check endpoint |

The authoritative API contract is defined in [`lib/api-spec/openapi.yaml`](./lib/api-spec/openapi.yaml).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
