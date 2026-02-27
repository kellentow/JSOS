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
        cwd:string;
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

        waitForDefined(() => { return this.#ipc.recv() }).then((msg) => {
            console.log("got message from glass", msg)
            if (!msg || msg.type != "new") {
                throw Error("Glass sent unexpected message")
            }
            this.document = msg.document
            this.#id = msg.id
            if (on_load) on_load()
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
    let bytes: number[] = []
    if (fd) {
        let out: number | null = fd.read()
        while (out !== null) {
            bytes.push(out)
            out = fd.read()
        }
    }
    return new Uint8Array(bytes)
}

function writeFile(fd: FSFD | undefined, contents: Uint8Array) {
    if (!fd) { throw Error("Could not write to undefined file descriptor") }
    for (let i = 0; i < contents.length; i++) {
        fd.write(contents[i])
    }
}

export {GWindow, waitForDefined, readFile, writeFile}