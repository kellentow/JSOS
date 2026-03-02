type ProtocolHandler = (url: string, init?: RequestInit) => Promise<Response>;

const protocolHandlers = new Map<string, ProtocolHandler>();

const old_fetch = globalThis.fetch

export function registerProtocol(scheme: string, handler: ProtocolHandler) {
    protocolHandlers.set(scheme, handler);
}

let patchfetch = (input: RequestInfo | URL, init?: RequestInit) => {
    setTimeout(()=>console.log(input.toString(),window.origin),1)
    if (input.toString().startsWith(window.origin + "/backend/") || input.toString().startsWith("/backend/")) {
        // rewrite to asset protocol to bypass CORS and allow access to the virtual fs
        let asset_url = "asset://" + input.toString().replace(window.origin, "").replace("/backend/", "")
        return globalThis.fetch(asset_url, init);
    } 
    return old_fetch(input, init);
}

registerProtocol("http", patchfetch)
registerProtocol("https",patchfetch)

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!input) input = ""
    const url = typeof input === 'string' ? input : input.toString();
    const match = url.match(/^([a-zA-Z0-9+.-]+):\/\//);
    let scheme = match?.[1].toLowerCase();

    if (!scheme) { scheme = "http" }

    if (scheme && protocolHandlers.has(scheme)) {
        const handler = protocolHandlers.get(scheme)!;
        return handler(url, init);
    } else {
        return new Response("Protocol not found", { status: 404 })
    }
};

class FixedMap<K, V> {
    private map = new Map<K, V>();
    private capacity: number;

    constructor(capacity: number) {
        this.capacity = capacity;
    }

    set(key: K, value: V) {
        if (this.map.has(key)) {
            this.map.delete(key); // remove old to update order
        } else if (this.map.size >= this.capacity) {
            // remove oldest entry
            const oldestKey = this.map.keys().next().value as K;
            this.map.delete(oldestKey);
        }
        this.map.set(key, value);
    }

    get(key: K): V | undefined {
        return this.map.get(key);
    }

    touch(key: K) {
        const value = this.map.get(key);
        if (value !== undefined) {
            this.map.delete(key);
            this.map.set(key, value);
        }
    }

    has(key: K): boolean {
        return this.map.has(key);
    }

    delete(key: K) {
        this.map.delete(key);
    }

    values(): V[] {
        return Array.from(this.map.values());
    }
}

import * as lz4js from 'lz4js';
import * as untyped_assets from './assets.json' // {string: [base64:string, length:number, mime:string]}

(() => { // asset protocol
    const assets: Record<string, [string, number, string]> = untyped_assets as any;
    const decoded: FixedMap<string, [Uint8Array, string]> = new FixedMap(2000)

    function base64ToUint8Array(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    registerProtocol("asset", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        let url = typeof input === 'string' ? input : input.toString();
        const assetKey = url.substring(8); // remove "asset://"
        console.log("Requesting asset:", assetKey)
        if (decoded.has(assetKey)) {
            decoded.touch(assetKey);
            let [data, mime] = decoded.get(assetKey) as any // @ts-ignore
            return new Response(data as Uint8Array, {
                status: 200,
                headers: { 'Content-Type': mime, 'X-Cache': "HIT" },
            });
        }
        const [b64, length, mime] = assets[assetKey];
        if (!b64) {
            return new Response("Asset not found", { status: 404 });
        }
        
        const compressed = base64ToUint8Array(b64);
        const decompressed: Uint8Array = lz4js.decompress(compressed);

        // add to cache
        decoded.set(assetKey, [decompressed, mime])

        // Wrap in a Response (ts ignore bc Uint8Array !== Uint8Array???????)
        // @ts-ignore
        return new Response(decompressed as Uint8Array, {
            status: 200,
            headers: { 'Content-Type': mime },
        });
    });
    protocolHandlers.set("assets", protocolHandlers.get("asset") as any) // alias
})()