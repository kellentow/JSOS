import { FSWrapper, IPCWrapper, OS, OS_Process, ProcessKey } from "./../../../../../src/os-classes"
import { GWindow, importFromFs, readFile, sleep, waitForDefined, writeFile } from "./../../../../../src/helpers"

class Command {
    #proc:OS_Process
    #ipc:IPCWrapper
    #os:OS; // needed for .kill()
    #key:ProcessKey; // needed for .kill()
    #stdout_buffer:Uint8Array = new Uint8Array(0)
    #pid:number;
    code:number|undefined=undefined
    constructor(os:OS,fs:FSWrapper,proc:OS_Process,key:ProcessKey,path:string,args:string[]) {
        let name = path.split("/").pop() as string
        let fd = fs.open(path)

        this.#os = os
        this.#key = key
        this.#proc = proc.createChildProcess(key,name,new TextDecoder().decode(readFile(fd)),window.cwd) as any as OS_Process
        this.#pid = this.#proc.pid

        os.createIPC(proc,this.#proc)
        this.#ipc = window.IPCs[window.IPCs.length - 1]

        let intervalID = setInterval(()=>{
            let msg = this.#ipc.recv()
            while (msg !== undefined) {
                if (msg.type == "code") {
                    this.code = msg.code
                } else if (msg.type == "stdout") {
                    let new_buf = new Uint8Array(this.#stdout_buffer.length + msg.content.length)
                    new_buf.set(this.#stdout_buffer,0)
                    new_buf.set(msg.content,this.#stdout_buffer.length)
                    this.#stdout_buffer = new_buf
                } else {
                    console.warn("Unknown IPC Message: ",msg)
                }
                msg = this.#ipc.recv()
            }
            console.log(os.getProcess(this.#pid))
            if (os.getProcess(this.#pid) === undefined) { // process quit
                if (this.code === undefined) { // didn't tell us a code to give
                    this.code = 1 // default to 1
                    clearInterval(intervalID)
                }
            }
        },100)
    }

    stdin(text:string) {
        this.#ipc.send({type:"stdin", content:new TextEncoder().encode(text)})
    }

    stdout() {
        let content = this.#stdout_buffer
        this.#stdout_buffer = new Uint8Array(0)
        return content
    }

    kill() {
        this.#os.killProcess(this.#key,this.#proc)
    }
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
    let Gwindow = new GWindow(window.IPCs[0], async () => {
        Gwindow.track();
        Gwindow.move(200, 200, 0)
        Gwindow.scale(400, 200)
        let fd = fs.open(window.cwd + "/index.html");
        let bytes: number[] = []
        if (fd) {
            let out: number | null = fd.read()
            while (out !== null) {
                bytes.push(out)
                out = fd.read()
            }
        }
        Gwindow.document.documentElement.innerHTML = new TextDecoder().decode(new Uint8Array(bytes));

        let xterm_fd = fs.open("/lib/xterm.js")
        if (xterm_fd === undefined) {
            let uid = os.getProcUser(window.prockey, window.proc) as number
            window.requestSudo("The terminal needs to write in /lib for first time setup")//, this will be undone as soon as the setup is done")

            fs = window.fs()

            async function save_to_fs(url: string, path: string) { // shhhh i totally didn't copy this from the kernel
                fs.touch(path)
                let unzipit = await fetch(url)
                let unzipit_array = new Uint8Array(await unzipit.arrayBuffer())
                writeFile(fs.open(path), unzipit_array)
            }

            Gwindow.document.body.innerText = "This may take a moment..."
            await save_to_fs("https://cdn.jsdelivr.net/npm/xterm/+esm", "/lib/xterm.js")
            await save_to_fs("https://cdn.jsdelivr.net/npm/xterm/css/xterm.css", "/lib/xterm.css")
            await save_to_fs("https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.11.0/+esm", "lib/xterm-addon-fit.js")

            let root_key = os.getRootProc().getKey(window.prockey) as ProcessKey
            let term_code = new TextDecoder().decode(readFile(fs.open(window.cwd + "/index.js")))

            let new_proc = await os.getRootProc().createChildProcess(root_key, "Terminal", term_code, window.cwd)
            if (new_proc !== undefined) {
                os.setProcUser(root_key,new_proc,uid)
            }
            process.kill(window.prockey)
        }
        if (xterm_fd === undefined) throw new Error("Failed to get xterm.js")
        let xterm_style_fd = fs.open("/lib/xterm.css")
        if (xterm_style_fd === undefined) throw new Error("Failed to get xterm.css")
        let xterm_fit_fd = fs.open("/lib/xterm-addon-fit.js")
        if (xterm_fit_fd === undefined) throw new Error("Failed to get xterm-addon-fit.js")

        let { Terminal } = await importFromFs(xterm_fd) as typeof import("xterm");
        let { FitAddon } = await importFromFs(xterm_fit_fd) as typeof import("xterm-addon-fit");

        let style = document.createElement("style")
        style.innerText = new TextDecoder().decode(readFile(xterm_style_fd))
        Gwindow.document.head.appendChild(style)

        let term_element = Gwindow.document.getElementById("terminal") as HTMLElement
        Gwindow.document.body.style.margin = "0px"

        const fitAddon = new FitAddon();
        let term = new Terminal()
        term.loadAddon(fitAddon);
        term.open(term_element)

        Gwindow.document.addEventListener('resize', () => {
            fitAddon.fit();
        });

        Gwindow.document.dispatchEvent(new Event("resize"))


        // now we handle terminal stuff
        let user = "guest"
        let host = "JSOS"

        let currentLine = '';
        let cur_command:undefined | Command = undefined;

        function resetInput() {
            currentLine = '';
            cur_command = undefined
            term.write(`${user}@${host}$ `)
        }
        resetInput()

        term.onData((data) => {
            if (cur_command === undefined) {
                if (data == "\r") {
                    term.write('\r\n');
                    const command = currentLine.trim();
                    handleCommand(command);
                    if (cur_command === undefined) resetInput()

                } else if (data == "\u007F") {
                    if (currentLine.length > 0) {
                        currentLine = currentLine.slice(0, -1);
                        term.write('\b \b');
                    }

                } else {
                    currentLine += data;
                    term.write(data);
                }
            } else {
                cur_command.stdin(data)
            }

            if (data === '\u0003') {
                term.writeln('^C');
                currentLine = '';
                term.write(`${user}@${host}$ `)
                cur_command?.kill()
                resetInput()
            } else if (data === '\u0004') {
                term.writeln('^D');
                currentLine = '';
                cur_command?.kill()
                resetInput()
                handleCommand("exit")
            }
        });

        setInterval(()=>{
            if (cur_command !== undefined) {
                term.write(cur_command.stdout())
                console.log(cur_command.code)
                if (cur_command.code !== undefined) { // the proc quit
                    term.writeln(""+cur_command.code)
                    resetInput()
                }
            }
        },100)

        function handleCommand(command: string) {
            console.log('User ran command:', command);
            let parts: string[] = [""]
            let part = 0
            let literal = false
            let in_str = false
            for (let i=0; i<command.length; i++) {
                let char = command[i]
                if (literal) { // ex \\ -> \    \" -> "
                    parts[part] += char
                    literal = false
                } else if (char == " ") {
                    if (in_str) {
                        parts[part] += char
                    } else {
                        part++
                        parts[part] = ""
                    }
                } else if (char == "\\") {
                    literal = true
                } else if (char == "\"" || char == "\'") { // treat " == ' bc im lazy
                    in_str = !in_str
                } else {
                    parts[part] += char
                }
            }
            if (in_str) return term.writeln("Error: Unterminated String")
            if (literal) return term.writeln("Error: Unterminated Literal")
            console.log("parsed command ",parts)

            if (parts[0] == "exit") {
                // sleep to mimic real terminal emulators
                sleep(100).then(()=>process.kill(window.prockey))
            } else if (parts[0].startsWith("/")) {
                if (fs.stat(parts[0])) {
                    cur_command = new Command(os,fs,process,window.prockey,parts[0],parts.slice(1))
                } else {
                    term.writeln("Command not found")
                }
            } else {
                if (fs.stat("/bin/"+parts[0])) {
                    cur_command = new Command(os,fs,process,window.prockey,"/bin/"+parts[0],parts.slice(1))
                } else {
                    term.writeln("Command not found")
                }
            }
        }
    })
})