import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Message, Prisma, Run, Thread } from '@prisma/client';
import { PrismaService } from '@agentify/database';
import {
  LlmCompletionRequest,
  LlmMessage,
  LlmService,
  LlmStreamChunk,
  LlmToolCall,
  LlmToolDefinition,
} from '@agentify/llm';
import { RedisService } from '@agentify/cache';
import { SearchService } from './search.service';
import { HttpToolExecutor } from './http-tool.executor';

export interface ExecuteRunResult {
  run: Run;
  /** Final assistant message content. Empty string when the loop hit maxSteps. */
  message: string;
}

/** Names of the events emitted over SSE while a run streams (spec §15.1). */
export type RunStreamEventName =
  | 'run.created'
  | 'message.delta'
  | 'tool_call.started'
  | 'tool_call.completed'
  | 'message.completed'
  | 'run.completed'
  | 'error';

/** One Server-Sent-Event produced by `executeStream`. */
export interface RunStreamEvent {
  event: RunStreamEventName;
  data: Record<string, unknown>;
}

interface AgentWithRelations {
  id: string;
  workspaceId: string;
  name: string;
  systemPrompt: string;
  model: string;
  provider: string;
  temperature: number;
  maxTokens: number;
  topP: number | null;
  responseFormat: Prisma.JsonValue | null;
  toolChoice: string;
  maxSteps: number;
  isActive: boolean;
  tools: Array<{
    tool: { id: string; name: string; description: string; parameters: Prisma.JsonValue };
  }>;
  knowledgeBases: Array<{ knowledgeBaseId: string; topK: number; minSimilarity: number }>;
}

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly search: SearchService,
    private readonly toolExecutor: HttpToolExecutor,
    private readonly redis: RedisService,
  ) {}

  async findById(workspaceId: string, id: string): Promise<Run> {
    const run = await this.prisma.run.findFirst({ where: { id, workspaceId } });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  /**
   * Request cancellation of an in-flight run. Sets a short-lived Redis
   * flag that both the sync and streaming reasoning loops poll before
   * each LLM call. Being in Redis (not memory) means an async run that
   * executes in the worker process is reachable too (spec §10.4).
   * No-op when the run has already reached a terminal state.
   */
  async requestCancel(workspaceId: string, runId: string): Promise<Run> {
    const run = await this.findById(workspaceId, runId);
    const terminal: Run['status'][] = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'];
    if (!terminal.includes(run.status)) {
      await this.redis.set(this.cancelKey(runId), '1', 3600);
      this.logger.log(`Cancellation requested for run ${runId}`);
    }
    return run;
  }

  private cancelKey(runId: string): string {
    return `run:cancel:${runId}`;
  }

  /** True once `requestCancel` has flagged this run. */
  private isCancelRequested(runId: string): Promise<boolean> {
    return this.redis.exists(this.cancelKey(runId));
  }

  /**
   * Run an agent on a (possibly new) thread with a single user input.
   * Performs the full reasoning loop synchronously: optional RAG context
   * injection, repeated LLM + tool calls up to agent.maxSteps, then
   * persists every message and the run-level token totals.
   */
  async execute(
    workspaceId: string,
    agentId: string,
    threadId: string | undefined,
    userInput: string,
  ): Promise<ExecuteRunResult> {
    const { agent, thread, run } = await this.prepareRun(workspaceId, agentId, threadId, userInput);

    try {
      // Save user message and load prior history (oldest first) AS llm messages.
      const userMsg = await this.prisma.message.create({
        data: { threadId: thread.id, runId: run.id, role: 'USER', content: userInput },
      });
      const history = await this.prisma.message.findMany({
        where: { threadId: thread.id, NOT: { id: userMsg.id } },
        orderBy: { createdAt: 'asc' },
      });

      // Optional RAG: search every attached KB and prepend hits as a
      // single system-context message.
      const ragContext = await this.buildRagContext(agent, userInput);

      const llmMessages: LlmMessage[] = [
        { role: 'system', content: this.composeSystemPrompt(agent.systemPrompt, ragContext) },
        ...history.map((m) => this.toLlmMessage(m)),
        { role: 'user', content: userInput },
      ];

      const tools = this.buildToolDefinitions(agent);

      // Reasoning loop.
      let stepCount = 0;
      const totals = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      let finalContent = '';
      let finished = false;
      let cancelled = false;

      for (let step = 0; step < agent.maxSteps; step++) {
        stepCount = step + 1;

        // Poll the cancel flag before every LLM call (spec §10.4).
        if (await this.isCancelRequested(run.id)) {
          cancelled = true;
          break;
        }

        const req: LlmCompletionRequest = {
          model: agent.model,
          messages: llmMessages,
          tools: tools.length > 0 ? tools : undefined,
          toolChoice: tools.length > 0 ? agent.toolChoice : undefined,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          topP: agent.topP ?? undefined,
          responseFormat: (agent.responseFormat as Record<string, unknown> | null) ?? undefined,
        };
        const response = await this.llm.complete(agent.provider, req);

        totals.inputTokens += response.usage.inputTokens;
        totals.outputTokens += response.usage.outputTokens;
        totals.totalTokens += response.usage.totalTokens;

        // Persist assistant message (with toolCalls JSON if present).
        await this.prisma.message.create({
          data: {
            threadId: thread.id,
            runId: run.id,
            role: 'ASSISTANT',
            content: response.message.content,
            toolCalls: response.message.toolCalls
              ? (response.message.toolCalls as unknown as Prisma.InputJsonValue)
              : undefined,
          },
        });
        llmMessages.push(response.message);

        if (response.finishReason === 'tool_calls' && response.message.toolCalls?.length) {
          await this.runToolCalls(
            thread.id,
            run.id,
            agent,
            response.message.toolCalls,
            llmMessages,
          );
          continue;
        }

        finalContent = response.message.content;
        finished = true;
        break;
      }

      const finalStatus = cancelled ? 'CANCELLED' : finished ? 'COMPLETED' : 'TIMEOUT';
      const updated = await this.prisma.run.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          completedAt: finished ? new Date() : null,
          failedAt: finished ? null : new Date(),
          stepCount,
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          totalTokens: totals.totalTokens,
          errorMessage: cancelled
            ? 'Run cancelled by request'
            : finished
              ? null
              : `Reached maxSteps (${agent.maxSteps}) without a final answer`,
        },
      });

      return { run: updated, message: finalContent };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Run ${run.id} failed: ${message}`);
      await this.prisma.run
        .update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: message.slice(0, 500),
          },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Streaming sibling of `execute`. Runs the same reasoning loop but,
   * instead of returning once at the end, yields SSE events as they
   * happen: a `message.delta` per token, `tool_call.*` around each tool
   * invocation, and a final `run.completed`. A failure becomes a single
   * `error` event rather than a thrown exception, because the HTTP
   * response has already started streaming.
   */
  async *executeStream(
    workspaceId: string,
    agentId: string,
    threadId: string | undefined,
    userInput: string,
  ): AsyncGenerator<RunStreamEvent> {
    let run: Run | undefined;
    try {
      const prepared = await this.prepareRun(workspaceId, agentId, threadId, userInput);
      run = prepared.run;
      const { agent, thread } = prepared;

      yield {
        event: 'run.created',
        data: { run_id: run.id, thread_id: thread.id, status: 'IN_PROGRESS' },
      };

      const userMsg = await this.prisma.message.create({
        data: { threadId: thread.id, runId: run.id, role: 'USER', content: userInput },
      });
      const history = await this.prisma.message.findMany({
        where: { threadId: thread.id, NOT: { id: userMsg.id } },
        orderBy: { createdAt: 'asc' },
      });

      const ragContext = await this.buildRagContext(agent, userInput);
      const llmMessages: LlmMessage[] = [
        { role: 'system', content: this.composeSystemPrompt(agent.systemPrompt, ragContext) },
        ...history.map((m) => this.toLlmMessage(m)),
        { role: 'user', content: userInput },
      ];
      const tools = this.buildToolDefinitions(agent);

      let stepCount = 0;
      const totals = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      let finished = false;
      let cancelled = false;

      for (let step = 0; step < agent.maxSteps; step++) {
        stepCount = step + 1;

        // Poll the cancel flag before every LLM call (spec §10.4).
        if (await this.isCancelRequested(run.id)) {
          cancelled = true;
          break;
        }

        const req: LlmCompletionRequest = {
          model: agent.model,
          messages: llmMessages,
          tools: tools.length > 0 ? tools : undefined,
          toolChoice: tools.length > 0 ? agent.toolChoice : undefined,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          topP: agent.topP ?? undefined,
          responseFormat: (agent.responseFormat as Record<string, unknown> | null) ?? undefined,
        };

        // Stream the completion: forward each text delta to the client
        // immediately, and keep the final `done` chunk for persistence.
        let done: Extract<LlmStreamChunk, { type: 'done' }> | undefined;
        for await (const chunk of this.llm.completeStream(agent.provider, req)) {
          if (chunk.type === 'delta') {
            yield { event: 'message.delta', data: { delta: chunk.content } };
          } else {
            done = chunk;
          }
        }
        if (!done) throw new Error('LLM stream ended without a final chunk');

        totals.inputTokens += done.usage.inputTokens;
        totals.outputTokens += done.usage.outputTokens;
        totals.totalTokens += done.usage.totalTokens;

        const assistantMsg = await this.prisma.message.create({
          data: {
            threadId: thread.id,
            runId: run.id,
            role: 'ASSISTANT',
            content: done.message.content,
            toolCalls: done.message.toolCalls
              ? (done.message.toolCalls as unknown as Prisma.InputJsonValue)
              : undefined,
          },
        });
        llmMessages.push(done.message);

        if (done.finishReason === 'tool_calls' && done.message.toolCalls?.length) {
          for (const call of done.message.toolCalls) {
            yield {
              event: 'tool_call.started',
              data: { tool: call.name, arguments: call.arguments },
            };
            const output = await this.executeOneToolCall(
              thread.id,
              run.id,
              agent,
              call,
              llmMessages,
            );
            yield { event: 'tool_call.completed', data: { tool: call.name, output } };
          }
          continue;
        }

        finished = true;
        yield {
          event: 'message.completed',
          data: { message_id: assistantMsg.id, content: done.message.content },
        };
        break;
      }

      const updated = await this.prisma.run.update({
        where: { id: run.id },
        data: {
          status: cancelled ? 'CANCELLED' : finished ? 'COMPLETED' : 'TIMEOUT',
          completedAt: finished ? new Date() : null,
          failedAt: finished ? null : new Date(),
          stepCount,
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          totalTokens: totals.totalTokens,
          errorMessage: cancelled
            ? 'Run cancelled by request'
            : finished
              ? null
              : `Reached maxSteps (${agent.maxSteps}) without a final answer`,
        },
      });

      yield {
        event: 'run.completed',
        data: {
          run_id: updated.id,
          status: updated.status,
          usage: {
            input_tokens: totals.inputTokens,
            output_tokens: totals.outputTokens,
            total_tokens: totals.totalTokens,
          },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Streaming run ${run?.id ?? '(unstarted)'} failed: ${message}`);
      if (run) {
        await this.prisma.run
          .update({
            where: { id: run.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: message.slice(0, 500),
            },
          })
          .catch(() => undefined);
      }
      yield { event: 'error', data: { run_id: run?.id ?? null, message } };
    }
  }

  // ----------------------------------------------
  // Internal helpers
  // ----------------------------------------------

  /**
   * Shared setup for both the sync and streaming run paths: loads the
   * agent with its relations, resolves (or creates) the thread, and
   * opens a Run row in IN_PROGRESS. Throws 404 for an unknown agent,
   * disabled agent, or a thread that belongs to a different agent.
   */
  private async prepareRun(
    workspaceId: string,
    agentId: string,
    threadId: string | undefined,
    userInput: string,
  ): Promise<{ agent: AgentWithRelations; thread: Thread; run: Run }> {
    const agent = (await this.prisma.agent.findFirst({
      where: { id: agentId, workspaceId, deletedAt: null },
      include: {
        tools: { include: { tool: true } },
        knowledgeBases: true,
      },
    })) as AgentWithRelations | null;
    if (!agent) throw new NotFoundException('Agent not found');
    if (!agent.isActive) throw new NotFoundException('Agent is disabled');

    let thread = threadId
      ? await this.prisma.thread.findFirst({ where: { id: threadId, workspaceId } })
      : null;
    if (threadId && !thread) throw new NotFoundException('Thread not found');
    if (!thread) {
      thread = await this.prisma.thread.create({
        data: { workspaceId, agentId, title: userInput.slice(0, 80) },
      });
    } else if (thread.agentId !== agent.id) {
      throw new NotFoundException('Thread does not belong to this agent');
    }

    const run = await this.prisma.run.create({
      data: {
        workspaceId,
        agentId: agent.id,
        threadId: thread.id,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        model: agent.model,
        provider: agent.provider,
      },
    });

    return { agent, thread, run };
  }

  private buildToolDefinitions(agent: AgentWithRelations): LlmToolDefinition[] {
    return agent.tools.map((at) => ({
      name: at.tool.name,
      description: at.tool.description,
      parameters: (at.tool.parameters as Record<string, unknown>) ?? {
        type: 'object',
        properties: {},
      },
    }));
  }

  private async buildRagContext(agent: AgentWithRelations, query: string): Promise<string> {
    if (agent.knowledgeBases.length === 0) return '';
    const allHits: string[] = [];
    for (const attachment of agent.knowledgeBases) {
      try {
        const hits = await this.search.searchSimilar(
          agent.workspaceId,
          attachment.knowledgeBaseId,
          query,
          attachment.topK,
          attachment.minSimilarity,
        );
        for (const h of hits) {
          allHits.push(`[${h.documentName} #${h.chunkIndex}] ${h.content}`);
        }
      } catch (err) {
        this.logger.warn(
          `RAG search failed for KB ${attachment.knowledgeBaseId}: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }
    if (allHits.length === 0) return '';
    return `\n\nRelevant knowledge base context:\n${allHits.join('\n\n')}`;
  }

  private composeSystemPrompt(base: string, rag: string): string {
    return rag.length > 0 ? `${base}${rag}` : base;
  }

  private toLlmMessage(m: Message): LlmMessage {
    const role = m.role.toLowerCase() as LlmMessage['role'];
    const result: LlmMessage = { role, content: m.content };
    if (role === 'assistant' && m.toolCalls) {
      result.toolCalls = m.toolCalls as unknown as LlmToolCall[];
    }
    if (role === 'tool') {
      if (m.toolCallId) result.toolCallId = m.toolCallId;
      if (m.name) result.name = m.name;
    }
    return result;
  }

  private async runToolCalls(
    threadId: string,
    runId: string,
    agent: AgentWithRelations,
    toolCalls: LlmToolCall[],
    llmMessages: LlmMessage[],
  ): Promise<void> {
    for (const call of toolCalls) {
      await this.executeOneToolCall(threadId, runId, agent, call, llmMessages);
    }
  }

  /**
   * Executes a single tool call: runs it (or synthesises an error when
   * the tool is not attached to the agent), persists the TOOL message,
   * pushes it onto the running llmMessages, and returns the result
   * content — so a streaming caller can emit it as an event.
   */
  private async executeOneToolCall(
    threadId: string,
    runId: string,
    agent: AgentWithRelations,
    call: LlmToolCall,
    llmMessages: LlmMessage[],
  ): Promise<string> {
    const attachment = agent.tools.find((at) => at.tool.name === call.name);
    let resultContent: string;

    if (!attachment) {
      resultContent = `Error: tool '${call.name}' is not registered for this agent`;
      this.logger.warn(resultContent);
    } else {
      const result = await this.toolExecutor.execute(attachment.tool as never, call.arguments);
      resultContent = result.content;
    }

    await this.prisma.message.create({
      data: {
        threadId,
        runId,
        role: 'TOOL',
        content: resultContent,
        toolCallId: call.id,
        name: call.name,
      },
    });
    llmMessages.push({
      role: 'tool',
      content: resultContent,
      toolCallId: call.id,
      name: call.name,
    });
    return resultContent;
  }
}
