interface IPC {
    send: (data:any) => void;
    recv: () => any | undefined;
}

interface Window {
    parent_doc: () => Document | undefined;
    os: any;
    proc: any;
    IPCs: IPC[];
}

interface GlassWindow {
    element: HTMLElement;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
    ipc: IPC;
}

let windows: GlassWindow[] = [];

window.proc.requestPermission(4,"Permission to edit the DOM is required to show windows")
// Glass takes full control of the OS document
// Overwrite global document to point to parent_doc
document = window.parent_doc() as Document;
if (!document) {throw new Error("User refused DOM access")};

function IPCHandler(ipc:IPC,window:GlassWindow) {
    let msg:any = ""
    while (msg !== undefined) {
        try {
            msg = ipc.recv()
            if (msg === undefined) {
                break
            }
        
            if (msg.type == "pos") {
                window.x = msg.x
                window.y = msg.y
            } else if (msg.type == "size") {
                window.width = msg.width
                window.height = msg.height
            } else if (msg.type == "element") {
                const elem = document.importNode(msg.element, true)
                window.element = elem
            } 
        } catch {

        }
    }
}

function updateLoop() {
    requestAnimationFrame(updateLoop)
}
requestAnimationFrame(updateLoop)