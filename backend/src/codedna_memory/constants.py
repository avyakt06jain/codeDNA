ACME_REPOSITORY_ID = "repo-acme-commerce"
ACME_REPOSITORY_SLUG = "acme-commerce"
ACME_BANK_ID = "codedna-repo-acme-commerce"

ANALYTICS_REPOSITORY_ID = "repo-analytics-service"
ANALYTICS_REPOSITORY_SLUG = "analytics-service"
ANALYTICS_BANK_ID = "codedna-repo-analytics-service"
ANALYTICS_PR_ID = "pr-analytics-11"
ANALYTICS_CANDIDATE_PR_ID = "pr-analytics-29"
ANALYTICS_DECISION_ID = "DEC-0211"
ANALYTICS_DOCUMENT_ID = "decision-DEC-0211"

SOURCE_PR_ID = "pr-acme-42"
CANDIDATE_PR_ID = "pr-acme-87"
DECISION_ID = "DEC-0042"
DOCUMENT_ID = "decision-DEC-0042"
SUPERSESSION_SOURCE_PR_ID = "pr-acme-103"
SUPERSESSION_CANDIDATE_PR_ID = "pr-acme-120"
SUPERSEDING_DECISION_ID = "DEC-0103"
SUPERSEDING_DOCUMENT_ID = "decision-DEC-0103"
SHIPPING_DECISION_TITLE = "Shipment transitions use the shipping workflow"
SHIPPING_DECISION_RULE = "Use OrderWorkflow.shipOrder() for transitions to shipped."
SHIPPING_DECISION_RATIONALE = (
    "The specialized workflow emits shipment and audit events atomically."
)
SHIPPING_DECISION_SCOPE = {
    "paths": ["src/orders/**"],
    "operations": ["transition to shipped"],
}

CANDIDATE_PR_DIFF = "\n".join(
    [
        "--- a/src/orders/update.ts",
        "+++ b/src/orders/update.ts",
        "@@ -1,15 +1,20 @@",
        ' import { prisma } from "../db";',
        " ",
        " export async function markFulfilledOrderShipped(orderId: string) {",
        "   const order = await prisma.order.findUnique({",
        "     where: { id: orderId },",
        "   });",
        "   if (!order) {",
        '     throw new Error("Order not found");',
        "   }",
        '   if (order.status !== "fulfilled") {',
        '     throw new Error("Only fulfilled orders can be shipped");',
        "   }",
        " ",
        "+  await prisma.order.update({",
        "+    where: { id: orderId },",
        '+    data: { status: "shipped" },',
        "+  });",
        "+",
        '   return { id: order.id, status: "shipped" };',
        " }",
    ]
) + "\n"

ANALYTICS_PR_DIFF = "\n".join(
    [
        "--- a/src/events/capture.ts",
        "+++ b/src/events/capture.ts",
        "@@ -1,6 +1,7 @@",
        " export function capturePageView(name: string, occurredAt: Date) {",
        "   return db.events.insert({",
        "     name,",
        "-    occurredAt: occurredAt.toString(),",
        "+    occurredAt: occurredAt.toISOString(),",
        "+    storedAtUtc: occurredAt.toISOString(),",
        "   });",
        " }",
    ]
) + "\n"

ANALYTICS_CANDIDATE_PR_DIFF = "\n".join(
    [
        "--- a/src/events/session.ts",
        "+++ b/src/events/session.ts",
        "@@ -1,5 +1,7 @@",
        " export function recordSessionStarted(sessionId: string, receivedAt: Date) {",
        "   return db.sessions.insert({",
        "     sessionId,",
        "+    receivedAt: receivedAt.toLocaleString(\"en-US\"),",
        "+    receivedDay: receivedAt.toLocaleDateString(\"en-US\"),",
        "   });",
        " }",
    ]
) + "\n"

RECALL_QUERY = (
    "The candidate changes an order's shipping state through an ORM write in "
    "src/orders/update.ts. What prior team guidance is relevant?"
)

DECISION_CONTENT = (
    "In the synthetic acme-commerce PR 42 review, the team confirmed that order "
    "status changes must go through OrderService.transitionOrder(). Direct Prisma "
    "status updates bypass required audit-event emission. This applies to order "
    "status mutations in src/orders."
)

