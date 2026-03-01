import { OS, OS_Process, ProcessKey, FS, FSFD, FSDir} from './os-classes.js'
import { importFromFs, readFile, writeFile, sleep} from './helpers.js'

let os = new OS()
let { root, fs, key: root_key } = os.getKernelData() as any as { root: OS_Process, fs: FS, key: ProcessKey }

//@ts-expect-error
console.log("Build ID: " + BUILD)

// @ts-ignore
window.os = os
// @ts-ignore
window.root_key = root_key

async function extract_zip(path: string, zip: ArrayBuffer) {
    let unzipit = await importFromFs(fs.getFD("/lib/unzipit.js",0o7) as FSFD)

    const { entries } = (await unzipit.unzip(zip)) as { entries: Record<string, { isDirectory: boolean, name: string, arrayBuffer: () => ArrayBuffer }> };

    for (const entry of Object.values(entries)) {
        if (entry.isDirectory) continue;

        const parts = entry.name.split("/");
        const folders = parts.slice(0, -1);
        const filename = parts[parts.length - 1];

        let cwd = path;

        // Create folders
        for (const folder of folders) {
            cwd += "/" + folder;
            await fs.mkdir(cwd);
        }

        const fullPath = cwd + "/" + filename;

        await fs.touch(fullPath);
        let fd = fs.getFD(fullPath,0o7)
        await writeFile(
            fd,
            new Uint8Array(await entry.arrayBuffer())
        );
    }
}

async function get_app(path: string, name: string) {
    fs.mkdir(path)
    const resp = await fetch("/backend/app_store/download/" + name);
    const arrayBuffer = await resp.arrayBuffer();

    // unzip the file
    await extract_zip(path, arrayBuffer)
}

async function run_app(path: string, name: string, uid: number) {
    let app_code = new TextDecoder().decode(readFile(fs.getFD(path + "/index.js",0o7)))
    if (app_code == "") {return console.error(`Failed to load ${name} from "${path}", does the file exist?`)}
    let proc = await root.createChildProcess(root_key, name, app_code as string, path)
    if (proc) {
        os.setProcUser(root_key, proc, uid)
    }
}

async function save_to_fs(url:string, path:string) {
    let unzipit = await fetch(url)
    let unzipit_array = new Uint8Array(await unzipit.arrayBuffer())
    fs.touch(path)
    writeFile(fs.getFD(path,0o7),unzipit_array)
}

let first_boot = await cookieStore.get("first") || "false"
if (first_boot == "false") {
    // wipe the fs just in case     nvm
    //(fs.getNode("/") as FSDir).children = {}

    // rebuild
    fs.mkdir("/app")
    fs.mkdir("/lib")
    fs.mkdir("/bin")
    fs.mkdir("/home")
    fs.mkdir("/etc")

    await save_to_fs("https://unpkg.com/unzipit@1.4.2/dist/unzipit.module.js","/lib/unzipit.js")

    await get_app("/app/Glass", "Glass")
    await get_app("/app/Glasstop", "Glasstop")
    await get_app("/app/FileExplorer", "FileExplorer")
    await get_app("/app/TaskManager", "TaskManager")
    await get_app("/app/Terminal", "Terminal")

    fs.save()
    cookieStore.set("first", "true")
    window.location.reload()
} else {
    await run_app("/app/Glass", "Glass", 1)
    await sleep(100) // let glass boot (should be ~instant, but just in case)
    await run_app("/app/Glasstop", "Glasstop", 2)
    await sleep(3000)
    await run_app("/app/FileExplorer", "FileExplorer", 1000)
    await sleep(100)
    await run_app("/app/TaskManager", "TaskManager", 0)
    await sleep(100)
    await run_app("/app/Terminal", "Terminal", 1000)
}