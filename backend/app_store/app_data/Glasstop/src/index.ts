import { OS, OS_Process, FSFD } from "./../../../../../src/os-classes"
import { GWindow } from "./../../../../../src/helpers"

interface GlassInfo {
    sc: { x: number, y: number, width: number, height: number },
    windows: { x: number, y: number, width: number, height: number, z: number, id: string }[]
}

let info: GlassInfo = { sc: { x: 0, y: 0, width: 0, height: 0 }, windows: [] }

function update(Gwindow: GWindow) {
    Gwindow.move(0, 0, 0)
    Gwindow.scale(info.sc.width, info.sc.height)
    requestAnimationFrame(() => { update(Gwindow) })
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
        update(Gwindow)
        let fd = fs.open("/apps/glasstop/index.html");
        Gwindow.document.documentElement.innerHTML = new TextDecoder().decode(readFile(fd));

        let wallpaper = Gwindow.document.getElementById("wallpaper") as HTMLImageElement
        let boot_anim = Gwindow.document.getElementById("boot_anim") as HTMLDivElement
        
        let wallpaper_fd = fs.open("/apps/glasstop/wallpaper.png")
        //ts is wack "ArrayBufferLike is not assignable to type ArrayBuffer" so im just using as any
        let wallpaper_blob = new Blob([readFile(wallpaper_fd).buffer as any], { type: "image/png" })
        wallpaper.src = URL.createObjectURL(wallpaper_blob)

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