import { OS, OS_Process, IPCWrapper } from "./../../../../../src/os-classes"
import { waitForDefined } from "../../../../../src/helpers"

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
    tracking: number | undefined;
}

let windows: Record<string, GlassWindow> = {};
let pdoc: Document | undefined = undefined;

// process up to N messages from one IPC per frame to avoid starvation
const MAX_MSGS_PER_IPC = 100;
let z = 0

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
                let win: GlassWindow = windows[msg.target] as GlassWindow
                if (!win) continue
                if (typeof msg.x === "number") win.x = msg.x;
                if (typeof msg.y === "number") win.y = msg.y;
                //if (msg.z && typeof msg.z === "number") win.z = msg.z
            } else if (msg.type === "size") {
                let win: GlassWindow = windows[msg.target] as GlassWindow
                if (!win) continue
                if (typeof msg.width === "number") win.width = msg.width;
                if (typeof msg.height === "number") win.height = msg.height;
            } else if (msg.type === "new") {
                let window_frame = pdoc.createElement("div")
                window_frame.style.left = "-100%"
                window_frame.style.paddingTop =    "10px"
                window_frame.style.paddingRight =  "5px"
                window_frame.style.paddingBottom = "5px"
                window_frame.style.paddingLeft =   "5px"
                window_frame.style.border = "#111 solid 1px"
                window_frame.style.borderRadius = "5px"
                window_frame.style.backgroundColor = "#444"
                window_frame.style.display = "none"
                let window_iframe = pdoc.createElement("iframe")
                let id = crypto.randomUUID()

                let last_pos: [number, number] | undefined = undefined
                function mousedown(e: MouseEvent) {
                    e.preventDefault()
                    let win = windows[id]
                    last_pos = [e.clientX - win.x, e.clientY - win.y];
                    win.z = z++
                    if (pdoc) {
                        pdoc.addEventListener("mousemove", mousemove)
                        pdoc.addEventListener("mouseup", mouseup)
                        //iframes are mouse stealers so turn them off for a sec
                        Object.values(windows).forEach(w => {
                            (w.element.children[0] as HTMLIFrameElement).style.pointerEvents = "none"
                        })
                    }
                }
                function mousemove(e: MouseEvent) {
                    if (last_pos !== undefined) {
                        let win = windows[id]
                        let dx = last_pos[0] - (e.clientX - win.x)
                        let dy = last_pos[1] - (e.clientY - win.y)
                        win.x -= dx
                        win.y -= dy
                    }
                }
                function mouseup(e: MouseEvent) {
                    last_pos = undefined;
                    if (pdoc) {
                        Object.values(windows).forEach(w => {
                            (w.element.children[0] as HTMLIFrameElement).style.pointerEvents = "auto"
                        })
                        pdoc.removeEventListener("mousemove", mousemove)
                        pdoc.removeEventListener("mouseup", mouseup)
                    }
                }
                window_frame.addEventListener("mousedown", mousedown)


                window_iframe.style.borderWidth = "0px"
                window_iframe.setAttribute("Glass-id", id)
                window_iframe.srcdoc = ""
                window_iframe.sandbox = "allow-same-origin"
                window_iframe.addEventListener("load", () => {
                    console.log("New window made", window_iframe)
                    console.log("Sending IPC message to window", { type: "new", document: window_iframe.contentDocument, id })
                    ipc.send({ type: "new", document: window_iframe.contentDocument, id })
                    window_frame.style.display = "inline-block"
                })
                windows[id] = {
                    x: 0,
                    y: 0,
                    z: z++,
                    width: 0,
                    height: 0,
                    element: window_frame,
                    id,
                    tracking: undefined
                }
                window_frame.appendChild(window_iframe)

                pdoc.body.appendChild(window_frame)

            } else if (msg.type == "info") {
                let windows_safe: { x: number, y: number, z: number, width: number, height: number, id: string }[] = []
                Object.values(windows).forEach((window: GlassWindow) => {
                    windows_safe.push({
                        x: window.x,
                        y: window.y,
                        z: window.z,
                        width: window.width,
                        height: window.height,
                        id: window.id
                    })
                })
                ipc.send({
                    type: "info",
                    sc: {
                        x: 0,
                        y: 0,
                        width: pdoc.documentElement.clientWidth,
                        height: pdoc.documentElement.clientHeight
                    },
                    windows: windows_safe
                })
            } else if (msg.type == "track") {
                let win: GlassWindow = windows[msg.target] as GlassWindow
                if (!win) continue
                if (typeof msg.pid === "number") win.tracking = msg.pid;
            } else if (msg.type == "destroy") {
                let win: GlassWindow = windows[msg.target] as GlassWindow
                if (!win) continue
                win.element.remove()
                delete windows[win.id]
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

    Object.values(windows).forEach((win, i) => {
        if (win.tracking !== undefined && window.os.getProcess(win.tracking) === undefined) {
            // the proc that claimed this window died so destroy the window
            win.element.remove()
            delete windows[win.id]
        }
        const el = win.element as HTMLDivElement;
        const iframe = win.element.children[0] as HTMLIFrameElement
        el.style.position = "absolute";

        // the - is pos-(padding_size+border_size)
        el.style.left = `${win.x - 6}px`;
        el.style.top = `${win.y - 11}px`;
        iframe.style.width = `${win.width}px`;
        iframe.style.height = `${win.height}px`;

        el.style.overflow = "clip"
        el.style.zIndex = String(win.z);
    });

    requestAnimationFrame(updateLoop);
}