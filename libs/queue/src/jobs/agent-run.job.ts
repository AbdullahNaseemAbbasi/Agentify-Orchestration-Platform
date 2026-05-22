/**
 * Payload for the `agent-run` queue. The Run row is created up-front by
 * the API (status PENDING) so the client gets a run id immediately; the
 * worker then loads everything else from that id. Only `userInput` is
 * passed inline because it is not stored on the Run.
 */
export interface AgentRunJob {
  runId: string;
  workspaceId: string;
  userInput: string;
}

export const AGENT_RUN_JOB_NAME = 'execute-run';
