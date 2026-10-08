import {
  boolean,
  date,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

export const userProfilesTable = pgTable(
  "crm_user_profiles",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("SalesExecutive"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    clerkIdUnique: uniqueIndex("crm_user_profiles_clerk_id_unique").on(table.clerkUserId),
    emailUnique: uniqueIndex("crm_user_profiles_email_unique").on(table.email),
  }),
);

export const customersTable = pgTable(
  "crm_customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    company: text("company").notNull().default(""),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    status: text("status").notNull().default("active"),
    source: text("source").notNull().default(""),
    ownerId: text("owner_id"),
    ownerName: text("owner_name").notNull().default("Unassigned"),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (table) => ({
    emailUnique: uniqueIndex("crm_customers_email_unique").on(table.email),
    phoneUnique: uniqueIndex("crm_customers_phone_unique").on(table.phone),
  }),
);

export const leadsTable = pgTable("crm_leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  source: text("source").notNull().default(""),
  status: text("status").notNull().default("new"),
  value: doublePrecision("value"),
  ownerId: text("owner_id"),
  ownerName: text("owner_name").notNull().default("Unassigned"),
  notes: text("notes").notNull().default(""),
  ...timestamps,
});

export const opportunitiesTable = pgTable("crm_opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull().default(""),
  leadId: integer("lead_id"),
  amount: doublePrecision("amount").notNull(),
  probability: integer("probability").notNull().default(25),
  stage: text("stage").notNull().default("prospecting"),
  closeDate: date("close_date", { mode: "string" }).notNull(),
  ownerId: text("owner_id"),
  ownerName: text("owner_name").notNull().default("Unassigned"),
  ...timestamps,
});

export const followUpsTable = pgTable("crm_follow_ups", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("planned"),
  type: text("type").notNull().default("task"),
  relatedType: text("related_type").notNull().default("customer"),
  relatedId: integer("related_id"),
  relatedName: text("related_name").notNull().default(""),
  ownerId: text("owner_id"),
  ownerName: text("owner_name").notNull().default("Unassigned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activitiesTable = pgTable("crm_activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  userId: text("user_id"),
  userName: text("user_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogTable = pgTable("crm_audit_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  description: text("description").notNull(),
  userId: text("user_id"),
  userName: text("user_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type Customer = typeof customersTable.$inferSelect;
export type Lead = typeof leadsTable.$inferSelect;
export type Opportunity = typeof opportunitiesTable.$inferSelect;
export type FollowUp = typeof followUpsTable.$inferSelect;
