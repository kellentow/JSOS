import { OS, OS_Process, ProcessKey, FS, FSPermission } from './os-classes.js'
// @ts-ignore
import { unzip } from 'https://unpkg.com/unzipit@1.4.2/dist/unzipit.module.js';

let os = new OS()
let { root, fs, key: root_key } = os.getKernelData() as any as { root: OS_Process, fs: FS, key: ProcessKey }

// @ts-ignore
window.os = os
// @ts-ignore
window.root_key = root_key

if (!fs.path_exists("/apps")) {
    fs.mkdir("/apps")
}

function writeFile(path: string, contents: Uint8Array) {
    let fd = fs.getFD(path, FSPermission.w)
    if (fd === undefined) { throw Error(`Could not get FD: -w- ${path}`) }
    for (let i = 0; i < contents.length; i++) {
        fd.write(contents[i])
    }
}

function readFile(path: string): Uint8Array {
    let fd = fs.getFD(path, FSPermission.r);
    if (fd === undefined) throw Error(`Could not get FD: r-- ${path}`);

    const bytes: number[] = [];
    let out = fd.read();
    while (out != null) {
        bytes.push(out);
        out = fd.read();
    }
    return new Uint8Array(bytes);
}

async function extract_zip(path: string, zip: ArrayBuffer) {
    const { entries } = (await unzip(zip)) as { entries: Record<string, { isDirectory: boolean, name: string, arrayBuffer: () => ArrayBuffer }> };

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
        await writeFile(
            fullPath,
            new Uint8Array(await entry.arrayBuffer())
        );
    }
}

async function run_app(path: string, name: string, uid: number) {
    if (!fs.path_exists(path)) {
        fs.mkdir(path)
        const resp = await fetch("/backend/app_store/download/" + name);
        const arrayBuffer = await resp.arrayBuffer();

        // unzip the file
        await extract_zip(path, arrayBuffer)
    }
    let app_code = new TextDecoder().decode(readFile(path + "/index.js"));
    let proc = await root.createChildProcess(root_key, name, app_code as string)
    if (proc) {
        os.setProcUser(root_key, proc, uid)
    }
}

// USER IS uid 1000
await run_app("/apps/glass", "Glass", 1)
await run_app("/apps/glasstop", "Glasstop", 2)
setTimeout(async () => {
    await run_app("/apps/fileexplorer", "FileExplorer", 1000)
    await run_app("/apps/taskmanager", "TaskManager", 0)
}, 3000)