import { OS, OS_Process, FSFD } from "./../../../../../src/os-classes"
import { GWindow, waitForDefined, readFile } from "./../../../../../src/helpers"

interface GlassInfo {
    type: string,
    sc: { x: number, y: number, width: number, height: number },
    windows: { x: number, y: number, width: number, height: number, z: number, id: string }[]
}

let info: GlassInfo = { type:"info", sc: { x: 0, y: 0, width: 0, height: 0 }, windows: [] }

async function update(Gwindow: GWindow) {
    let ipc = window.IPCs[0]
    ipc.send({type:"info"})
    let out = {type:""}
    while (out.type != "info") {
        out = await waitForDefined(ipc.recv) 
    }
    info = out as any
    Gwindow.move(0, 0, 0)
    Gwindow.scale(info.sc.width, info.sc.height)
    requestAnimationFrame(async () => { await update(Gwindow) })
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
    let Gwindow = new GWindow(window.IPCs[0], () => {
        Gwindow.track();
        update(Gwindow)
        let fd = fs.open(window.cwd+"/index.html");
        let html = new TextDecoder().decode(readFile(fd))
        Gwindow.document.documentElement.innerHTML = html;

        let wallpaper = Gwindow.document.getElementById("wallpaper") as HTMLImageElement
        let boot_anim = Gwindow.document.getElementById("boot_anim") as HTMLDivElement
        
        let wallpaper_fd = fs.open(window.cwd+"/wallpaper.png")
        //ts is wack "ArrayBufferLike is not assignable to type ArrayBuffer" so im just using as any
        let wallpaper_blob = new Blob([readFile(wallpaper_fd).buffer as any], { type: "image/png" })
        if (wallpaper_blob.size == 0) { // for some reason it read nothing so default to default bg
            // made it with this https://shoonia.github.io/1x1/#86c6ffff
            wallpaper.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAD0lEQVR4AQEEAPv/AIbG/wQhAkwI5Wp+AAAAAElFTkSuQmCC"
        } else {
            wallpaper.src = URL.createObjectURL(wallpaper_blob)
        }

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
            boot_anim.remove()
        }, 3500);
    })
})
