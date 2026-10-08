import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  activitiesTable,
  customersTable,
  followUpsTable,
  leadsTable,
  opportunitiesTable,
  type UserProfile,
} from "@workspace/db";

function calendarDate(daysFromNow: number): string {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + daysFromNow);
  return value.toISOString().slice(0, 10);
}

export async function seedDemoData(owner: UserProfile): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(78124619)`);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(customersTable);
    if (Number(count) > 0) return;

    const customers = await tx
      .insert(customersTable)
      .values([
        {
          name: "Maya Chen",
          company: "Northwind Analytics",
          email: "maya.chen@northwind.example",
          phone: "+1 415 555 0182",
          status: "active",
          source: "Referral",
          ownerId: owner.clerkUserId,
          ownerName: owner.name,
          notes: "Interested in a multi-team rollout this quarter.",
        },
        {
          name: "Oliver Grant",
          company: "Alder & Reed",
          email: "oliver.grant@alderreed.example",
          phone: "+1 415 555 0137",
          status: "active",
          source: "Website",
          ownerId: owner.clerkUserId,
          ownerName: owner.name,
          notes: "Follow up after the finance review.",
        },
        {
          name: "Priya Nair",
          company: "BrightPath Health",
          email: "priya.nair@brightpath.example",
          phone: "+1 415 555 0164",
          status: "active",
          source: "Event",
          ownerId: owner.clerkUserId,
          ownerName: owner.name,
          notes: "Asked for a security overview and implementation plan.",
        },
        {
          name: "Ethan Brooks",
          company: "Summit Fieldworks",
          email: "ethan.brooks@summitfield.example",
          phone: "+1 415 555 0191",
          status: "inactive",
          source: "Partner",
          ownerId: owner.clerkUserId,
          ownerName: owner.name,
          notes: "Paused until the next budget cycle.",
        },
      ])
      .returning();

    const leads = await tx
      .insert(leadsTable)
      .values([
        {
          name: "Lena Ortiz",
          company: "Vertex & Co.",
          email: "lena.ortiz@vertex.example",
          phone: "+1 415 555 0113",
          source: "Inbound",
          status: "qualified",
          value: 28000,
          ownerId: owner.clerkUserId,
          ownerName: owner.name,
          notes: "Evaluating a phased deployment.",
        },
        {
          name: "Noah Williams",
          company: "Harborline Studio",
          email: "noah.williams@harborline.example",
          phone: "+1 415 555 0178",
          source: "Referral",
          status: "contacted",
          value: 14500,
          ownerId: owner.clerkUserId,
          ownerName: owner.name,
          notes: "Requested a product walkthrough.",
        },
        {
          name: "Amara Singh",
          company: "Lighthouse Systems",
          email: "amara.singh@lighthouse.example",
          phone: "+1 415 555 0128",
          source: "Conference",
          status: "new",
          value: 19500,
          ownerId: owner.clerkUserId,
          ownerName: owner.name,
          notes: "Met at the operations summit.",
        },
      ])
      .returning();

    await tx.insert(opportunitiesTable).values([
      {
        title: "Northwind annual platform",
        customerId: customers[0].id,
        customerName: customers[0].company,
        amount: 48000,
        probability: 70,
        stage: "proposal",
        closeDate: calendarDate(23),
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
      {
        title: "Alder & Reed team expansion",
        customerId: customers[1].id,
        customerName: customers[1].company,
        amount: 32500,
        probability: 45,
        stage: "negotiation",
        closeDate: calendarDate(38),
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
      {
        title: "BrightPath onboarding",
        customerId: customers[2].id,
        customerName: customers[2].company,
        amount: 22000,
        probability: 30,
        stage: "qualification",
        closeDate: calendarDate(52),
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
      {
        title: "Summit service renewal",
        customerId: customers[3].id,
        customerName: customers[3].company,
        amount: 18000,
        probability: 100,
        stage: "won",
        closeDate: calendarDate(-14),
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
      {
        title: "Vertex operations suite",
        leadId: leads[0].id,
        customerName: leads[0].company,
        amount: 28000,
        probability: 20,
        stage: "prospecting",
        closeDate: calendarDate(60),
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
    ]);

    await tx.insert(followUpsTable).values([
      {
        title: "Review proposal scope",
        dueDate: calendarDate(0),
        status: "planned",
        type: "meeting",
        relatedType: "customer",
        relatedId: customers[0].id,
        relatedName: customers[0].company,
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
      {
        title: "Send finance overview",
        dueDate: calendarDate(1),
        status: "planned",
        type: "email",
        relatedType: "customer",
        relatedId: customers[1].id,
        relatedName: customers[1].company,
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
      {
        title: "Call about product walkthrough",
        dueDate: calendarDate(2),
        status: "planned",
        type: "call",
        relatedType: "lead",
        relatedId: leads[1].id,
        relatedName: leads[1].company,
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
      {
        title: "Prepare security briefing",
        dueDate: calendarDate(4),
        status: "planned",
        type: "task",
        relatedType: "customer",
        relatedId: customers[2].id,
        relatedName: customers[2].company,
        ownerId: owner.clerkUserId,
        ownerName: owner.name,
      },
    ]);

    await tx.insert(activitiesTable).values([
      {
        type: "meeting",
        description: `Proposal scope review scheduled with ${customers[0].company}.`,
        targetType: "customer",
        targetId: customers[0].id,
        userId: owner.clerkUserId,
        userName: owner.name,
      },
      {
        type: "call",
        description: `${leads[0].name} qualified for a ${leads[0].company} rollout.`,
        targetType: "lead",
        targetId: leads[0].id,
        userId: owner.clerkUserId,
        userName: owner.name,
      },
    ]);
  });
}
