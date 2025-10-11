import JSZip from 'jszip';
import {OS,OS_Process} from './os-classes.js'

let os = new OS()
let root_proc = os.getRootProc() as OS_Process

let canvas: HTMLCanvasElement = document.getElementById("viewport") as any as HTMLCanvasElement
let ctx = canvas?.getContext("2d")

ctx?.strokeText("Please wait",1,1)

let glass_bytes:any = await fetch("/backend/app_store/download/glass").then((resp) => resp.arrayBuffer())
let glass_zip:any = await JSZip.loadAsync(glass_bytes)
let glass_code = await glass_zip.file("main.js")?.async("string")

glass_bytes = null
glass_zip = null

let glass = os.createProcess(root_proc,"Glass",glass_code)