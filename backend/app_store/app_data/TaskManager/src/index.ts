import { OS, OS_Process, IPCWrapper, FSWrapper, ProcessKey } from "./../../../../../src/os-classes"
import {GWindow} from "../../../../../src/helpers"

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
    let Gwindow = new GWindow(window.IPCs[0],() => {
        Gwindow.track();
        let fd = fs.open(window.cwd+"/index.html");
        let bytes:number[] = []
        if (fd) {
            let out:number | null = fd.read()
            while (out !== null) {
                bytes.push(out)
                out = fd.read()
            }
        }
        Gwindow.document.documentElement.innerHTML = new TextDecoder().decode(new Uint8Array(bytes));
        
        function refresh(proc: OS_Process, element: HTMLElement, level = 0) {
            element.style.whiteSpace = "pre"
            element.textContent = "|   ".repeat(level)+ `${proc.getName()}    pid: ${proc.getPID()}    uid: ${os.getProcUser(window.prockey as ProcessKey,proc)}`
            let kill_button = document.createElement("button")
            kill_button.textContent = "Kill"
            kill_button.onclick = () => {
                os.killProcess(window.prockey,proc)
            }
            kill_button.style.right = "10px"
            element.appendChild(kill_button)

            element.style.marginLeft = "0px"
            if (proc) {
                proc.children.forEach((item) => {
                    let item_element = document.createElement("div")
                    refresh(item, item_element, level+1)
                    element.appendChild(item_element)
                })
            }
        }

        setInterval(() => {
            Gwindow.document.getElementById("main")!.innerHTML = ""
            refresh(os.getRootProc(), Gwindow.document.getElementById("main") as HTMLElement)
        },500)
        Gwindow.move(500,100,3)
        Gwindow.scale(300,400)
    })
})