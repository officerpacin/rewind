import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { config as loadEnv } from "dotenv";
import handler from "./handler.ts";

loadEnv({ path: ".env.local" });

const MAX_BODY_BYTES = 1_000_000;

async function toWebRequest(incoming: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      headers.set(name, value.join(", "));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of incoming) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new RequestSizeError();
    }
    chunks.push(bytes);
  }

  const host = incoming.headers.host ?? "localhost";
  const forwardedProto = incoming.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string" &&
    forwardedProto.split(",")[0] === "https"
      ? "https"
      : "http";
  const method = incoming.method ?? "GET";
  const body = Buffer.concat(chunks);
  return new Request(`${protocol}://${host}${incoming.url ?? "/"}`, {
    method,
    headers,
    ...(method === "GET" || method === "HEAD" || body.byteLength === 0
      ? {}
      : { body }),
  });
}

class RequestSizeError extends Error {}

function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, string>,
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

const port = Number(process.env.PORT ?? 1337);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const request = await toWebRequest(incoming);
    const result = await handler(request);
    outgoing.writeHead(
      result.status,
      Object.fromEntries(result.headers.entries()),
    );
    if (result.body) {
      outgoing.end(Buffer.from(await result.arrayBuffer()));
    } else {
      outgoing.end();
    }
  } catch (error) {
    if (error instanceof RequestSizeError) {
      sendJson(outgoing, 413, {
        message: "Request body is too large.",
        code: "BODY_TOO_LARGE",
      });
      return;
    }
    console.error("[API] Failed to process HTTP request:", error);
    sendJson(outgoing, 500, {
      message: "The service could not complete the request.",
      code: "INTERNAL_ERROR",
    });
  }
});

server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.listen(port, "0.0.0.0", () => {
  console.log(`API listening on port ${port}`);
});

server.on("error", (error) => {
  console.error("[API] HTTP server failed:", error);
  process.exitCode = 1;
});
