import { FSWrapper, IPCWrapper, OS, OS_Process, ProcessKey } from "./../../../../../src/os-classes"
import { readFile, sleep, writeFile, waitForDefined} from "./../../../../../src/helpers"

document.addEventListener("os-load", async () => {
    let fs = window.fs()

    let uid = window.os.getProcUser(window.prockey, window.proc)
    if (uid != 0) {
        if (!window.requestSudo("JSPT needs sudo to manage apps")) {
            throw new Error("JSPT needs sudo to manage apps")
        }
    }

    if (!fs.stat("/etc/jspt")) {
        fs.mkdir("/etc/jspt")
        fs.touch("/etc/jspt/status")
        writeFile(fs.open("/etc/jspt/status"), new TextEncoder().encode("{}"))
        fs.touch("/etc/jspt/packages")
        writeFile(fs.open("/etc/jspt/packages"), new TextEncoder().encode("{}"))
    }

    interface packageData {
        "name":string
        "appid":string
        "location":string
        "description":string
        "version":string
        "author":string
        "license":string
        "license_url":string
        "hash":string
    }

    let status = JSON.parse(new TextDecoder().decode(readFile(fs.open("/etc/jspt/status"))))
    let packages:Record<string,packageData> = JSON.parse(new TextDecoder().decode(readFile(fs.open("/etc/jspt/packages"))))

    let ipc = await waitForDefined(()=>window.IPCs[0],10,100)

    function stdout(out: string) {
        if (ipc) {
            ipc.send({ type: "stdout", content: new TextEncoder().encode(out) })
        }
        console.log("stdout: "+out)
    }

    async function exit(code:number) {
        if (ipc) {
            ipc.send({ type: "code", code })
        }
        console.log("exiting with code", code)

        await sleep(100) // let parent process the ipc msg, and it's not that urgent to kill this proc

        window.os.killProcess(window.prockey)
    }

    console.log(window.args)

    switch (window.args[0]) {
        case "help": {
            stdout("jspt [action] args\r\n")
            stdout("help - displays this message\r\n")
            stdout("list - displays all know packages\r\n")
            stdout("update - updates package cache\r\n")
            stdout("install [package] - installs a package \r\n")
            break;
        }
        case "update": {
            let csv_resp = await fetch("/backend/app_store/apps.csv")
            let apps = (await csv_resp.text()).split(",")
            for (let i=0; i<apps.length; i++) {
                let id = apps[i]
                let app_data:packageData = await (await fetch("/backend/app_store/app_data/"+id)).json()
                packages[id] = app_data
            }
            break;
        }
        case "list": {
            Object.keys(packages).forEach((id)=>{
                let v = packages[id]
                stdout(`${v.name} ${v.version} - ${v.description}\r\n`)
            })
            break;
        }
        case "install": {
            let target = window.args[1]
            if (Object.keys(packages).find((n) => n == target)) {
                stdout("sorry, i haven't implimented this yet (yes i know this is the ONLY purpose of this but shhhh, patience)\r\n")
                await exit(1)
            } else {
                stdout("Package not found\r\n")
                await exit(1)
            }
            break;
        }
        default: {
            stdout(`"${window.args[0]}" is an unknown action\r\n`)
            await exit(1)
        }
    }
    writeFile(fs.open("/etc/jspt/status"),new TextEncoder().encode(JSON.stringify(status)))
    writeFile(fs.open("/etc/jspt/packages"),new TextEncoder().encode(JSON.stringify(packages)))
    await exit(0)
})