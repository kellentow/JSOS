enum Permission {
    CreateProcess = 0,
    UseFilesystem = 1,
    NetworkAccess = 2,
    ExecuteCode = 3,
    EditDom = 4,
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

class ProcessKey {}

class OS { // NOT FINISHED
    #processes:OS_Process[] = [];
    #processKeys:Map<ProcessKey,OS_Process> = new Map();
    #windows:OS_Window[] = [];

    #parents: Map<(OS_Process|OS_Window), (OS_Process|OS_Window)[]> = new Map();
    #perms: Map<(OS_Process|OS_Window), number> = new Map();
    #scripts: Map<OS_Process, Sandbox> = new Map();
    #window_htmls: Map<OS_Window, HTMLElement> = new Map();

    #lastPID: number = 0;
    #root_proc:OS_Process;

    constructor() {
        this.#root_proc = new OS_Process("root",this,null,({} as any as Window))
        let permission = 0
        permission |= this.decodePermID(Permission.CreateProcess);
        permission |= this.decodePermID(Permission.ExecuteCode);
        permission |= this.decodePermID(Permission.NetworkAccess);
        permission |= this.decodePermID(Permission.UseFilesystem);
        this.#perms.set(this.#root_proc,permission)
    }

    getRootProc(): OS_Process | undefined {
        this.getRootProc = () => {return undefined} // Legalize Nuclear Bombs *BOOM*
        return this.#root_proc
    }

    getNewPID() {
        this.#lastPID += 1
        return this.#lastPID
    }

    createProcess(parent:OS_Process,name:string,script:string): OS_Process {
        const sandbox = new Sandbox(script)

        const env = sandbox.env()

        let proc = new OS_Process(name, this, parent, env)

        let key = proc.getKey() as ProcessKey

        this.#processKeys.set(key,proc)

        //@ts-ignore
        env.os = this//@ts-ignore
        env.proc = proc//@ts-ignore
        env.IPCs = []//@ts-ignore
        env.parent_doc = () => {
            if (!this.#perms.has(proc)) {return}
            if (((this.#perms.get(proc) as number) & (Permission.EditDom as number)) == 1) {
                return document
            } else {
                return undefined
            }
        }

        this.#perms.set(proc,this.#perms.get(parent) as number)

        this.#parents.get(parent)?.push(proc)

        this.#scripts.set(proc,sandbox)

        this.#processes.push(proc)

        return proc
    }

    createIPC(self:OS_Process,target:OS_Process) {
        let self_sand = this.#scripts.get(self)
        let target_sand = this.#scripts.get(target)

        let ipc = new IPC()

        //@ts-ignore
        target_sand?.env().IPCs.push(ipc.b_wrapper())
        //@ts-ignore
        self_sand?.env().IPCs.push(ipc.a_wrapper())

        return ipc
    }

    createWindow(parent:OS_Process,x:number,y:number,width:number,height:number,name:string): OS_Window {
        let id = Math.random().toString(36).substring(2, 15)

        const div = document.createElement("div");
        div.id = id;
        div.className = "os-window";
        div.style.position = "absolute";
        div.style.left = `${x}px`;
        div.style.top = `${y}px`;
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        div.style.border = "1px solid black";
        div.style.backgroundColor = "white";
        div.style.boxShadow = "2px 2px 10px rgba(0,0,0,0.5)";
        div.style.resize = "both";
        div.style.overflow = "auto";
        div.style.zIndex = "1";

        const titleBar = document.createElement("div");
        titleBar.style.width = "100%";
        titleBar.style.height = "20px";
        titleBar.style.backgroundColor = "#0078D7";
        titleBar.style.color = "white";
        titleBar.style.cursor = "move";
        titleBar.style.display = "flex";
        titleBar.style.alignItems = "center";
        titleBar.style.paddingLeft = "5px";
        titleBar.innerText = name;

        const body = document.createElement("iframe");
        body.id = `${id}-body`;
        body.sandbox.add("allow-scripts");
        body.style.width = "100%";
        body.style.height = `calc(100% - 20px)`;
        body.style.border = "none";
        body.srcdoc = "<!doctype html><html><body></body></html>";

        div.appendChild(body);
        div.appendChild(titleBar);
        document.body.appendChild(div);

        let window = new OS_Window(x,y,width,height,name,this,parent,body.contentDocument as Document);

        this.#parents.get(parent)?.push(window)

        this.#windows.push(window)
        this.#window_htmls.set(window,div)

        return window
    }

    getPermissions(key:ProcessKey):number|null {
        let proc;
        if (this.#processKeys.has(key)) {
            proc = this.#processKeys.get(key) as OS_Process;
        } else {return null}
        if (this.#perms.has(proc)) {
            return this.#perms.get(proc) as number;
        }
        return null
    }

    decodePermID(perm:number):number {
        return (1<<perm)
    }

    killProcess(key:ProcessKey) {
        let proc;
        if (this.#processKeys.has(key)) {
            proc = this.#processKeys.get(key) as OS_Process;
        } else {return null}
        let kp = this.killProcess;
        let kw = this.closeWindow;
        function recursive(v:(OS_Process | OS_Window)) {
            if (v instanceof OS_Process) {
                kp(v)
            } else if (v instanceof OS_Window) {
                kw(v)
            }
        }
        this.#parents.get(proc)?.forEach(recursive)
        this.#scripts.delete(proc)
    }

    requestPermissions(key:ProcessKey,n:number, reason:string) {
        let proc;
        if (this.#processKeys.has(key)) {
            proc = this.#processKeys.get(key) as OS_Process;
        } else {return null}
        let permName = Permission[n]
        if (!permName || !this.#perms.has(proc)) {
            return
        }
        let y = confirm(`Do you want to give "${proc.getName()}" this permission:\n${permName}\nReason: "${reason}"`)
        if (y) {
            let perms = this.#perms.get(proc) as number;
            this.#perms.set(proc, perms+n);
        }
    }

    closeWindow(obj:OS_Window) {
        let elem = this.#window_htmls.get(obj) as HTMLElement
        elem.remove()
        
        let i = this.#windows.indexOf(obj)
        this.#windows.splice(i, 1)
        
    }

    updatePosition(obj:OS_Window,x:number,y:number) {}

    updateSize(obj:OS_Window,width:number,height:number) {}

    // TEMP CODE BELOW desktop not done
    getDesktop() {return {
        focusWindow(obj:OS_Window) {}
    }}
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
        for (let i = 0; i < path.length - 1; i++) {
            if (!folder[path_arr[i]]) {
                folder[path_arr[i]] = {}
            }
            folder = folder[path_arr[i]]
        }
        folder[path_arr[path_arr.length - 1]] = data

        if (this._saveTimeout) { clearTimeout(this._saveTimeout) };
        this._saveTimeout = setTimeout(() => {
            this.save();
        }, 250); // Save after 250ms of not writing
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
    constructor(script:string) {
        this.#element = document.createElement("iframe");
        this.#element.sandbox.add("allow-scripts");
        this.#element.style.width = "0px";
        this.#element.style.height = "0px";
        this.#element.style.border = "none";
        this.#element.srcdoc = "<script>"+script+"</script>";

        let w = this.env()
        let dummy = (...a:any[]):any=>{return () => {}}
        w.alert = dummy()
        w.confirm = dummy()
        w.prompt = dummy()
        // @ts-ignore
        w.cookieStore = {} // @ts-ignore
        w.indexedDB = {}  // @ts-ignore
        w.document = {} 
    }

    env(): Window {
        return this.#element.contentWindow as Window
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
    #scriptenv:Window;
    #key:ProcessKey;
    children: (OS_Process|Window)[] = [];
    constructor(name: string, os: any, parent: OS_Process | null = null, scriptenv: Window) {
        this.#pid = os.getNewPID();
        this.#name = name;
        this.#os = os; // Reference to the OS instance
        this.#parent = parent;
        this.#scriptenv = scriptenv;
        this.#key = new ProcessKey();

        const w = scriptenv as any;
        w.fetch = (input:RequestInfo,init?:RequestInit) => {
            if (this.getPermissions(Permission.NetworkAccess)) {
                return fetch(input,init)
            }
        }
        w.proc = this
        w.key = this.#key
    }

    getKey(): ProcessKey | undefined {
        this.getKey = () => {return undefined}
        return this.#key
    }

    parentData(p:OS_Process | OS) {
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
        return ((this.#os.getPermissions(this) || 0) & (1 << type)) !== 0; // Return true if the privilege is granted
    }

    getPermissionsAll(): number {
        return (this.#os.getPermissions(this)||0)+0; // Deref
    }

    async askPermissions(type: number, reason:string): Promise<boolean> {
        await this.#os.requestPermissions(this.#key, (1 << type),reason); // Request permissions from the OS
        return this.getPermissions(type);
    }

    createChildProcess(name: string,code: string) {
        if (this.getPermissions(0)) { // Check for create child process permission
            let child = this.#os.createProcess(this, name, code);
            this.children.push(child);
            return child;
        }
    }

    kill(): void {
        this.#os.killProcess(this);
        throw new OSError("",OSErrorCode.ProcessKilled)
    }

    getParent(): OS_Process | null {
        return this.#parent;
    }
}

class OS_Window {
    #x: number;
    #y: number;
    #width: number;
    #height: number;
    #name: string;
    #isDragging: boolean;
    #isResizing: boolean;
    #os: OS;
    #body: Document;
    #parent: OS_Process | null;
    #draggingOffset: { x: number; y: number };
    children: OS_Window[] = [];
    constructor(x: number, y: number, width: number, height: number, name: string, os: any, parent: OS_Process | null = null, doc:Document) {
        this.#x = x;
        this.#y = y;
        this.#width = width;
        this.#height = height;
        this.#name = name;
        this.#isDragging = false;
        this.#isResizing = false;
        this.#draggingOffset = { x: 0, y: 0 };
        this.#parent = parent;
        this.#os = os; // Reference to the OS instance
        this.#body = doc;

        this.#focus();
    }

    parentData(p:OS_Process | OS) {
        if (p === this.#parent || p === this.#os) {
            return {
                body: this.#body
            }
        }
    }

    #getBody(): Document {
        return this.#body;
    }

    addHtml(html: HTMLElement): void {
        const body = this.#getBody();
        if (body) {
            body.body.appendChild(html);
        }
    }

    getPermissionsAll(): number {
        return (this.#os.getPermissions(this) as number)+0
    }

    getPermissions(type: number): boolean {
        return ((this.#os.getPermissions(this) as number) & (1 << type)) !== 0; // Return true if the privilege is granted
    }

    async askPermissions(type: number, reason:string): Promise<boolean> {
        await this.#os.requestPermissions(this, (1 << type), reason); // Request permissions from the OS
        return this.getPermissions(type);
    }

    setPosition(x: number, y: number): void {
        if (this.getPermissions(2)) { // Check for position permission
            this.#x = x;
            this.#y = y;
            this.#os.updatePosition(this,this.#x,this.#y)
        } else {
            console.warn("Permission denied: Cannot set position");
        }
    }

    setSize(width: number, height: number): void {
        if (this.getPermissions(3)) { // Check for size permission
            this.#width = width;
            this.#height = height;
            this.#os.updateSize(this,this.#width,this.#height)
        } else {
            console.warn("Permission denied: Cannot set size");
        }
    }

    createChildWindow(x: number, y: number, width: number, height: number, name: string): OS_Window | null {
        if (this.getPermissions(0) && this.getPermissions(1)) { // Check for create child window permissions (process and window)
            let child = this.#os.createWindow(this.#parent as OS_Process, x, y, width, height, name);
            if (!child) {
                console.warn("Failed to create child window");
                return null;
            }
            this.children.push(child);
            return child;
        } else {
            console.warn("Permission denied: Cannot create child window");
            return null;
        }
    }

    close(): void {
        this.#os.closeWindow(this);
    }

    #focus(): void {
        this.#os.getDesktop().focusWindow(this);
    }

    focus(): void {
        if (this.getPermissions(4)) { // Check for force focus permission
            this.#focus();
        } else {
            console.warn("Permission denied: Cannot focus window");
        }
    }
}

class IPC {
    #queueA:Array<any>=[];
    #queueB:Array<any>=[];
    a_wrapper() {
        let send = (data:any) => {this.#queueB.push(data)}
        let recv = () => {return this.#queueA.shift()}
        return {send,recv}
    }
    b_wrapper() {
        let send = (data:any) => {this.#queueA.push(data)}
        let recv = () => {return this.#queueB.shift()}
        return {send,recv}
    }
}

export {Permission,OSErrorCode,OSError,OS,FS,OS_Process,OS_Window, IPC}