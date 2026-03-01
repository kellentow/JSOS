import { OS, OS_Process, IPCWrapper, FSWrapper, ProcessKey, FSFD } from "./os-classes"

declare global {
    interface Window {
        parent_doc: () => Document | undefined;
        IPCs: IPCWrapper[];
        os: OS;
        proc: OS_Process;
        prockey: ProcessKey;
        fs: () => FSWrapper;
        requestSudo: (reason: string) => boolean;
        cwd: string;
    }
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

class GWindow {
    #id: string;
    #ipc: IPCWrapper;
    document: Document
    constructor(glass_ipc: IPCWrapper, on_load?: () => void) {
        if (glass_ipc === undefined) throw Error("tried to summon a window before could communicate with glass")

        this.#ipc = glass_ipc
        this.#id = ""
        this.document = document //gets replaced after glass gives us a document

        this.#ipc.send({ type: "new" })

        waitForDefined(() => { return this.#ipc.recv() },50,1000).then((msg) => {
            if (msg.type != "new") {
                throw Error("Glass sent unexpected message")
            }
            this.document = msg.document
            this.#id = msg.id
            if (on_load) on_load()
        }).catch((err:Error)=>{
            //ts ignore bc some browsers support cause and some don't, we're already doing esnext and most of those support it
            //@ts-ignore
            throw new Error("Glass timed out", { cause: err });
        })
    }

    move(x: number, y: number, z: number) {
        this.#ipc.send({ type: "pos", target: this.#id, x, y, z })
    }

    scale(width: number, height: number) {
        this.#ipc.send({ type: "size", target: this.#id, width, height })
    }

    track() {
        this.#ipc.send({ type: "track", target: this.#id, pid: window.proc.getPID() })
    }

    destroy() {
        this.#ipc.send({ type: "destroy", target: this.#id })
    }
}

function readFile(fd: FSFD | undefined): Uint8Array {
    if (!fd) return new Uint8Array(0);
    fd.seek(0); // start from beginning
    return fd.readBLK(fd.length()) || new Uint8Array(0);
}

function writeFile(fd: FSFD | undefined, contents: Uint8Array) {
    if (!fd) { throw Error("Could not write to undefined file descriptor") }
    fd.writeBLK(contents)
}

async function importFromFs(fd: FSFD) {
    const buffer_module = readFile(fd).buffer as ArrayBuffer
    const blob = new Blob([buffer_module], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    let module = await import(url);
    // give js some more time to load it
    setTimeout(() => {URL.revokeObjectURL(url);},10*1000)
    return module
}

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export { GWindow, waitForDefined, readFile, writeFile, importFromFs, sleep }