import { Injectable, Logger } from '@nestjs/common';
import { Tool } from '@prisma/client';

export interface ToolExecutionResult {
  /** Stringified body to send back to the LLM as the tool message content. */
  content: string;
  /** True when the call returned 2xx and the executor reached the wire. */
  ok: boolean;
  /** Diagnostics for traces — never sent back to the LLM directly. */
  metadata: {
    statusCode?: number;
    durationMs: number;
    error?: string;
  };
}

/**
 * Executes a registered Tool given the JSON arguments produced by an LLM
 * tool call. HTTP tools support `{{var}}` substitution in URL and body
 * templates, configurable auth, and a per-tool timeout enforced via
 * AbortController.
 *
 * Future tool types (BUILT_IN, MCP) will plug in here as additional
 * branches alongside the HTTP executor.
 */
@Injectable()
export class HttpToolExecutor {
  private readonly logger = new Logger(HttpToolExecutor.name);

  async execute(tool: Tool, argumentsJson: string): Promise<ToolExecutionResult> {
    const start = Date.now();

    let args: Record<string, unknown> = {};
    if (argumentsJson && argumentsJson.length > 0) {
      try {
        args = JSON.parse(argumentsJson);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'invalid JSON';
        return this.error(start, `Tool '${tool.name}': could not parse arguments — ${message}`);
      }
    }

    if (tool.type !== 'HTTP') {
      return this.error(start, `Tool type ${tool.type} is not supported yet`);
    }

    if (!tool.httpMethod || !tool.httpUrl) {
      return this.error(start, `Tool '${tool.name}' is missing httpMethod or httpUrl`);
    }

    const url = this.interpolate(tool.httpUrl, args);
    const headers = this.buildHeaders(tool, args);
    const body = this.buildBody(tool, args);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), tool.timeoutMs);

    try {
      const res = await fetch(url, {
        method: tool.httpMethod.toUpperCase(),
        headers,
        body,
        signal: controller.signal,
      });
      const text = await res.text();
      const trimmed = text.length > 8_000 ? `${text.slice(0, 8_000)}…[truncated]` : text;

      this.logger.log(`Tool '${tool.name}' -> ${res.status} (${Date.now() - start}ms)`);
      return {
        content: trimmed,
        ok: res.ok,
        metadata: { statusCode: res.status, durationMs: Date.now() - start },
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      const message = aborted
        ? `Tool '${tool.name}' timed out after ${tool.timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : 'unknown error';
      return this.error(start, message);
    } finally {
      clearTimeout(timer);
    }
  }

  // ----------------------------------------------
  // Template + auth + body helpers
  // ----------------------------------------------

  private interpolate(template: string, args: Record<string, unknown>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match: string, key: string) => {
      const parts: string[] = key.split('.');
      let value: unknown = args;
      for (const k of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[k];
        } else {
          value = undefined;
          break;
        }
      }
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private buildHeaders(tool: Tool, args: Record<string, unknown>): Record<string, string> {
    const headers: Record<string, string> = {};
    if (tool.httpHeaders && typeof tool.httpHeaders === 'object') {
      for (const [k, v] of Object.entries(tool.httpHeaders as Record<string, unknown>)) {
        headers[k] = this.interpolate(String(v), args);
      }
    }

    // Body is JSON unless the user already specified a content type.
    if (tool.httpBody && !this.hasHeader(headers, 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }

    // Auth injection. httpAuthValue is currently stored in plaintext for
    // the dev DB; production must encrypt at rest (spec §19.2).
    if (tool.httpAuthType && tool.httpAuthValue) {
      switch (tool.httpAuthType.toLowerCase()) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${tool.httpAuthValue}`;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${tool.httpAuthValue}`;
          break;
        case 'api_key': {
          // httpAuthValue format: "header_name:value"
          const [name, value] = tool.httpAuthValue.split(':');
          if (name && value) headers[name] = value;
          break;
        }
      }
    }

    return headers;
  }

  private buildBody(tool: Tool, args: Record<string, unknown>): string | undefined {
    if (!tool.httpBody || typeof tool.httpBody !== 'object') return undefined;
    const interpolated = this.interpolateValue(tool.httpBody, args);
    return JSON.stringify(interpolated);
  }

  private interpolateValue(value: unknown, args: Record<string, unknown>): unknown {
    if (typeof value === 'string') return this.interpolate(value, args);
    if (Array.isArray(value)) return value.map((v) => this.interpolateValue(v, args));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.interpolateValue(v, args);
      }
      return out;
    }
    return value;
  }

  private hasHeader(headers: Record<string, string>, name: string): boolean {
    const target = name.toLowerCase();
    return Object.keys(headers).some((k) => k.toLowerCase() === target);
  }

  private error(start: number, message: string): ToolExecutionResult {
    this.logger.warn(message);
    return {
      content: `Tool execution failed: ${message}`,
      ok: false,
      metadata: { durationMs: Date.now() - start, error: message },
    };
  }
}
