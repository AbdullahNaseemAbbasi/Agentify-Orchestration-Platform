import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Message, Prisma, Run } from '@prisma/client';
import { PrismaService } from '@agentify/database';
import {
  LlmCompletionRequest,
  LlmMessage,
  LlmService,
  LlmToolCall,
  LlmToolDefinition,
} from '@agentify/llm';
import { SearchService } from '../knowledge-bases/search.service';
import { HttpToolExecutor } from '../tools/http-tool.executor';

export interface ExecuteRunResult {
  run: Run;
  /** Final assistant message content. Empty string when the loop hit maxSteps. */
  message: string;
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
  tools: Array<{ tool: { id: string; name: string; description: string; parameters: Prisma.JsonValue } }>;
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
  ) {}

  async findById(workspaceId: string, id: string): Promise<Run> {
    const run = await this.prisma.run.findFirst({ where: { id, workspaceId } });
    if (!run) throw new NotFoundException('Run not found');
    return run;
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
    const agent = (await this.prisma.agent.findFirst({
      where: { id: agentId, workspaceId, deletedAt: null },
      include: {
        tools: { include: { tool: true } },
        knowledgeBases: true,
      },
    })) as AgentWithRelations | null;
    if (!agent) throw new NotFoundException('Agent not found');
    if (!agent.isActive) throw new NotFoundException('Agent is disabled');

    // Resolve or create the thread.
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

      for (let step = 0; step < agent.maxSteps; step++) {
        stepCount = step + 1;

        const req: LlmCompletionRequest = {
          model: agent.model,
          messages: llmMessages,
          tools: tools.length > 0 ? tools : undefined,
          toolChoice: tools.length > 0 ? agent.toolChoice : undefined,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          topP: agent.topP ?? undefined,
          responseFormat:
            (agent.responseFormat as Record<string, unknown> | null) ?? undefined,
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
          await this.runToolCalls(thread.id, run.id, agent, response.message.toolCalls, llmMessages);
          continue;
        }

        finalContent = response.message.content;
        finished = true;
        break;
      }

      const finalStatus = finished ? 'COMPLETED' : 'TIMEOUT';
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
          errorMessage: finished
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

  // ----------------------------------------------
  // Internal helpers
  // ----------------------------------------------

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
    }
  }
}
