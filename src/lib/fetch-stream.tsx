
export async function *fetchStream(input: string | URL | globalThis.Request, init?: RequestInit) {
  const res = await fetch( input, init);

  if (!res.ok) throw new Error(`analyze ${res.status}`);

  // ストリームがない（古い環境）場合のフォールバック
  if (!res.body) {
    const text = await res.text();
    console.warn("No streaming body; full text:", text);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // 行区切りでパース
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const evt = JSON.parse(line);
        if (evt.delta) {
          yield evt.delta;
        } else if (evt.event === "start") {
        } else if (evt.event === "end") {
        }
      } catch (e) {
        console.error("bad line", line, e);
      }
    }
  }
}
