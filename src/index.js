
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer(env) {
  const server = new McpServer({
    name: "anivora-mcp",
    version: "1.0.0"
  });

  server.registerTool(
    "anivora_health",
    {
      description: "Check the health of the AniVora task relay."
    },
    async () => {
      const response = await fetch(
        `${env.RELAY_URL.replace(/\/+$/, "")}/v1/health`,
        {
          headers: {
            Authorization: `Bearer ${env.RELAY_TOKEN}`
          }
        }
      );

      if (!response.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: `Relay returned HTTP ${response.status}.` }]
        };
      }

      return {
        content: [{ type: "text", text: await response.text() }]
      };
    }
  );

  server.registerTool(
    "anivora_project_status",
    {
      description: "Request the approved AniVora project-status task.",
      inputSchema: {
        project: z.enum([
          "AniVora",
          "AniVora-Builder",
          "CareerCraft"
        ])
      }
    },
    async ({ project }) => {
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
          text: await response.text()
        }]
      };
    }
  );

  return server;
}

const mcpHandler = createMcpHandler(createServer);

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== "/mcp") {
      return new Response("AniVora MCP endpoint. Use /mcp.", {
        status: 404
      });
    }

    const token = env.MCP_TOKEN;
    const supplied = request.headers.get("Authorization") || "";

    if (!token || supplied !== `Bearer ${token}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    return mcpHandler(request, env, ctx);
  }
};
