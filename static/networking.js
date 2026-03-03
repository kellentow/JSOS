const protocolHandlers = /* @__PURE__ */ new Map();
const old_fetch = globalThis.fetch;
function registerProtocol(scheme, handler) {
  protocolHandlers.set(scheme, handler);
}
let patchfetch = (input, init) => {
  setTimeout(() => console.log(input.toString(), window.origin), 1);
  if (input.toString().startsWith(window.origin + "/backend/") || input.toString().startsWith("/backend/")) {
    let asset_url = "asset://" + input.toString().replace(window.origin, "").replace("/backend/", "");
    return globalThis.fetch(asset_url, init);
  }
  return old_fetch(input, init);
};
registerProtocol("http", patchfetch);
registerProtocol("https", patchfetch);
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
    console.log("Requesting asset:", assetKey);
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
