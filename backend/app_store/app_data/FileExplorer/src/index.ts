import { OS, OS_Process, IPCWrapper, FSWrapper, FSPermission } from "./../../../../../src/os-classes"
import { GWindow, waitForDefined } from "./../../../../../src/helpers"

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
        let fd = fs.open("/apps/fileexplorer/index.html");
        let bytes: number[] = []
        if (fd) {
            let out: number | null = fd.read()
            while (out !== null) {
                bytes.push(out)
                out = fd.read()
            }
        }
        Gwindow.document.documentElement.innerHTML = new TextDecoder().decode(new Uint8Array(bytes));

        let stale = true;
        let cwd = "/"

        function refreshFolder(path: string, element: HTMLElement, level = 0) {
            let contents = fs.lsdir(path)
            // 2 == FSPermission.w
            let can_rm = fs.getPerms(path) & 2

            if (contents) {
                contents.forEach((item) => {
                    let item_element = document.createElement("div")
                    item_element.classList.add("node")
                    item_element.textContent = "|   ".repeat(level + 1) + item

                    let delete_button = document.createElement("button")
                    delete_button.innerText = "Trash"
                    delete_button.style.right = "2em"
                    delete_button.addEventListener("click", () => {
                        fs.rm(path + "/" + item)
                        stale = true
                    })

                    let is_dir = !!fs.isdir(path+"/"+item)

                    if (is_dir) {
                        item_element.innerText += "/"
                    }

                    if (can_rm) {item_element.appendChild(delete_button)}

                    if (is_dir) {
                        let cd_button = document.createElement("button")
                        cd_button.innerText = ">"
                        cd_button.addEventListener("click", () => {
                            cwd = fs.normalize(path+"/"+item)
                            stale = true
                        })
                        item_element.appendChild(cd_button)
                        if (level < 1) {
                            refreshFolder(path + "/" + item, item_element, level + 1)
                        }
                    }
                    element.appendChild(item_element)
                })
            }
        }

        let reload_button = Gwindow.document.getElementById("reload") as HTMLButtonElement
        let pid_shower = Gwindow.document.getElementById("pid") as HTMLButtonElement
        let main = Gwindow.document.getElementById("main") as HTMLElement
        reload_button.onclick = () => {
            stale = true
        }
        Gwindow.move(100, 100, 3)
        Gwindow.scale(300, 400)
        setTimeout(() => {
            window.requestSudo("dev purposes only");
            stale = true
        }, 100)

        function staleHandler() {
            if (stale) {
                stale = false
                pid_shower.innerText = "User: " + String(os.getProcUser(window.prockey,process))
                main.innerHTML = ""
                main.innerText = cwd
                if (cwd != "/") {
                    let back_button = document.createElement("button")
                    back_button.innerText = "../"
                    back_button.addEventListener("click", () => {
                        cwd = fs.dirname(cwd)
                        stale = true
                    })
                    main.appendChild(back_button)
                }
                refreshFolder(cwd, main)
            }
            requestAnimationFrame(staleHandler)
        }
        staleHandler()
    })
})