import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAiRequest } from "../src/server/api/ai";

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  body?: unknown;
}

interface VercelResponse extends ServerResponse {
  status: (statusCode: number) => VercelResponse;
  json: (jsonBody: unknown) => void;
  send: (body: unknown) => void;
}

async function getRequestBody(req: VercelRequest): Promise<string | undefined> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString("utf-8");
    return JSON.stringify(req.body);
  }

  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk: Buffer | string) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw || undefined));
    req.on("error", () => resolve(undefined));
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host || "localhost";
    const fullUrl = `${protocol}://${host}${req.url || "/"}`;

    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === "string") headers.set(key, val);
      else if (Array.isArray(val)) headers.set(key, val.join(", "));
    }

    const init: RequestInit = {
      method: req.method || "GET",
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      const body = await getRequestBody(req);
      if (body) {
        init.body = body;
      }
    }

    const webReq = new Request(fullUrl, init);
    const webRes = await handleAiRequest(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((val: string, key: string) => {
      res.setHeader(key, val);
    });

    const text = await webRes.text();
    return res.send(text);
  } catch (error: unknown) {
    console.error("Vercel AI Serverless Error:", error);
    let errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof AggregateError) {
      errorMessage =
        "AggregateError: " +
        error.errors.map((e) => (e instanceof Error ? e.message : String(e))).join(" | ");
    }
    res.setHeader("Content-Type", "application/json");
    res.status(200);
    return res.send(
      JSON.stringify({
        text: `🚨 CRITICAL BACKEND ERROR 🚨\n\n${errorMessage}`,
        providerUsed: "error",
      }),
    );
  }
}
