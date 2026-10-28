
import { env } from "cloudflare:workers";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "anivora-mcp",
    version: "1.0.0"
  });

  server.registerTool(
    "anivora_health",
    { description: "Check the health of the AniVora task relay." },
    async () => {
      try {
        const response = await fetch(
          `${env.RELAY_URL.replace(/\/+$/, "")}/v1/health`,
          { headers: { Authorization: `Bearer ${env.RELAY_TOKEN}` } }
        );

        return {
          isError: !response.ok,
          content: [{
            type: "text",
            text: `Relay HTTP ${response.status}: ${await response.text()}`
          }]
        };
      } catch {
        return {
          isError: true,
          content: [{ type: "text", text: "Could not reach the AniVora relay." }]
        };
      }
    }
  );

  server.registerTool(
    "anivora_project_status",
    {
      description: "Request an approved AniVora project-status task.",
      inputSchema: {
        project: z.enum(["AniVora", "AniVora-Builder", "CareerCraft"])
      }
    },
    async ({ project }) => {
      try {
        const response = await fetch(
          `${env.RELAY_URL.replace(/\/+$/, "")}/v1/tasks`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RELAY_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              type: "project_status",
              payload: { project }
            })
          }
        );

        return {
          isError: !response.ok,
          content: [{
            type: "text",
            text: `Relay HTTP ${response.status}: ${await response.text()}`
          }]
        };
      } catch {
        return {
          isError: true,
          content: [{
            type: "text",
            text: "Could not submit the project-status task."
          }]
        };
      }
    }
  );

  return server;
}

const mcpHandler = createMcpHandler(createServer);

export default {
  async fetch(request, workerEnv, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== "/mcp") {
      return new Response("AniVora MCP endpoint. Use /mcp.", {
        status: 404
      });
    }

    if (!workerEnv.MCP_TOKEN || !workerEnv.RELAY_TOKEN || !workerEnv.RELAY_URL) {
      return new Response("Server configuration is incomplete.", {
        status: 500
      });
    }

    if (request.headers.get("Authorization") !== `Bearer ${workerEnv.MCP_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    return mcpHandler(request, workerEnv, ctx);
  }
};
