import {OS, OS_Process, IPCWrapper} from "./../../../../../src/os-classes"

declare global {
    interface Window {
        parent_doc: () => Document | undefined;
        IPCs: IPCWrapper[];
        os: OS;
        proc: OS_Process;
    }
}

interface GlassWindow {
    element: HTMLElement;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
    id: string;
}

function waitForDefined(getValue: () => any, interval = 50, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        let id: number | undefined;

        const check = () => {
            try {
                const value = getValue();
                if (value !== undefined) {
                    if (id !== undefined) clearInterval(id);
                    resolve(value);
                    return true;
                }
                if (timeout != null && Date.now() - start > timeout) {
                    if (id !== undefined) clearInterval(id);
                    reject(new Error("waitForDefined: timeout"));
                    return true;
                }
            } catch (err) {
                if (id !== undefined) clearInterval(id);
                reject(err);
                return true;
            }
            return false;
        };

        // immediate check
        if (check()) return;

        id = setInterval(() => {
            check();
        }, interval) as unknown as number;
    });
}

let windows: GlassWindow[] = [];
let ipcs: IPCWrapper[] = [];
let pdoc: Document | undefined = undefined;

// process up to N messages from one IPC per frame to avoid starvation
const MAX_MSGS_PER_IPC = 100;

function importOrParseElement(nodeLike: any): Node | null {
    if (!pdoc) return null;
    // If it's already a Node (from same origin parent doc), try importNode
    if (nodeLike?.nodeType != null) {
        try {
            return pdoc.importNode(nodeLike, true);
        } catch (e) {
            // fallback: clone by outerHTML
            const wrapper = pdoc.createElement("div");
            wrapper.appendChild(nodeLike.cloneNode(true));
            return wrapper.firstChild;
        }
    }
    // If it's a string of HTML, parse it
    if (typeof nodeLike === "string") {
        const frag = pdoc.createRange().createContextualFragment(nodeLike);
        // return a single element if possible, otherwise the fragment
        if (frag.childNodes.length === 1) return frag.firstChild;
        return frag;
    }
    return null;
}

function IPCHandler(ipc: IPCWrapper) {
    if (!pdoc) throw new Error("User refused DOM access");
    pdoc = pdoc as any as Document
    let processed = 0;
    while (processed < MAX_MSGS_PER_IPC) {
        let msg: any;
        try {
            msg = ipc.recv();
        } catch (err) {
            console.error("IPC.recv threw:", err);
            break;
        }
        if (msg === undefined) break;

        processed++;

        try {
            if (msg.type === "pos") {
                let win:GlassWindow = windows.find((v)=>{return v.id == msg.target}) as GlassWindow
                if (!win) continue
                if (typeof msg.x === "number") win.x = msg.x;
                if (typeof msg.y === "number") win.y = msg.y;
                if (msg.z && typeof msg.z === "number") win.z = msg.z
            } else if (msg.type === "size") {
                let win:GlassWindow = windows.find((v)=>{return v.id == msg.target}) as GlassWindow
                if (!win) continue
                if (typeof msg.width === "number") win.width = msg.width;
                if (typeof msg.height === "number") win.height = msg.height;
            } else if (msg.type === "new") {
                let win = pdoc.createElement("iframe")
                let id = crypto.randomUUID()
                win.style.borderWidth = "0px"
                win.srcdoc = ""
                win.sandbox = "allow-same-origin"
                windows.push({
                    x:0,
                    y:0,
                    z:0,
                    width:0,
                    height:0,
                    element:win,
                    id
                })

                pdoc.body.appendChild(win)
                win.addEventListener("load", () => {
                    console.log("New window made", win)
                    ipc.send({type:"new",document:win.contentDocument,id})
                })
            } else if (msg.type == "info") {
                let windows_safe:{x:number,y:number,z:number,width:number,height:number,id:string}[] = []
                windows.forEach((window:GlassWindow)=>{
                    windows_safe.push({
                        x:window.x,
                        y:window.y,
                        z:window.z,
                        width:window.width,
                        height:window.height,
                        id:window.id
                    })
                })
                ipc.send({
                    type:"info",
                    sc: {
                        x:0,
                        y:0,
                        width:pdoc.documentElement.clientWidth,
                        height:pdoc.documentElement.clientHeight
                    },
                    windows:windows_safe
                })
            } else {
                console.warn("Unknown IPC message type:", msg.type);
            }
        } catch (err) {
            console.error("Error handling IPC message:", err);
        }
    }

    if (processed >= MAX_MSGS_PER_IPC) {
        console.warn("Reached message cap for one IPC this frame; remaining messages will be processed next frame");
    }
}

document.addEventListener("os-load", async () => {
    try {
        await waitForDefined(() => (window as any).proc, 50, 1000);
        pdoc = (window as any).parent_doc();
        if (!pdoc) {
            // perm 16 == EditDom
            await (window as any).proc.askPermissions(16, "Permission to edit the DOM is required to show windows");
            pdoc = (window as any).parent_doc();
        }
        if (!pdoc) throw new Error("User refused DOM access");
        pdoc = pdoc as any as Document
        pdoc.body.style.overflow = "clip"
        pdoc.body.style.margin = "0px"
        pdoc.documentElement.style.overflow = "clip"
        requestAnimationFrame(updateLoop);
        console.log("Glass is (probably) up!");
    } catch (err) {
        console.error("Failed to initialize Glass:", err);
    }
});

function updateLoop() {
    const IPCs = window.IPCs ?? [];

    IPCs.forEach((ipc) => {
        IPCHandler(ipc);
    });

    windows.forEach((win, i) => {
        const el = win.element;
        el.style.position = "absolute";
        if (win.x+"px" != el.style.left)        el.style.left = `${win.x}px`;
        if (win.y+"px" != el.style.top)         el.style.top = `${win.y}px`;
        if (win.width+"px" != el.style.width)   el.style.width = `${win.width}px`;
        if (win.height+"px" != el.style.height) el.style.height = `${win.height}px`;
        el.style.overflow = "clip"
        el.style.zIndex = String(win.z);
    });

    requestAnimationFrame(updateLoop);
}