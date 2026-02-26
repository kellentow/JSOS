import { OS, OS_Process, IPCWrapper, FSWrapper } from "./../../../../../src/os-classes"

declare global {
    interface Window {
        parent_doc: () => Document | undefined;
        IPCs: IPCWrapper[];
        os: OS;
        proc: OS_Process;
        fs: ()=>FSWrapper;
    }
}

interface GlassInfo {
    sc: { x: number, y: number, width: number, height: number },
    windows: { x: number, y: number, width: number, height: number, z: number, id: string }[]
}

//@ts-expect-error
let glass_ipc: IPCWrapper = undefined;
let info: GlassInfo = { sc: { x: 0, y: 0, width: 0, height: 0 }, windows: [] }

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
    document: Document
    constructor(on_load?: () => void) {
        if (glass_ipc === undefined) throw Error("tried to summon a window before could communicate with glass")

        glass_ipc.send({ type: "new" })
        this.#id = ""
        this.document = document //gets replaced after glass gives us a document

        waitForDefined(() => { return glass_ipc.recv() }).then((msg) => {
            if (!msg || msg.type != "new") {
                throw Error("Glass sent unexpected message")
            }
            this.document = msg.document
            this.#id = msg.id
            if (on_load) on_load()
        })
    }

    move(x?: number, y?: number, z?: number) {
        let this_window_info = info.windows.find((v) => { return v.id == this.#id }) || { x: 0, y: 0, width: 0, height: 0, z: 0, id: 0 }
        x = x !== undefined ? x : this_window_info.x
        y = y !== undefined ? y : this_window_info.y
        z = z !== undefined ? z : this_window_info.z
        glass_ipc.send({ type: "pos", target:this.#id, x, y, z })
    }

    scale(width?: number, height?: number) {
        let this_window_info = info.windows.find((v) => { return v.id == this.#id }) || { x: 0, y: 0, width: 0, height: 0, z: 0, id: 0 }
        width = width !== undefined ? width : this_window_info.width
        height = height !== undefined ? height : this_window_info.height
        glass_ipc.send({ type: "size", target:this.#id, width, height })
    }
}

function update(Gwindow:GWindow) {
    glass_ipc.send({ type: "info" })
    let msg: Record<string, any> = glass_ipc.recv()
    while (msg !== undefined) {
        if (msg.type == "info") {
            info = msg as any
        }
        msg = glass_ipc.recv()
    }
    Gwindow.move(0,0,0)
    Gwindow.scale(info.sc.width, info.sc.height)
    requestAnimationFrame(()=>{update(Gwindow)})
}

document.addEventListener("os-load", async () => {
    let process = (window.proc as OS_Process)
    let os = (window.os as OS)
    let fs = window.fs()

    let root = os.getRootProc()

    let glass: OS_Process | undefined = undefined
    for (var i = 0; i < root.children.length; i++) {
        if (root.children[i].getName() == "Glass") {
            glass = root.children[i]
        }
    }
    if (glass === undefined) throw Error("Could not find Glass")

    os.createIPC(process, glass)
    glass_ipc = window.IPCs[0]
    let Gwindow = new GWindow(() => {
        update(Gwindow)
        let fd = fs.open("/apps/glasstop/index.html");
        let bytes:number[] = []
        if (fd) {
            let out:number | null = fd.read()
            while (out !== null) {
                bytes.push(out)
                out = fd.read()
            }
        }
        Gwindow.document.documentElement.innerHTML = new TextDecoder().decode(new Uint8Array(bytes));
        let boot_anim = Gwindow.document.getElementById("boot_anim") as HTMLDivElement
        setTimeout(() => {
            boot_anim.classList.add("fill");
        }, 1000);

        setTimeout(() => {
            const diagonal = Math.sqrt(
                window.innerWidth ** 2 +
                window.innerHeight ** 2
            )

            const scale = diagonal / 50

            boot_anim.style.transform = `scale(${scale})`
            boot_anim.style.opacity = "0"
        }, 2250);

        setTimeout(() => {
            //boot_anim.remove()
        }, 3500);
    })
})