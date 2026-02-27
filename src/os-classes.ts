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

enum FSPermission {
    r = 4,
    w = 2,
    x = 1,
    rw = 6,
    wx = 3,
    rx = 5,
    rwx = 7
}

enum Permission {
    CreateProcess = 1 << 0,
    UseFilesystem = 1 << 1,
    NetworkAccess = 1 << 2,
    ExecuteCode = 1 << 3,
    EditDom = 1 << 4,
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

    #children: Map<OS_Process, OS_Process[]> = new Map();
    #parent: Map<OS_Process, OS_Process | OS> = new Map(); 
    #procAs: Map<OS_Process, number> = new Map();
    #perms: Map<OS_Process, number> = new Map();
    #scripts: Map<OS_Process, Sandbox> = new Map();
    #fs: FS = FS.load()

    #lastPID: number = 0;
    #root_proc: OS_Process;
    #root_key: ProcessKey;

    constructor() {
        this.#root_proc = new OS_Process("root", this, null, ({ overrideEnv: (...args: any[]) => { } } as any as Sandbox))
        this.#perms.set(this.#root_proc, 31)
        this.#processes.push(this.#root_proc)
        this.#root_key = this.#root_proc.getKey() as ProcessKey
        this.#processKeys.set(this.#root_key, this.#root_proc)
        this.#children.set(this.#root_proc, []);
        this.#parent.set(this.#root_proc, this)
        this.#procAs.set(this.#root_proc, 0)
        this.#fs.save()
    }

    getRootProc(): OS_Process {
        return this.#root_proc
    }

    // One time use, for the kernel aka the script constructing the OS
    getKernelData(): { root: OS_Process, fs: FS, key: ProcessKey } | undefined {
        this.getKernelData = () => { return undefined }
        return {
            root: this.#root_proc,
            key: this.#root_key,
            fs: this.#fs
        }
    }

    getNewPID() {
        this.#lastPID += 1
        return this.#lastPID
    }

    async createProcess(parentKey: ProcessKey, name: string, script: string, cwd:string="/"): Promise<OS_Process | undefined> {
        if (!this.#processKeys.has(parentKey)) { return }

        const sandbox = new Sandbox(script, name, {})

        await waitForNonNull(() => sandbox.env(), 50)

        let parent = this.#processKeys.get(parentKey) as OS_Process

        let proc = new OS_Process(name, this, parent, sandbox)

        let key = proc.getKey(this.#root_key) as ProcessKey

        this.#processKeys.set(key, proc)
        this.#procAs.set(proc, this.#procAs.get(parent) as number)

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
            fs: () => { return this.#fs.createWrapper(() => { return this.#procAs.get(proc) as number }) },
            proc,
            requestSudo: (reason: string) => {
                if (confirm(`Process "${proc.getName()}" (${proc.getPID()}) is requesting sudo permissions.\nReason: "${reason}"`)) {
                    this.#procAs.set(proc, 0)
                }
                return this.#procAs.get(proc) == 0
            },
            cwd
        } as any);

        this.#perms.set(proc, this.#perms.get(parent) as number)

        this.#children.get(parent)?.push(proc)
        this.#parent.set(proc, parent)

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

    killProcess(key: ProcessKey, target?: OS_Process) {
        if (!target) {
            if (this.#processKeys.has(key) && this.isRoot(key)) {
                target = this.#processKeys.get(key) as OS_Process;
            } else { return null }
        }

        let target_key = this.#processKeys.get(target)

        for (let child of this.#children.get(target) || []) {
            this.killProcess(child.getKey(this.#root_proc) as any);
        }
        this.#scripts.get(target)?.destroy()
        this.#scripts.delete(target)
        this.#processKeys.delete(target_key as ProcessKey)
        this.#processes = this.#processes.filter((v) => v !== target)
        let parent = this.#parent.get(target)
        if (parent instanceof OS_Process) {
            this.#children.set(parent,this.#children.get(parent)?.filter((v) => v !== target) as OS_Process[])
            parent.children = parent.children.filter((v) => v !== target)
        }
        this.#parent.delete(target)
        this.#procAs.delete(target)
    }

    requestPermissions(key: ProcessKey, n: Permission, reason: string) {
        let proc;
        if (this.#processKeys.has(key)) {
            proc = this.#processKeys.get(key) as OS_Process;
        } else { return null }
        let permName = Permission[Math.log2(n)]
        if (!permName || !this.#perms.has(proc)) {
            return
        }
        let can = this.isRoot(key) || ((this.#perms.get(proc) as number) & n) !== 0
        if (!can) {
            can = confirm(`Do you want to give "${proc.getName()}" this permission:\n${permName}\nReason: "${reason}"`)
        }

        if (can) {
            let perms = this.#perms.get(proc) as number;
            this.#perms.set(proc, perms | n);
        }
    }

    isRoot(key: ProcessKey) {
        let key_proc = this.#processKeys.get(key)
        if (!key_proc) return false
        //can we trust them? (is pid 0 or uid 0 aka root)
        return key_proc == this.#root_proc || this.#procAs.get(key_proc) == 0
    }

    setProcUser(key: ProcessKey, target: OS_Process, user: number) {
        if (this.isRoot(key)) {
            this.#procAs.set(target, user) //ok change user
        }
    }

    getProcUser(key: ProcessKey, target: OS_Process) {
        if (this.isRoot(key) || target == this.#processKeys.get(key)) {
            return this.#procAs.get(target)
        }
    }

    getProcess(pid:number) {
        let proc = this.#processes.find(p => p.getPID() == pid)
        return proc
    }
} // NOT FINISHED

type NodeType = "Node" | "File" | "Directory";

class FSNode {
    owner: number = 0
    //group: number = 0
    perms: number = 0o755
    type: NodeType = "Node"
    static registry: Record<string, typeof FSNode> = {}

    static deserialize(data: Record<string, any>) {
        const ctor = this.registry[data.type] ?? this
        let node = new ctor()
        if (typeof data.owner == "number") node.owner = data.owner
        //if (typeof data.group == "number") node.group = data.group
        if (typeof data.perms == "number") node.perms = data.perms
        if (typeof data.type == "string") node.type = data.type as NodeType
        return node
    }

    serialize(): Record<string, any> {
        return {
            owner: this.owner,
            //group: this.group,
            perms: this.perms,
            type: this.type,
        }
    }
}

class FSDir extends FSNode {
    children: Record<string, FSNode> = {}
    type: NodeType = "Directory"

    static deserialize(data: Record<string, any>) {
        let directory = super.deserialize(data) as FSDir
        let children: Record<string, FSNode> = {}
        Object.keys(data.children).forEach((key: string) => {
            let child = data.children[key]
            children[key] = (FSNode.registry[child.type] ?? FSNode).deserialize(child)
        });
        directory.children = children
        return directory
    }

    serialize() {
        let data = super.serialize()
        let children: Record<string, any> = {}
        Object.keys(this.children).forEach(key => {
            let child = this.children[key]
            children[key] = child.serialize()
        });
        data.children = children
        return data
    }
}

class FSFile extends FSNode {
    type: NodeType = "File"
    contents: Uint8Array = new Uint8Array()

    static deserialize(data: Record<string, any>) {
        let file = super.deserialize(data) as FSFile
        if (typeof data.contents === "string") {
            const binary = atob(data.contents);
            const len = binary.length;
            const bytes = new Uint8Array(len);

            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            file.contents = bytes
        }
        return file
    }

    serialize() {
        let data = super.serialize()
        let binary = ""
        this.contents.forEach(byte => {
            binary += String.fromCharCode(byte)
        })
        data.contents = btoa(binary)
        return data
    }
}

FSNode.registry = {
    Node: FSNode,
    Directory: FSDir,
    File: FSFile
}

class FSFD {
    #file: FSFile
    #ptr: number = 0
    #fs: FS;
    #perms: number = 0o0
    constructor(file: FSFile, perms: number, fs: FS) {
        this.#file = file
        this.#perms = perms
        this.#fs = fs
    }

    read() {
        if ((this.#perms & FSPermission.r) == 0) return null
        if (this.#ptr >= this.#file.contents.length) return null
        return this.#file.contents[this.#ptr++]
    }

    write(byte: number) {
        if ((this.#perms & FSPermission.w) == 0) return
        if (this.#ptr >= this.#file.contents.length) {
            const newBuf = new Uint8Array(this.#ptr + 1)
            newBuf.set(this.#file.contents)
            this.#file.contents = newBuf
        }
        this.#fs.queueSave()
        return this.#file.contents[this.#ptr++] = byte & 0xFF
    }

    seek(position: number) {
        if (position < 0) position = 0
        this.#ptr = position
    }
}

interface FSWrapper {
    getPerms: (path:string) => number;
    touch: (path: string) => boolean;
    mkdir: (path: string) => boolean;
    open: (path: string) => FSFD | undefined;
    lsdir: (path: string) => string[] | undefined;
    isdir: (path: string) => boolean | undefined;
    rm: (path: string) => boolean | undefined;
    stat: (path:string) => false | {owner:number,perms:number,type:string};
    dirname: (path:string) => string;
    normalize: (path:string) => string;
}

class FS {
    #files: FSDir;
    #saveTimeout: number | undefined;
    constructor() {
        this.#files = new FSDir()
    }

    queueSave() {
        if (this.#saveTimeout !== undefined) {
            clearTimeout(this.#saveTimeout)
        }
        // ts thinks it's it's own Timeout object so im forcing number
        this.#saveTimeout = setTimeout(()=>{
            this.#saveTimeout = undefined
            this.save()
        },1000) as any as number
    }

    save() {
        try {
            localStorage.setItem("fs", JSON.stringify(this.#files.serialize()));
        } catch (error) {
            console.error("Failed to save to localStorage:", error);
        }
    }

    static load() {
        const fs = new FS();
        const data = localStorage.getItem("fs")
        try {
            if (data) {
                fs.#files = FSDir.deserialize(JSON.parse(data));
            }
        } catch (error) {
            console.error("Failed to load from localStorage:", error);
        }
        return fs;
    }

    parse_path(path: string) {
        let parts = path.split("/")
        let new_path: string[] = []
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i]
            if (part == "") { if (i != parts.length - 1) new_path = [] } // ex /home/user// == /
            else if (part == "..") { new_path.pop() } // ex /home/user/../ == /home/
            else if (part == ".") { } else { // ex /home/user/./ == /home/user/
                new_path.push(part)
            }
        }
        return new_path
    }

    getNode(path: string): FSNode | undefined {
        let path_arr = this.parse_path(path)
        let node: FSNode = this.#files
        for (let i = 0; i < path_arr.length; i++) {
            if (node.type !== "Directory" || !(node instanceof FSDir)) return
            if (!node.children[path_arr[i]]) {
                return undefined
            }
            node = node.children[path_arr[i]]
        }
        return node
    }

    dirname(path: string) {
        const parts = this.parse_path(path).slice(0, -1)
        return parts.length ? "/" + parts.join("/") : "/"
    }

    path_exists(path: string) {
        return this.getNode(path) !== undefined
    }

    mkdir(path: string) {
        let path_arr = this.parse_path(path)
        let parent_path = path_arr.slice(0, -1).join("/")
        let parent = this.getNode(parent_path) as FSDir
        if (!parent || parent.type !== "Directory") return false
        let last = path_arr[path_arr.length - 1]
        if (parent.children[last]) return false
        parent.children[last] = new FSDir()
        ;this.queueSave();
        return true
    }

    touch(path: string) {
        let path_arr = this.parse_path(path)
        let parent_path = path_arr.slice(0, -1).join("/")
        let parent = this.getNode(parent_path) as FSDir
        if (!parent || parent.type !== "Directory") return false
        let last = path_arr[path_arr.length - 1]
        if (parent.children[last]) return false
        parent.children[last] = new FSFile()
        ;this.queueSave();
        return true
    }

    rm (path:string) {
        let parent = this.getNode(this.dirname(path)) as FSDir
        if (!parent) return false
        delete parent.children[this.parse_path(path).slice(-1)[0]]
        ;this.queueSave();
        return true
    }

    getFD(path: string, perms: number = 0o0) {
        let file = this.getNode(path) as FSFile
        if (!file || file.type !== "File") return

        return new FSFD(file, perms, this)
    }

    getUserPerms(path: string, uid: number) {
        if (uid == 0) return 0o7
        if (!this.path_exists(path)) return
        let parts = this.parse_path(path)
        let perm = 0o0

        let node: FSNode = this.#files
        for (let i = 0; i < parts.length; i++) {
            perm = node.owner == uid ? (node.perms & 0o700) >> 6 : node.perms & 0o7
            if ((perm & FSPermission.x) == 0) return
            node = (node as FSDir).children[parts[i]]
        }
        perm = node.owner == uid ? (node.perms & 0o700) >> 6 : node.perms & 0o7
        return perm
    }

    createWrapper(uid_solver: () => number): FSWrapper {
        return {
            getPerms: (path:string) => {
                return this.getUserPerms(path,uid_solver()) || 0
            },
            mkdir: (path: string) => {
                let perm = this.getUserPerms(this.dirname(path), uid_solver())
                if (perm !== undefined && perm & FSPermission.w) {
                    return this.mkdir(path)
                }
                return false
            },
            touch: (path: string) => {
                let perm = this.getUserPerms(this.dirname(path), uid_solver())
                if (perm !== undefined && perm & FSPermission.w) {
                    return this.touch(path)
                }
                return false
            },
            open: (path: string) => {
                let perm = this.getUserPerms(path, uid_solver())
                if (perm === undefined) return
                return this.getFD(path, perm)
            },
            lsdir: (path: string) => {
                let perm = this.getUserPerms(path, uid_solver())
                if (perm === undefined || (perm & FSPermission.r) == 0) return
                let node = this.getNode(path)
                if (!node || node.type !== "Directory") return
                return Object.keys((node as FSDir).children)
            },
            isdir: (path: string) => {
                let perm = this.getUserPerms(this.dirname(path), uid_solver())
                if (perm === undefined || (perm & FSPermission.r) == 0) return false

                let node = this.getNode(path)
                if (!node) return false
                return node.type == "Directory"
            },
            rm: (path: string) => {
                let perm = this.getUserPerms(this.dirname(path), uid_solver())
                if (perm === undefined || (perm & FSPermission.w) == 0) return false
                return this.rm(path)
            },
            stat: (path:string) => {
                let perm = this.getUserPerms(path, uid_solver())
                if (perm === undefined || (perm & FSPermission.r) == 0) return false
                let node = this.getNode(path)
                if (!node) return false
                return {owner:node.owner,perms:node.perms,type:node.type}
            },
            dirname: (path:string) => {
                return this.dirname(path)
            },
            normalize: (path:string) => {
                return "/" + this.parse_path(path).join("/")
            }
        }
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
            prompt: dummy(), //@ts-ignore
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
        (this.env() as Window).document.dispatchEvent(event);
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
                return new Response(undefined, { status: 403 })
            },
            prockey: this.#key,
        } as any);
    }

    getKey(key?: ProcessKey): ProcessKey | undefined {
        this.getKey = (key?: ProcessKey) => {
            if (key === undefined) return undefined
            if (key === this.#key || this.#os.isRoot(key)) {
                return this.#key;
            }
            return undefined;
        }
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
        if (this.getPermissions(type)) { return true }
        await this.#os.requestPermissions(this.#key, (type), reason); // Request permissions from the OS
        return this.getPermissions(type);
    }

    async createChildProcess(key: ProcessKey, name: string, code: string, cwd:string="/"): Promise<OS_Process | undefined> {
        if (key !== this.#key) return
        if (this.getPermissions(Permission.CreateProcess)) { // Check for create child process permission
            let child = await this.#os.createProcess(this.#key, name, code, cwd) as OS_Process;
            this.children.push(child);
            return child;
        }
    }

    kill(key: ProcessKey): void {
        if (this.#key == key || this.#os.isRoot(key)) {
            this.#os.killProcess(this.#key);
        }
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
    a_wrapper(): IPCWrapper {
        let send = (data: any) => { this.#queueB.push(data) }
        let recv = () => { return this.#queueA.shift() }
        return { send, recv }
    }
    b_wrapper(): IPCWrapper {
        let send = (data: any) => { this.#queueA.push(data) }
        let recv = () => { return this.#queueB.shift() }
        return { send, recv }
    }
}

export { Permission, OSErrorCode, OSError, OS, FS, OS_Process, IPC, ProcessKey, IPCWrapper, FSPermission, FSWrapper, FSFD }