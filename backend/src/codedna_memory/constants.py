ACME_REPOSITORY_ID = "repo-acme-commerce"
ACME_REPOSITORY_SLUG = "acme-commerce"
ACME_BANK_ID = "codedna-repo-acme-commerce"

ANALYTICS_REPOSITORY_ID = "repo-analytics-service"
ANALYTICS_REPOSITORY_SLUG = "analytics-service"
ANALYTICS_BANK_ID = "codedna-repo-analytics-service"

SOURCE_PR_ID = "pr-acme-42"
CANDIDATE_PR_ID = "pr-acme-87"
DECISION_ID = "DEC-0042"
DOCUMENT_ID = "decision-DEC-0042"

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

