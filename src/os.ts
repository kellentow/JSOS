import { OS, OS_Process } from './os-classes.js'
// @ts-ignore
import { unzip } from 'https://unpkg.com/unzipit@1.4.2/dist/unzipit.module.js';

let os = new OS()
let root_proc = os.getRootProc() as OS_Process

let canvas: HTMLCanvasElement = document.getElementById("viewport") as any as HTMLCanvasElement
let ctx = canvas?.getContext("2d")

ctx?.strokeText("Please wait", 1, 1)

async function run_app(name:string,procname:string) {
    const resp = await fetch("/backend/app_store/download/"+name);
    const arrayBuffer = await resp.arrayBuffer();

    // unzip the file
    const { entries } = await unzip(arrayBuffer);
    const mainEntry = entries["index.js"];
    let app_code: string | undefined;
    if (mainEntry) {
        const blob = await mainEntry.blob(); // or use .text() for direct string
        app_code = await blob.text();
        await root_proc.createChildProcess(procname, app_code as string)
    } else {
        console.error(entries)
        throw new Error("Failed to get "+name)
    }
}

await run_app("Glass","Glass")
await run_app("Glasstop","Glasstop")