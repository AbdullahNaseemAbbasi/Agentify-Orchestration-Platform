/**
 * Payload for the `document-processing` queue. Only includes IDs and the
 * raw text — never the bulk content if it's large; large source data
 * should be loaded from object storage by the worker via documentId.
 */
export interface DocumentProcessingJob {
  documentId: string;
  knowledgeBaseId: string;
  workspaceId: string;
  /** Inline text source. Future variants will use sourceUrl for files. */
  text: string;
}

export const DOCUMENT_PROCESSING_JOB_NAME = 'process-document';  
