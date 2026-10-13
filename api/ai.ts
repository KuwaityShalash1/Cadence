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

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const webReq = new Request(fullUrl, init);
    const webRes = await handleAiRequest(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((val: string, key: string) => {
      res.setHeader(key, val);
    });

    const text = await webRes.text();
    return res.send(text);
  } catch (error) {
    console.error("Vercel AI Serverless Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
