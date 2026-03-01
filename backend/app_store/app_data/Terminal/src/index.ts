import { OS, OS_Process, IPCWrapper, FSWrapper, FSPermission, Permission, ProcessKey } from "./../../../../../src/os-classes"
import { GWindow, importFromFs, readFile, waitForDefined, writeFile } from "./../../../../../src/helpers"

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

            os.getRootProc().createChildProcess(root_key, "Terminal", term_code, window.cwd)
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

        term.write(`${user}@${host}$ `)

        let currentLine = '';
        let cur_command:any = undefined;

        term.onData((data) => {
            if (cur_command === undefined) {
                if (data == "\r") {
                    term.write('\r\n');
                    const command = currentLine.trim();
                    handleCommand(command);
                    currentLine = '';
                    if (cur_command === undefined) { //no command was run, or finished instantly
                        term.write(`${user}@${host}$ `)
                    }

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
                if (data === '\x03') {
                    term.writeln('^C');
                    currentLine = '';
                    term.write(`${user}@${host}$ `)
                    cur_command = undefined
                }
            }
        });

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
            term.writeln("sorry this terminal doesn't work right now")
            cur_command = "temp" //replace later with class Command
        }
    })
})