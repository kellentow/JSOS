import { OS, OS_Process, IPCWrapper } from "./../../../../../src/os-classes"

declare global {
    interface Window {
        parent_doc: () => Document | undefined;
        IPCs: IPCWrapper[];
        os: OS;
        proc: OS_Process;
    }
}

document.addEventListener("os-load", async () => {
    let process = (window.proc as OS_Process)
    let os = (window.os as OS)

    let root = os.getRootProc()

    let glass: OS_Process | undefined = undefined
    for (var i = 0; i < root.children.length; i++) {
        if (root.children[i].getName() == "Glass") {
            glass = root.children[i]
        }
    }
    if (glass === undefined) throw Error("Could not find Glass")

    os.createIPC(process, glass)
    let glass_ipc = window.IPCs[0]

    let info = { x: 0, y: 0, width: 0, height: 0, sc: { x: 0, y: 0, width: 0, height: 0 } }
    let element = document.createElement("div")
    element.style.overflow = "clip"
    let bg = document.createElement("img")
    bg.src = "https://external-preview.redd.it/r6g38aXSaQWtd1KxwJbQ-Fs5jtSVDxX3wtLHJEdqixw.jpg?width=1080&crop=smart&auto=webp&s=87a2c94cb3e1561e2b6abd467ea68d81b9901720"
    bg.style.objectFit = "cover";
    bg.style.objectPosition = "center center";
    bg.style.width = "100%"
    bg.style.height = "100%"
    element.appendChild(bg)

    function update() {
        glass_ipc.send({ type: "info" })
        let msg: Record<string, any> = {}
        while (msg !== undefined) {
            msg = glass_ipc.recv()
            if (msg === undefined) continue
            if (msg.type == "info") {
                info = msg as any
            }
        }
        element.style.width = info.sc.width + "px"
        element.style.height = info.sc.height + "px"
        glass_ipc.send({ type: "pos", x: 0, y: 0 })
        glass_ipc.send({ type: "size", width: info.sc.width, height: info.sc.height })
        glass_ipc.send({ type: "element", element: element })
        requestAnimationFrame(update)
    }
    update()
})