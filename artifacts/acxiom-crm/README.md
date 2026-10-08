# AcxiomCRM

AcxiomCRM is a role-based sales workspace for managing customer relationships, leads, opportunities, follow-ups, and team activity. It is a React and TypeScript web app backed by the workspace API server and PostgreSQL database.

## Get started

1. Open the AcxiomCRM preview and select **Start using Acxiom**.
2. Create an account through the Clerk sign-up screen. The first registered account becomes the CRM administrator.
3. The app creates a small example customer, lead, opportunity, and follow-up dataset the first time that account connects.
4. Use **Team access** to set up a teammate's role. The teammate can then sign up with that same email address and the CRM will attach the role you assigned.

AcxiomCRM uses Clerk for sign-in and account verification. It does not ship shared demo passwords or seeded login accounts.

## Roles

- **Admin** — manage team access, CRM records, reports, and audit history.
- **Manager** — work with CRM records and reports, and review audit history.
- **SalesExecutive** — work with CRM records, follow-ups, and reports.

Access is checked by the API as well as reflected in the navigation. Inactive CRM profiles cannot use the API.

## Main areas

- Overview dashboard with customer, lead, pipeline, follow-up, and recent activity summaries.
- Customers and leads with search, create, edit, and delete actions.
- Lead conversion into a customer and an opportunity.
- Opportunity pipeline with stage and close-date tracking.
- Planned and completed follow-ups linked to customers, leads, or opportunities.
- Reports for pipeline stages, lead status, conversion rate, and lead ownership.
- Admin-only team access and Admin/Manager audit history.

## API

The API is mounted at `/api` and authenticates CRM routes with Clerk:

- `/api/me`, `/api/dashboard`
- `/api/customers`, `/api/leads`, `/api/opportunities`, `/api/follow-ups`
- `/api/activities`, `/api/audit`, `/api/reports`, `/api/users`
- `/api/healthz` for the service health check

The OpenAPI contract is in `lib/api-spec/openapi.yaml`. Generated clients and runtime request validation are kept in sync with that contract.

## Local development

From the workspace root:

```sh
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-spec run codegen
```

Run the **API Server** and **AcxiomCRM web** workflows to use the app. Replit provides the Clerk configuration and database connection through the workspace environment.
