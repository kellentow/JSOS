function waitForNonNull(getValue: () => any | null, interval = 50) {
    return new Promise(resolve => {
        const check = setInterval(() => {
            const value = getValue();
            if (value != null) {
                clearInterval(check);
                resolve(value);
            }
        }, interval);
    });
}

enum Permission {
    CreateProcess = 1<<0,
    UseFilesystem = 1<<1,
    NetworkAccess = 1<<2,
    ExecuteCode =   1<<3,
    EditDom =       1<<4,
}

enum OSErrorCode {
    ProcessKilled = 0,
    PermissionViolated = 1
}

class OSError extends Error {
    code: OSErrorCode;
    constructor(message: string, code: OSErrorCode) {
        super(message);
        this.name = "OSError";
        this.code = code;
    }
}

class ProcessKey { }

class OS { // NOT FINISHED
    #processes: OS_Process[] = [];
    #processKeys: Map<ProcessKey, OS_Process> = new Map();

    #parents: Map<(OS_Process), (OS_Process)[]> = new Map();
    #perms: Map<(OS_Process), number> = new Map();
    #scripts: Map<OS_Process, Sandbox> = new Map();

    #lastPID: number = 0;
    #root_proc: OS_Process;

    constructor() {
        this.#root_proc = new OS_Process("root", this, null, ({overrideEnv:(...args:any[])=>{}} as any as Sandbox))
        this.#perms.set(this.#root_proc, 31)
        this.#processes.push(this.#root_proc)
        this.#processKeys.set(this.#root_proc.getKey() as ProcessKey,this.#root_proc)
        this.#parents.set(this.#root_proc, []);
    }

    getRootProc(): OS_Process {
        return this.#root_proc
    }

    getNewPID() {
        this.#lastPID += 1
        return this.#lastPID
    }

    async createProcess(parentKey: ProcessKey, name: string, script: string): Promise<OS_Process|undefined> {
        if (!this.#processKeys.has(parentKey)) {return}

        const sandbox = new Sandbox(script, name, {})

        await waitForNonNull(() => sandbox.env(), 50)

        let parent = this.#processKeys.get(parentKey) as OS_Process

        let proc = new OS_Process(name, this, parent, sandbox)

        let key = proc.getKey() as ProcessKey

        this.#processKeys.set(key, proc)

        sandbox.overrideEnv({
            os: this,
            IPCs: [],
            parent_doc: () => {
                if (!this.#perms.has(proc)) { return }
                if (((this.#perms.get(proc) as number) & (Permission.EditDom as number)) !== 0) {
                    return document
                } else {
                    return undefined
                }
            },
            proc
        });

        this.#perms.set(proc, this.#perms.get(parent) as number)

        this.#parents.get(parent)?.push(proc)

        this.#scripts.set(proc, sandbox)

        this.#processes.push(proc)

        sandbox.load()

        return proc
    }

    createIPC(self: OS_Process, target: OS_Process) {
        let self_sand = this.#scripts.get(self)
        let target_sand = this.#scripts.get(target)

        let ipc = new IPC()

        //@ts-ignore
        target_sand?.env().IPCs.push(ipc.b_wrapper())
        //@ts-ignore
        self_sand?.env().IPCs.push(ipc.a_wrapper())

        //return ipc
    }

    getPermissions(key: ProcessKey): number | null {
        let proc;
        if (this.#processKeys.has(key)) {
            proc = this.#processKeys.get(key) as OS_Process;
        } else { return null }
        if (this.#perms.has(proc)) {
            return this.#perms.get(proc) as number;
        }
        return null
    }

    killProcess(key: ProcessKey) {
        let proc;
        if (this.#processKeys.has(key)) {
            proc = this.#processKeys.get(key) as OS_Process;
        } else { return null }
        let kp = this.killProcess;
        function recursive(v: OS_Process) {
            kp(v)
        }
        this.#parents.get(proc)?.forEach(recursive)
        this.#scripts.delete(proc)
    }

    requestPermissions(key: ProcessKey, n: number, reason: string) {
        let proc;
        if (this.#processKeys.has(key)) {
            proc = this.#processKeys.get(key) as OS_Process;
        } else { return null }
        let permName = Permission[n]
        if (!permName || !this.#perms.has(proc)) {
            return
        }
        let y = confirm(`Do you want to give "${proc.getName()}" this permission:\n${permName}\nReason: "${reason}"`)
        if (y) {
            let perms = this.#perms.get(proc) as number;
            this.#perms.set(proc, perms | n);
        }
    }
} // NOT FINISHED

class FS {
    files: Record<string, any>;
    _saveTimeout: number | null;
    constructor() {
        this.files = { "apps": {} }
        this._saveTimeout = null;
    }

    save() {
        try {
            localStorage.setItem("fs", JSON.stringify(this.files));
        } catch (error) {
            console.error("Failed to save to localStorage:", error);
        }
    }

    static load(data: any) {
        const fs = new FS();
        try {
            if (data) {
                fs.files = JSON.parse(data);
            }
        } catch (error) {
            console.error("Failed to load from localStorage:", error);
        }
        return fs;
    }

    write(path: string, data: any) {
        let path_arr = path.split("/")
        let folder = this.files
        for (let i = 0; i < path_arr.length - 1; i++) {
            if (!folder[path_arr[i]]) {
                folder[path_arr[i]] = {}
            }
            folder = folder[path_arr[i]]
        }
        folder[path_arr[path_arr.length - 1]] = data

        if (this._saveTimeout) { clearTimeout(this._saveTimeout) };
        this._saveTimeout = setTimeout(() => {
            this.save();
        }, 250) as unknown as number; // Save after 250ms of not writing
    }

    path_exists(path: string) {
        let path_arr = path.split("/")
        let folder = this.files
        for (let i = 0; i < path_arr.length; i++) {
            if (!folder[path_arr[i]]) {
                return false
            }
            folder = folder[path_arr[i]]
        }
        return true
    }

    read(path: string) {
        if (path === "") {
            return this.files
        }
        const pathParts = path.split("/");
        let folder = this.files;
        for (let i = 0; i < pathParts.length; i++) {
            if (!folder[pathParts[i]]) {
                console.warn("File not found: " + pathParts.join("/"));
                return null;
            }
            folder = folder[pathParts[i]];
        }
        return folder;
    }
}

class Sandbox {
    #element: HTMLIFrameElement;
    #name: string;
    constructor(script: string, name?: string, override?: Partial<Window>) {
        this.#name = name || "UNKNOWN"
        this.#element = document.createElement("iframe");
        this.#element.setAttribute("sandbox", "allow-scripts allow-same-origin"); 
        this.#element.style.width = "0px";
        this.#element.style.height = "0px";
        this.#element.style.border = "none";
        this.#element.srcdoc = "<script>" + script + "</script>";

        let dummy = (...a: any[]): any => { return () => { } }
        const good_console = globalThis.console
        let windowConsole = {
            ...good_console,
            debug: (...args: any[]) => { good_console.debug(`[${this.#name}] `, ...args) },
            log: (...args: any[]) => { good_console.log(`[${this.#name}] `, ...args) },
            warn: (...args: any[]) => { good_console.warn(`[${this.#name}] `, ...args) },
            error: (...args: any[]) => { good_console.error(`[${this.#name}] `, ...args) }
        }

        this.overrideEnv({
            alert: dummy(),
            confirm: dummy(),
            prompt: dummy(), // @ts-ignore
            cookieStore: {}, // @ts-ignore
            indexedDB: {},   // @ts-ignore
            document: {},
            console: windowConsole,
            ...override
        })
        document.body.appendChild(this.#element)
    }

    env(): Window | null {
        return this.#element.contentWindow
    }

    overrideEnv(override: Partial<Window>) {
        const w = this.env();
        if (w) {
            for (let key in override) {
                    try {
                        // @ts-ignore
                        w[key] = override[key];
                    } catch {
                        console.error(`[Sandbox Manager] Failed to overwrite ${key} on ${this.#name}`)
                    }
                }
        } else {
            this.#element.addEventListener("load", () => this.overrideEnv(override), { once: true });
        }
    }

    load() {
        const event = new CustomEvent("os-load");
        console.log(`[Sandbox Manager] Loading ${this.#name}`);
        ( this.env() as Window).document.dispatchEvent(event);
    }

    destroy() {
        this.#element.remove()
    }
}

class OS_Process {
    #pid: number;
    #name: string;
    #os: OS;
    #parent: OS_Process | null;
    #scriptenv: Sandbox;
    #key: ProcessKey;
    children: OS_Process[] = [];
    constructor(name: string, os: any, parent: OS_Process | null = null, sandbox: Sandbox) {
        this.#pid = os.getNewPID();
        this.#name = name;
        this.#os = os; // Reference to the OS instance
        this.#parent = parent;
        this.#scriptenv = sandbox;
        this.#key = new ProcessKey();

        sandbox.overrideEnv({
            fetch: async (input: RequestInfo, init?: RequestInit) => {
                if (this.getPermissions(Permission.NetworkAccess)) {
                    return await fetch(input, init)
                }
                return new Response(undefined,{status:403})
            },
            prockey: this.#key,
        } as any);
        console.log(this.#os)
    }

    getKey(): ProcessKey | undefined {
        this.getKey = () => { return undefined }
        return this.#key
    }

    parentData(p: OS_Process | OS) {
        if (p === this.#parent || p == this.#os) {
            return {
                scriptenv: this.#scriptenv,
                name: this.#name,
                pid: this.#pid
            }
        }
    }

    getPID(): number {
        return this.#pid;
    }

    getName(): string {
        return this.#name;
    }

    getPermissions(type: number): boolean {
        return ((this.#os.getPermissions(this.#key) || 0) & (1 << type)) !== 0; // Return true if the privilege is granted
    }

    getPermissionsAll(): number {
        return (this.#os.getPermissions(this.#key) || 0) + 0; // Deref
    }

    async askPermissions(type: number, reason: string): Promise<boolean> {
        if (this.getPermissions(type)) {return true}
        await this.#os.requestPermissions(this.#key, (type), reason); // Request permissions from the OS
        return this.getPermissions(type);
    }

    async createChildProcess(name: string, code: string) {
        if (this.getPermissions(1)) { // Check for create child process permission
            let child = await this.#os.createProcess(this.#key, name, code) as OS_Process;
            this.children.push(child);
            return child;
        }
    }

    kill(): void {
        this.#os.killProcess(this);
        throw new OSError("", OSErrorCode.ProcessKilled)
    }

    getParent(): OS_Process | null {
        return this.#parent;
    }
}

interface IPCWrapper {
    recv: () => any | undefined,
    send: (data: any) => void
}

class IPC {
    #queueA: Array<any> = [];
    #queueB: Array<any> = [];
    a_wrapper() {
        let send = (data: any) => { this.#queueB.push(data) }
        let recv = () => { return this.#queueA.shift() }
        return { send, recv }
    }
    b_wrapper() {
        let send = (data: any) => { this.#queueA.push(data) }
        let recv = () => { return this.#queueB.shift() }
        return { send, recv }
    }
}

export { Permission, OSErrorCode, OSError, OS, FS, OS_Process, IPC, ProcessKey, IPCWrapper}