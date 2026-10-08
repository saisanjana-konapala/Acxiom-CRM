import { Router, type IRouter, type Request } from "express";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  CreateActivityBody,
  CreateActivityResponse,
  CreateCustomerBody,
  CreateCustomerResponse,
  CreateFollowUpBody,
  CreateFollowUpResponse,
  CreateLeadBody,
  CreateLeadResponse,
  CreateOpportunityBody,
  CreateOpportunityResponse,
  CreateUserProfileBody,
  CreateUserProfileResponse,
  ConvertLeadParams,
  ConvertLeadResponse,
  DeleteCustomerParams,
  DeleteCustomerResponse,
  DeleteFollowUpParams,
  DeleteFollowUpResponse,
  DeleteLeadParams,
  DeleteLeadResponse,
  DeleteOpportunityParams,
  DeleteOpportunityResponse,
  GetActivitiesResponse,
  GetAuditResponse,
  GetCustomersQueryParams,
  GetCustomersResponse,
  GetDashboardResponse,
  GetFollowUpsQueryParams,
  GetFollowUpsResponse,
  GetLeadsQueryParams,
  GetLeadsResponse,
  GetMeResponse,
  GetOpportunitiesQueryParams,
  GetOpportunitiesResponse,
  GetReportsResponse,
  GetUsersResponse,
  UpdateCustomerBody,
  UpdateCustomerParams,
  UpdateCustomerResponse,
  UpdateFollowUpBody,
  UpdateFollowUpParams,
  UpdateFollowUpResponse,
  UpdateLeadBody,
  UpdateLeadParams,
  UpdateLeadResponse,
  UpdateOpportunityBody,
  UpdateOpportunityParams,
  UpdateOpportunityResponse,
  UpdateUserProfileBody,
  UpdateUserProfileParams,
  UpdateUserProfileResponse,
} from "@workspace/api-zod";
import {
  activitiesTable,
  auditLogTable,
  customersTable,
  followUpsTable,
  leadsTable,
  opportunitiesTable,
  userProfilesTable,
} from "@workspace/db";
import { ensureCrmUser, requireRole } from "../middlewares/crmAuth";

const router: IRouter = Router();
router.use(ensureCrmUser);

function actor(req: Request) {
  return req.crmUser!;
}

function recordAudit(
  user: NonNullable<ReturnType<typeof actor>>,
  action: string,
  entity: string,
  entityId: number | null,
  description: string,
) {
  return db.insert(auditLogTable).values({
    action,
    entity,
    entityId,
    description,
    userId: user.clerkUserId,
    userName: user.name,
  });
}

function addActivity(
  user: NonNullable<ReturnType<typeof actor>>,
  type: string,
  description: string,
  targetType: string,
  targetId: number | null,
) {
  return db.insert(activitiesTable).values({
    type,
    description,
    targetType,
    targetId,
    userId: user.clerkUserId,
    userName: user.name,
  });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function validId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function hasUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "23505";
}

router.get("/me", async (req, res): Promise<void> => {
  const profile = actor(req);
  await recordAudit(profile, "login", "session", null, `${profile.name} signed in.`);
  res.json(
    GetMeResponse.parse({
      id: profile.id,
      clerkUserId: profile.clerkUserId,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      isActive: profile.isActive,
    }),
  );
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [customers, leads, opportunities, followUps, activity] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(customersTable),
    db.select().from(leadsTable),
    db.select().from(opportunitiesTable),
    db.select().from(followUpsTable),
    db.select().from(activitiesTable).orderBy(sql`${activitiesTable.createdAt} desc`).limit(7),
  ]);
  const stages = new Map<string, { count: number; value: number }>();
  let pipelineValue = 0;
  let wonValue = 0;
  for (const item of opportunities) {
    const stage = stages.get(item.stage) ?? { count: 0, value: 0 };
    stage.count += 1;
    stage.value += item.amount;
    stages.set(item.stage, stage);
    if (item.stage === "won") wonValue += item.amount;
    else if (item.stage !== "lost") pipelineValue += item.amount;
  }
  const dashboard = {
    customerCount: Number(customers[0]?.count ?? 0),
    leadCount: leads.filter((lead) => !["converted", "lost"].includes(lead.status)).length,
    openOpportunityCount: opportunities.filter((item) => !["won", "lost"].includes(item.stage)).length,
    pipelineValue,
    wonValue,
    followUpsDue: followUps.filter((item) => item.status === "planned" && item.dueDate <= today()).length,
    stages: [...stages.entries()].map(([stage, value]) => ({ stage, ...value })),
    recentActivity: activity,
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

router.get("/customers", async (req, res): Promise<void> => {
  const query = GetCustomersQueryParams.parse(req.query);
  const clauses = [];
  if (query.search) {
    const term = `%${query.search}%`;
    clauses.push(or(
      ilike(customersTable.name, term),
      ilike(customersTable.company, term),
      ilike(customersTable.email, term),
      ilike(customersTable.phone, term),
    ));
  }
  if (query.status) clauses.push(eq(customersTable.status, query.status));
  const rows = await db.select().from(customersTable)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(sql`${customersTable.createdAt} desc`);
  res.json(GetCustomersResponse.parse(rows));
});

router.post("/customers", async (req, res): Promise<void> => {
  const body = CreateCustomerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const email = body.data.email.trim().toLowerCase();
  const phone = body.data.phone.trim();
  const duplicate = await db.select({ id: customersTable.id }).from(customersTable).where(
    or(eq(customersTable.email, email), eq(customersTable.phone, phone)),
  ).limit(1);
  if (duplicate.length) {
    res.status(409).json({ error: "A customer already uses this email address or phone number." });
    return;
  }
  const user = actor(req);
  try {
    const [row] = await db.insert(customersTable).values({
      ...body.data,
      email,
      phone,
      ownerId: user.clerkUserId,
      ownerName: user.name,
    }).returning();
    await recordAudit(user, "create", "customer", row.id, `Created customer ${row.name}.`);
    await addActivity(user, "note", `Added ${row.name} at ${row.company}.`, "customer", row.id);
    res.status(201).json(CreateCustomerResponse.parse(row));
  } catch (error) {
    if (hasUniqueViolation(error)) {
      res.status(409).json({ error: "A customer already uses this email address or phone number." });
      return;
    }
    throw error;
  }
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  const body = UpdateCustomerBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const email = body.data.email.trim().toLowerCase();
  const phone = body.data.phone.trim();
  const duplicate = await db.select({ id: customersTable.id }).from(customersTable).where(
    and(
      or(eq(customersTable.email, email), eq(customersTable.phone, phone)),
      sql`${customersTable.id} <> ${params.data.id}`,
    ),
  ).limit(1);
  if (duplicate.length) {
    res.status(409).json({ error: "A customer already uses this email address or phone number." });
    return;
  }
  const [row] = await db.update(customersTable)
    .set({ ...body.data, email, phone, updatedAt: new Date() })
    .where(eq(customersTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Customer not found." });
    return;
  }
  const user = actor(req);
  await recordAudit(user, "update", "customer", row.id, `Updated customer ${row.name}.`);
  await addActivity(user, "note", `Updated ${row.name} at ${row.company}.`, "customer", row.id);
  res.json(UpdateCustomerResponse.parse(row));
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(customersTable).where(eq(customersTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Customer not found." });
    return;
  }
  await recordAudit(actor(req), "delete", "customer", row.id, `Deleted customer ${row.name}.`);
  res.status(204).end();
});

router.get("/leads", async (req, res): Promise<void> => {
  const query = GetLeadsQueryParams.parse(req.query);
  const clauses = [];
  if (query.search) {
    const term = `%${query.search}%`;
    clauses.push(or(ilike(leadsTable.name, term), ilike(leadsTable.company, term), ilike(leadsTable.email, term)));
  }
  if (query.status) clauses.push(eq(leadsTable.status, query.status));
  const rows = await db.select().from(leadsTable)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(sql`${leadsTable.createdAt} desc`);
  res.json(GetLeadsResponse.parse(rows));
});

router.post("/leads", async (req, res): Promise<void> => {
  const body = CreateLeadBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const user = actor(req);
  const [row] = await db.insert(leadsTable).values({
    ...body.data,
    email: body.data.email.trim().toLowerCase(),
    ownerId: user.clerkUserId,
    ownerName: user.name,
  }).returning();
  await recordAudit(user, "create", "lead", row.id, `Created lead ${row.name}.`);
  await addActivity(user, "note", `Added lead ${row.name} from ${row.source || "an unspecified source"}.`, "lead", row.id);
  res.status(201).json(CreateLeadResponse.parse(row));
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  const body = UpdateLeadBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const [row] = await db.update(leadsTable).set({
    ...body.data,
    email: body.data.email.trim().toLowerCase(),
    updatedAt: new Date(),
  }).where(eq(leadsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  const user = actor(req);
  await recordAudit(user, "update", "lead", row.id, `Updated lead ${row.name}.`);
  await addActivity(user, "note", `Updated lead ${row.name}.`, "lead", row.id);
  res.json(UpdateLeadResponse.parse(row));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(leadsTable).where(eq(leadsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  await recordAudit(actor(req), "delete", "lead", row.id, `Deleted lead ${row.name}.`);
  res.status(204).end();
});

router.post("/leads/:id/convert", async (req, res): Promise<void> => {
  const params = ConvertLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id)).limit(1);
  if (!lead) {
    res.status(404).json({ error: "Lead not found." });
    return;
  }
  if (lead.status === "converted") {
    res.status(409).json({ error: "This lead has already been converted." });
    return;
  }
  const user = actor(req);
  const converted = await db.transaction(async (tx) => {
    const [matchingCustomer] = await tx.select().from(customersTable)
      .where(or(eq(customersTable.email, lead.email.toLowerCase()), eq(customersTable.phone, lead.phone)))
      .limit(1);
    const [customer] = matchingCustomer
      ? [matchingCustomer]
      : await tx.insert(customersTable).values({
          name: lead.name,
          company: lead.company,
          email: lead.email.toLowerCase(),
          phone: lead.phone,
          source: lead.source,
          notes: lead.notes,
          status: "active",
          ownerId: user.clerkUserId,
          ownerName: user.name,
        }).returning();
    const [opportunity] = await tx.insert(opportunitiesTable).values({
      title: `${lead.company || lead.name} opportunity`,
      customerId: customer.id,
      customerName: customer.company || customer.name,
      leadId: lead.id,
      amount: lead.value && lead.value > 0 ? lead.value : 1000,
      probability: 25,
      stage: "qualification",
      closeDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      ownerId: user.clerkUserId,
      ownerName: user.name,
    }).returning();
    await tx.update(leadsTable)
      .set({ status: "converted", updatedAt: new Date() })
      .where(eq(leadsTable.id, lead.id));
    return { customer, opportunity };
  });
  await recordAudit(user, "convert", "lead", lead.id, `Converted ${lead.name} into a customer and opportunity.`);
  await addActivity(user, "note", `Converted ${lead.name} into a customer and opportunity.`, "lead", lead.id);
  res.json(ConvertLeadResponse.parse(converted));
});

router.get("/opportunities", async (req, res): Promise<void> => {
  const query = GetOpportunitiesQueryParams.parse(req.query);
  const clauses = [];
  if (query.search) {
    const term = `%${query.search}%`;
    clauses.push(or(ilike(opportunitiesTable.title, term), ilike(opportunitiesTable.customerName, term)));
  }
  if (query.stage) clauses.push(eq(opportunitiesTable.stage, query.stage));
  const rows = await db.select().from(opportunitiesTable)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(sql`${opportunitiesTable.createdAt} desc`);
  res.json(GetOpportunitiesResponse.parse(rows));
});

function toCalendarDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function validateOpportunity(data: { stage: string; closeDate: Date | string }, res: import("express").Response): boolean {
  if (!["won", "lost"].includes(data.stage) && toCalendarDate(data.closeDate) < today()) {
    res.status(400).json({ error: "An active opportunity cannot have a close date in the past." });
    return false;
  }
  return true;
}

async function opportunityNames(data: { customerId: number | null; leadId: number | null }) {
  let customerName = "";
  if (data.customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, data.customerId)).limit(1);
    if (!customer) return { error: "Customer not found." } as const;
    customerName = customer.company || customer.name;
  } else if (data.leadId) {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, data.leadId)).limit(1);
    if (!lead) return { error: "Lead not found." } as const;
    customerName = lead.company || lead.name;
  }
  return { customerName } as const;
}

router.post("/opportunities", async (req, res): Promise<void> => {
  const body = CreateOpportunityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!validateOpportunity(body.data, res)) return;
  const names = await opportunityNames(body.data);
  if ("error" in names) {
    res.status(400).json({ error: names.error });
    return;
  }
  const user = actor(req);
  const [row] = await db.insert(opportunitiesTable).values({
    ...body.data,
    closeDate: toCalendarDate(body.data.closeDate),
    customerName: names.customerName,
    ownerId: user.clerkUserId,
    ownerName: user.name,
  }).returning();
  await recordAudit(user, "create", "opportunity", row.id, `Created opportunity ${row.title}.`);
  await addActivity(user, "note", `Added opportunity ${row.title}.`, "opportunity", row.id);
  res.status(201).json(CreateOpportunityResponse.parse(row));
});

router.patch("/opportunities/:id", async (req, res): Promise<void> => {
  const params = UpdateOpportunityParams.safeParse(req.params);
  const body = UpdateOpportunityBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  if (!validateOpportunity(body.data, res)) return;
  const names = await opportunityNames(body.data);
  if ("error" in names) {
    res.status(400).json({ error: names.error });
    return;
  }
  const [row] = await db.update(opportunitiesTable).set({
    ...body.data,
    closeDate: toCalendarDate(body.data.closeDate),
    customerName: names.customerName,
    updatedAt: new Date(),
  }).where(eq(opportunitiesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Opportunity not found." });
    return;
  }
  const user = actor(req);
  await recordAudit(user, "update", "opportunity", row.id, `Updated opportunity ${row.title}.`);
  await addActivity(user, "note", `Updated opportunity ${row.title} (${row.stage}).`, "opportunity", row.id);
  res.json(UpdateOpportunityResponse.parse(row));
});

router.delete("/opportunities/:id", async (req, res): Promise<void> => {
  const params = DeleteOpportunityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(opportunitiesTable).where(eq(opportunitiesTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Opportunity not found." });
    return;
  }
  await recordAudit(actor(req), "delete", "opportunity", row.id, `Deleted opportunity ${row.title}.`);
  res.status(204).end();
});

router.get("/follow-ups", async (req, res): Promise<void> => {
  const query = GetFollowUpsQueryParams.parse(req.query);
  const clauses = [];
  if (query.search) clauses.push(or(ilike(followUpsTable.title, `%${query.search}%`), ilike(followUpsTable.relatedName, `%${query.search}%`)));
  if (query.status) clauses.push(eq(followUpsTable.status, query.status));
  const rows = await db.select().from(followUpsTable)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(followUpsTable.dueDate);
  res.json(GetFollowUpsResponse.parse(rows));
});

router.post("/follow-ups", async (req, res): Promise<void> => {
  const body = CreateFollowUpBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.status === "planned" && toCalendarDate(body.data.dueDate) < today()) {
    res.status(400).json({ error: "A planned follow-up cannot be dated earlier than today." });
    return;
  }
  const user = actor(req);
  const [row] = await db.insert(followUpsTable).values({
    ...body.data,
    dueDate: toCalendarDate(body.data.dueDate),
    ownerId: user.clerkUserId,
    ownerName: user.name,
  }).returning();
  await recordAudit(user, "create", "follow-up", row.id, `Created follow-up ${row.title}.`);
  await addActivity(user, row.type, `Scheduled ${row.title} for ${row.relatedName}.`, row.relatedType, row.relatedId);
  res.status(201).json(CreateFollowUpResponse.parse(row));
});

router.patch("/follow-ups/:id", async (req, res): Promise<void> => {
  const params = UpdateFollowUpParams.safeParse(req.params);
  const body = UpdateFollowUpBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  if (body.data.status === "planned" && toCalendarDate(body.data.dueDate) < today()) {
    res.status(400).json({ error: "A planned follow-up cannot be dated earlier than today." });
    return;
  }
  const [row] = await db.update(followUpsTable).set({
    ...body.data,
    dueDate: toCalendarDate(body.data.dueDate),
  })
    .where(eq(followUpsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Follow-up not found." });
    return;
  }
  const user = actor(req);
  await recordAudit(user, "update", "follow-up", row.id, `Updated follow-up ${row.title}.`);
  await addActivity(user, row.type, `${row.status === "completed" ? "Completed" : "Updated"} follow-up: ${row.title}.`, row.relatedType, row.relatedId);
  res.json(UpdateFollowUpResponse.parse(row));
});

router.delete("/follow-ups/:id", async (req, res): Promise<void> => {
  const params = DeleteFollowUpParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(followUpsTable).where(eq(followUpsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Follow-up not found." });
    return;
  }
  await recordAudit(actor(req), "delete", "follow-up", row.id, `Deleted follow-up ${row.title}.`);
  res.status(204).end();
});

router.get("/activities", async (_req, res): Promise<void> => {
  const rows = await db.select().from(activitiesTable)
    .orderBy(sql`${activitiesTable.createdAt} desc`).limit(100);
  res.json(GetActivitiesResponse.parse(rows));
});

router.post("/activities", async (req, res): Promise<void> => {
  const body = CreateActivityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const user = actor(req);
  const [row] = await db.insert(activitiesTable).values({
    ...body.data,
    userId: user.clerkUserId,
    userName: user.name,
  }).returning();
  await recordAudit(user, "create", "activity", row.id, `Recorded ${row.type}: ${row.description}`);
  res.status(201).json(CreateActivityResponse.parse(row));
});

router.get("/audit", requireRole("Admin", "Manager"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(auditLogTable)
    .orderBy(sql`${auditLogTable.createdAt} desc`).limit(500);
  res.json(GetAuditResponse.parse(rows));
});

router.get("/reports", async (_req, res): Promise<void> => {
  const [leads, opportunities] = await Promise.all([
    db.select().from(leadsTable),
    db.select().from(opportunitiesTable),
  ]);
  const stageMap = new Map<string, { count: number; value: number }>();
  for (const opportunity of opportunities) {
    const current = stageMap.get(opportunity.stage) ?? { count: 0, value: 0 };
    current.count += 1;
    current.value += opportunity.amount;
    stageMap.set(opportunity.stage, current);
  }
  const statusMap = new Map<string, number>();
  const ownerMap = new Map<string, number>();
  for (const lead of leads) {
    statusMap.set(lead.status, (statusMap.get(lead.status) ?? 0) + 1);
    ownerMap.set(lead.ownerName, (ownerMap.get(lead.ownerName) ?? 0) + 1);
  }
  const convertedCount = leads.filter((lead) => lead.status === "converted").length;
  res.json(GetReportsResponse.parse({
    pipelineByStage: [...stageMap.entries()].map(([stage, totals]) => ({ stage, ...totals })),
    leadsByStatus: [...statusMap.entries()].map(([label, count]) => ({ label, count })),
    conversionRate: leads.length ? (convertedCount / leads.length) * 100 : 0,
    topOwners: [...ownerMap.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 5),
  }));
});

router.get("/users", requireRole("Admin"), async (_req, res): Promise<void> => {
  const users = await db.select().from(userProfilesTable).orderBy(userProfilesTable.name);
  res.json(GetUsersResponse.parse(users.map((user) => ({
    ...user,
    clerkUserId: user.clerkUserId ?? `pending:${user.email}`,
  }))));
});

router.post("/users", requireRole("Admin"), async (req, res): Promise<void> => {
  const body = CreateUserProfileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const email = body.data.email.trim().toLowerCase();
  const [existing] = await db.select({ id: userProfilesTable.id }).from(userProfilesTable)
    .where(eq(userProfilesTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "A CRM profile already exists for this email." });
    return;
  }
  const [row] = await db.insert(userProfilesTable).values({
    ...body.data,
    email,
    clerkUserId: `pending:${email}`,
  }).returning();
  const user = actor(req);
  await recordAudit(user, "create", "user", row.id, `Created ${row.role} profile for ${email}.`);
  res.status(201).json(CreateUserProfileResponse.parse(row));
});

router.patch("/users/:id", requireRole("Admin"), async (req, res): Promise<void> => {
  const params = UpdateUserProfileParams.safeParse(req.params);
  const body = UpdateUserProfileBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const [current] = await db.select().from(userProfilesTable)
    .where(eq(userProfilesTable.id, params.data.id)).limit(1);
  if (!current) {
    res.status(404).json({ error: "User profile not found." });
    return;
  }
  if (current.role === "Admin" && current.isActive && (body.data.role !== "Admin" || !body.data.isActive)) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(userProfilesTable)
      .where(and(eq(userProfilesTable.role, "Admin"), eq(userProfilesTable.isActive, true)));
    if (Number(count) <= 1) {
      res.status(400).json({ error: "At least one active administrator must remain." });
      return;
    }
  }
  const email = body.data.email.trim().toLowerCase();
  const [row] = await db.update(userProfilesTable).set({
    ...body.data,
    email,
    updatedAt: new Date(),
  }).where(eq(userProfilesTable.id, params.data.id)).returning();
  const user = actor(req);
  await recordAudit(user, "update", "user", row.id, `Updated CRM access for ${row.email}.`);
  res.json(UpdateUserProfileResponse.parse({
    ...row,
    clerkUserId: row.clerkUserId ?? `pending:${row.email}`,
  }));
});

export default router;
