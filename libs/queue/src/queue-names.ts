/**
 * Single source of truth for BullMQ queue names. Importing this everywhere
 * (api producer side + worker consumer side) prevents string-typo drift.
 */
export const QUEUE_NAMES = {
  DOCUMENT_PROCESSING: 'document-processing',
  AGENT_RUN: 'agent-run',
  WEBHOOK_DELIVERY: 'webhook-delivery',
  USAGE_AGGREGATION: 'usage-aggregation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
