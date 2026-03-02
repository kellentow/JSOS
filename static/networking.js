if (typeof window.send !== "function") {
  let queueSend = function(a, b, c, d) {
    queue.push([a, b, c, d]);
  }, setupWebSocket = function() {
    if (ws.readyState === WebSocket.OPEN) {
      return;
    } else if (ws.readyState === WebSocket.CONNECTING) {
      setTimeout(setupWebSocket, 100);
    } else {
      ws = new WebSocket("wss://ws.sleepyis.dev");
      ws.onopen = () => {
        window.send = function(a, b, c, d) {
          let msg = JSON.stringify([a, b, c, d]);
          ws.send(msg);
        };
        while (queue.length > 0) {
          let [a, b, c, d] = queue.shift();
          window.send(a, b, c, d);
        }
      };
      ws.onmessage = (event) => {
        let data = event.data;
        let [a, b, c, d] = JSON.parse(data);
        window.get(a, b, c, d);
      };
      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        ws.close();
      };
      ws.onclose = (event) => {
        if (!event.wasClean) {
          console.error("WebSocket closed unexpectedly:", event);
          setTimeout(setupWebSocket, 1e3);
        }
        window.send = queueSend;
      };
    }
  };
  var queueSend2 = queueSend, setupWebSocket2 = setupWebSocket;
  let ws = new WebSocket("wss://ws.sleepyis.dev");
  let queue = [];
  window.send = queueSend;
  setupWebSocket();
  console.warn("Environment did not supply window.send, using default websocket to ws.sleepyis.dev");
  console.warn("This may not be wanted, if not please supply own window.send and window.get caller");
}
const protocolHandlers = /* @__PURE__ */ new Map();
const old_fetch = globalThis.fetch;
function registerProtocol(scheme, handler) {
  protocolHandlers.set(scheme, handler);
}
registerProtocol("http", old_fetch);
registerProtocol("https", old_fetch);
globalThis.fetch = async (input, init) => {
  if (!input)
    input = "";
  const url = typeof input === "string" ? input : input.toString();
  const match = url.match(/^([a-zA-Z0-9+.-]+):\/\//);
  let scheme = match?.[1].toLowerCase();
  if (!scheme) {
    scheme = "http";
  }
  if (scheme && protocolHandlers.has(scheme)) {
    const handler = protocolHandlers.get(scheme);
    return handler(url, init);
  } else {
    return new Response("Protocol not found", { status: 404 });
  }
};
class FixedMap {
  constructor(capacity) {
    this.map = /* @__PURE__ */ new Map();
    this.capacity = capacity;
  }
  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }
  get(key) {
    return this.map.get(key);
  }
  touch(key) {
    const value = this.map.get(key);
    if (value !== void 0) {
      this.map.delete(key);
      this.map.set(key, value);
    }
  }
  has(key) {
    return this.map.has(key);
  }
  delete(key) {
    this.map.delete(key);
  }
  values() {
    return Array.from(this.map.values());
  }
}
import * as lz4js from "lz4js";
import * as untyped_assets from "./assets.json";
(() => {
  const assets = untyped_assets;
  const decoded = new FixedMap(2e3);
  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  registerProtocol("asset", async (input, init) => {
    let url = typeof input === "string" ? input : input.toString();
    const assetKey = url.substring(8);
    if (decoded.has(assetKey)) {
      decoded.touch(assetKey);
      let [data, mime2] = decoded.get(assetKey);
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": mime2, "X-Cache": "HIT" }
      });
    }
    const [b64, length, mime] = assets[assetKey];
    if (!b64) {
      return new Response("Asset not found", { status: 404 });
    }
    const compressed = base64ToUint8Array(b64);
    const decompressed = lz4js.decompress(compressed);
    decoded.set(assetKey, [decompressed, mime]);
    return new Response(decompressed, {
      status: 200,
      headers: { "Content-Type": mime }
    });
  });
  protocolHandlers.set("assets", protocolHandlers.get("asset"));
})();
export {
  registerProtocol
};
//# sourceMappingURL=networking.js.map
