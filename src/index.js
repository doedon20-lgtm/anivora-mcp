
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
      try {
        const response = await fetch(
          `${env.RELAY_URL.replace(/\/+$/, "")}/v1/health`,
          {
            headers: {
              Authorization: `Bearer ${env.RELAY_TOKEN}`
            }
          }
        );

        const body = await response.text();

        return {
          isError: !response.ok,
          content: [{
            type: "text",
            text: `Relay HTTP ${response.status}: ${body}`
          }]
        };
      } catch {
        return {
          isError: true,
          content: [{
            type: "text",
            text: "Could not reach the AniVora task relay. Check its URL and availability."
          }]
        };
      }
    }
  );

  server.registerTool(
    "anivora_project_status",
    {
      description:
        "Request an approved project-status task from the AniVora task relay.",
      inputSchema: {
        project: z.enum([
          "AniVora",
          "AniVora-Builder",
          "CareerCraft"
        ])
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
            text: "Could not submit the project-status task to the relay."
          }]
        };
      }
    }
  );

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== "/mcp") {
      return new Response("AniVora MCP endpoint. Use /mcp.", {
        status: 404
      });
    }

    if (
      !env.MCP_TOKEN ||
      !env.RELAY_TOKEN ||
      !env.RELAY_URL
    ) {
      return new Response("Server configuration is incomplete.", {
        status: 500
      });
    }

    const authorization = request.headers.get("Authorization") || "";

    if (authorization !== `Bearer ${env.MCP_TOKEN}`) {
      return new Response("Unauthorized", {
        status: 401
      });
    }

    const handler = createMcpHandler(() => createServer(env));
    return handler(request, env, ctx);
  }
};
