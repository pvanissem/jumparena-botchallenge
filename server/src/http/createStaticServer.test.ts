import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStaticServer } from "./createStaticServer";

function get200(url: string): Promise<{ body: string; contentType: string | undefined }> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          body: Buffer.concat(chunks).toString("utf-8"),
          contentType: res.headers["content-type"],
        })
      );
      res.on("error", reject);
    }).on("error", reject);
  });
}

describe("createStaticServer", () => {
  let staticDir: string;
  let server: ReturnType<typeof createStaticServer>;
  let baseUrl: string;

  beforeEach(async () => {
    staticDir = mkdtempSync(join(tmpdir(), "static-server-test-"));
    writeFileSync(join(staticDir, "index.html"), "<html>fallback</html>");
    // Dateiname mit Leerzeichen UND Klammern, wie z.B. "Terrain (16x16).png".
    writeFileSync(join(staticDir, "Terrain (16x16).png"), "not-really-a-png-but-thats-fine");

    server = createStaticServer(staticDir);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected server to listen on a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(staticDir, { recursive: true, force: true });
  });

  it("serves a file whose URL-encoded path contains spaces and parentheses", async () => {
    const response = await get200(`${baseUrl}/Terrain%20(16x16).png`);
    expect(response.body).toBe("not-really-a-png-but-thats-fine");
    expect(response.contentType).toBe("image/png");
  });

  it("still falls back to index.html for an unknown path (SPA fallback)", async () => {
    const response = await get200(`${baseUrl}/dev`);
    expect(response.body).toBe("<html>fallback</html>");
  });

  it("falls back to index.html for the /code station route", async () => {
    const response = await get200(`${baseUrl}/code`);
    expect(response.body).toBe("<html>fallback</html>");
  });

  it("falls back to index.html instead of crashing on a malformed percent-encoding", async () => {
    const response = await get200(`${baseUrl}/%E0%A4%A`);
    expect(response.body).toBe("<html>fallback</html>");
  });
});
