/**
 * Maximum accepted JSON body size for write endpoints. A donation serializes
 * to a few hundred bytes; 16 KiB is generous for a legitimate client and
 * small enough to bound adversarial memory use.
 */
export const MAX_BODY_BYTES = 16 * 1024;

export type ReadBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" };

/**
 * Read and JSON-parse a request body with a byte cap. The cap is enforced
 * twice: once against a declared Content-Length (cheap reject) and again
 * while streaming (so a chunked sender cannot lie about the length).
 */
export async function readJsonBody(request: Request): Promise<ReadBodyResult> {
  const declared = request.headers.get("content-length");
  if (declared) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return { ok: false, reason: "too_large" };
    }
  }

  const body = request.body;
  if (!body) {
    return { ok: false, reason: "invalid_json" };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large" };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  if (text.length === 0) {
    return { ok: false, reason: "invalid_json" };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
