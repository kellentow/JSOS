function waitForDefined(getValue, interval = 50, timeout) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        let id;
        const check = () => {
            try {
                const value = getValue();
                if (value !== undefined) {
                    if (id !== undefined)
                        clearInterval(id);
                    resolve(value);
                    return true;
                }
                if (timeout != null && Date.now() - start > timeout) {
                    if (id !== undefined)
                        clearInterval(id);
                    reject(new Error("waitForDefined: timeout"));
                    return true;
                }
            }
            catch (err) {
                if (id !== undefined)
                    clearInterval(id);
                reject(err);
                return true;
            }
            return false;
        };
        // immediate check
        if (check())
            return;
        id = setInterval(() => {
            check();
        }, interval);
    });
}
let windows = [];
let windowsByIPC = new Map();
let pdoc = undefined;
// process up to N messages from one IPC per frame to avoid starvation
const MAX_MSGS_PER_IPC = 100;
function importOrParseElement(nodeLike) {
    if (!pdoc)
        return null;
    // If it's already a Node (from same origin parent doc), try importNode
    if (nodeLike?.nodeType != null) {
        try {
            return pdoc.importNode(nodeLike, true);
        }
        catch (e) {
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
        if (frag.childNodes.length === 1)
            return frag.firstChild;
        return frag;
    }
    return null;
}
function IPCHandler(ipc, win) {
    let processed = 0;
    while (processed < MAX_MSGS_PER_IPC) {
        let msg;
        try {
            msg = ipc.recv();
        }
        catch (err) {
            console.error("IPC.recv threw:", err);
            break;
        }
        if (msg === undefined)
            break;
        processed++;
        try {
            if (msg.type === "pos") {
                if (typeof msg.x === "number")
                    win.x = msg.x;
                if (typeof msg.y === "number")
                    win.y = msg.y;
            }
            else if (msg.type === "size") {
                if (typeof msg.width === "number")
                    win.width = msg.width;
                if (typeof msg.height === "number")
                    win.height = msg.height;
            }
            else if (msg.type === "element") {
                const node = importOrParseElement(msg.element);
                if (!node) {
                    console.warn("Failed to import/parse element message", msg.element);
                    continue;
                }
                if (win.element.parentNode) {
                    try {
                        win.element.replaceWith(node);
                    }
                    catch (e) {
                        win.element.parentNode.removeChild(win.element);
                        pdoc.body.appendChild(node);
                    }
                }
                else {
                    pdoc.body.appendChild(node);
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                    win.element = node;
                }
                else {
                    const wrapper = pdoc.createElement("div");
                    wrapper.appendChild(node);
                    win.element = wrapper;
                }
            }
            else if (msg.type == "info") {
                if (!pdoc)
                    throw new Error("User refused DOM access");
                pdoc = pdoc;
                ipc.send({
                    type: "info",
                    width: win.width,
                    height: win.height,
                    x: win.x,
                    y: win.y,
                    sc: {
                        x: 0,
                        y: 0,
                        width: pdoc.documentElement.clientWidth,
                        height: pdoc.documentElement.clientHeight
                    }
                });
            }
            else {
                console.warn("Unknown IPC message type:", msg.type);
            }
        }
        catch (err) {
            console.error("Error handling IPC message:", err);
        }
    }
    if (processed >= MAX_MSGS_PER_IPC) {
        console.warn("Reached message cap for one IPC this frame; remaining messages will be processed next frame");
    }
}
document.addEventListener("os-load", async () => {
    try {
        await waitForDefined(() => window.proc, 50, 1000);
        await window.proc.askPermissions(8, "Permission to edit the DOM is required to show windows");
        pdoc = window.parent_doc();
        if (!pdoc)
            throw new Error("User refused DOM access");
        pdoc = pdoc;
        requestAnimationFrame(updateLoop);
        console.log("Glass is (probably) up!");
        ;
        ((Gwindow) => {
            windows.push(Gwindow);
            pdoc.body.appendChild(Gwindow.element);
            Gwindow.element.textContent = "Glass is online!";
            Gwindow.element.style.borderWidth = "3px";
            Gwindow.element.style.borderColor = "black";
            Gwindow.element.style.borderStyle = "solid";
        })({
            x: 20,
            y: 20,
            width: 100,
            height: 100,
            z: 0,
            element: pdoc.createElement("div"),
            ipc: { send: (...a) => { }, recv: () => { } }
        });
    }
    catch (err) {
        console.error("Failed to initialize Glass:", err);
    }
});
function updateLoop() {
    const IPCs = window.IPCs ?? [];
    IPCs.forEach((ipc) => {
        if (!windowsByIPC.has(ipc)) {
            if (!pdoc)
                return;
            const el = pdoc.createElement("div");
            el.style.position = "absolute";
            pdoc.body.appendChild(el);
            const newWindow = {
                element: el,
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                z: windows.length,
                ipc,
            };
            windows.push(newWindow);
            windowsByIPC.set(ipc, newWindow);
            IPCHandler(ipc, newWindow);
        }
        else {
            IPCHandler(ipc, windowsByIPC.get(ipc));
        }
    });
    const currentSet = new Set(IPCs);
    for (const [ipc, win] of windowsByIPC.entries()) {
        if (!currentSet.has(ipc)) {
            if (win.element.parentNode)
                win.element.parentNode.removeChild(win.element);
            windowsByIPC.delete(ipc);
            const idx = windows.indexOf(win);
            if (idx >= 0)
                windows.splice(idx, 1);
        }
    }
    windows.forEach((win, i) => {
        win.z = i;
        const el = win.element;
        el.style.position = "absolute";
        if (win.x + "px" != el.style.left)
            el.style.left = `${win.x}px`;
        if (win.y + "px" != el.style.top)
            el.style.top = `${win.y}px`;
        if (win.width + "px" != el.style.width)
            el.style.width = `${win.width}px`;
        if (win.height + "px" != el.style.height)
            el.style.height = `${win.height}px`;
        el.style.zIndex = String(win.z);
    });
    requestAnimationFrame(updateLoop);
}
export {};
