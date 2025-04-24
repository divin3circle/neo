import express, { Request, Response } from "express";
import cors from "cors";
import { MCPClient } from "./client/index.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.MCP_PORT || 4000;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Log response when it's sent
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} ${
        res.statusCode
      } - ${duration}ms`
    );
  });

  next();
});

let mcpClient: MCPClient | null = null;

// Initialize MCP client
async function initializeMCPClient() {
  try {
    mcpClient = new MCPClient();
    await mcpClient.connectToServer("./build/index.js");
    console.log("MCP client connected successfully");
  } catch (error) {
    console.error("Failed to initialize MCP client:", error);
    process.exit(1);
  }
}

// API endpoints
app.post(
  "/api/mcp/query",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!mcpClient) {
        throw new Error("MCP client not initialized");
      }

      const { query, userId, accountId, privateKey, userEmail, password } =
        req.body;

      if (
        !query ||
        !userId ||
        !accountId ||
        !privateKey ||
        !userEmail ||
        !password
      ) {
        res.status(400).json({
          error: "Missing required parameters",
        });
        return;
      }

      const completeQuery = `${query} /n userId: ${userId} /n accountId: ${accountId} /n privateKey: ${privateKey} /n userEmail: ${userEmail} /n password: ${password}`;

      const response = await mcpClient.processQuery(completeQuery);
      res.json({ success: true, data: response });
    } catch (error) {
      console.error("Error processing query:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

app.get(
  "/api/mcp/tools",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      if (!mcpClient) {
        throw new Error("MCP client not initialized");
      }

      // Get tools that were fetched during initialization
      const tools = mcpClient.getTools();
      res.json({ success: true, data: tools });
    } catch (error) {
      console.error("Error fetching tools:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

async function startServer() {
  await initializeMCPClient();

  app.listen(port, () => {
    console.log(`MCP API server listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
