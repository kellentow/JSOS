import { OS, FSPermission } from './os-classes.js';
// @ts-ignore
import { unzip } from 'https://unpkg.com/unzipit@1.4.2/dist/unzipit.module.js';
let os = new OS();
// @ts-ignore
window.os = os;
let { root, fs } = os.getKernelData();
let root_key = root.getKey();
if (!fs.path_exists("/apps")) {
    fs.mkdir("/apps");
}
function writeFile(path, contents) {
    let fd = fs.getFD(path, FSPermission.w);
    if (fd === undefined) {
        throw Error(`Could not get FD: -w- ${path}`);
    }
    for (let i = 0; i < contents.length; i++) {
        fd.write(contents[i]);
    }
}
function readFile(path) {
    let fd = fs.getFD(path, FSPermission.r);
    if (fd === undefined)
        throw Error(`Could not get FD: r-- ${path}`);
    const bytes = [];
    let out = fd.read();
    while (out != null) {
        bytes.push(out);
        out = fd.read();
    }
    return new Uint8Array(bytes);
}
async function extract_zip(path, zip) {
    const { entries } = (await unzip(zip));
    for (const entry of Object.values(entries)) {
        if (entry.isDirectory)
            continue;
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
        await writeFile(fullPath, new Uint8Array(await entry.arrayBuffer()));
    }
}
async function run_app(path, name, uid) {
    if (!fs.path_exists(path)) {
        fs.mkdir(path);
        const resp = await fetch("/backend/app_store/download/" + name);
        const arrayBuffer = await resp.arrayBuffer();
        // unzip the file
        await extract_zip(path, arrayBuffer);
    }
    let app_code = new TextDecoder().decode(readFile(path + "/index.js"));
    let proc = await root.createChildProcess(name, app_code);
    if (proc) {
        os.setProcUser(root_key, proc, uid);
    }
}
// USER IS uid 1000
await run_app("/apps/glass", "Glass", 1);
await run_app("/apps/glasstop", "Glasstop", 2);
