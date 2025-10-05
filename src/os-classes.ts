export enum Permission {
    CreateProcess = 0,
    CreateWindow = 1,
    SetPosition = 2,
    SetSize = 3,
    ForceFocus = 4,
    UseFilesystem = 5,
    NetworkAccess = 6,
    ExecuteCode = 7,
}

export enum OSErrorCode {
    ProcessKilled = 0,
    PermissionViolated = 1
}

export class OSError extends Error {
    code: OSErrorCode;
    constructor(message: string, code: OSErrorCode) {
        super(message);
        this.name = "OSError";
        this.code = code;
    }
}

export class OS { // NOT FINISHED
    #processes:OS_Process[] = [];
    #windows:OS_Window[] = [];

    #parents: Map<(OS_Process|OS_Window), (OS_Process|OS_Window)[]> = new Map();
    #perms: Map<(OS_Process|OS_Window), number> = new Map();
    #scripts: Map<OS_Process, HTMLIFrameElement> = new Map();

    #lastPID: number = 0;
    #root_proc:OS_Process;

    constructor() {
        this.#root_proc = new OS_Process("root",this,null)
        let permission = 0
        permission |= this.decodePermID(Permission.CreateProcess);
        permission |= this.decodePermID(Permission.CreateWindow);
        permission |= this.decodePermID(Permission.ExecuteCode);
        permission |= this.decodePermID(Permission.ForceFocus);
        permission |= this.decodePermID(Permission.NetworkAccess);
        permission |= this.decodePermID(Permission.SetPosition);
        permission |= this.decodePermID(Permission.SetSize);
        permission |= this.decodePermID(Permission.UseFilesystem);
        this.#perms.set(this.#root_proc,permission)
    }

    getNewPID() {
        this.#lastPID += 1
        return this.#lastPID
    }

    createProcess(name:string,script:string,parent?:OS_Process): OS_Process {
        if (!parent) {parent = this.#root_proc}

        let proc = new OS_Process(name, this, parent)

        this.#perms.set(proc,this.#perms.get(parent) as number)

        const body = document.createElement("iframe");
        body.sandbox.add("allow-scripts");
        body.style.width = "0px";
        body.style.height = "0px";
        body.style.border = "none";
        body.srcdoc = "<script>"+script+"</script>";

        this.#scripts.set(proc,body)

        return proc
    }

    createWindow(x:number,y:number,width:number,height:number,name:string,process:OS_Process): OS_Window {
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

        let window = new OS_Window(x,y,width,height,name,this,process,body.contentDocument as Document);

        this.#windows.push(window)

        return window
    }

    getPermissions(proc:OS_Process|OS_Window):number|null {
        if (this.#perms.has(proc)) {
            return this.#perms.get(proc) as number;
        }
        return null
    }

    decodePermID(perm:number):number {
        return (1<<perm)
    }

    killProcess(proc:OS_Process) {
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

    requestPermissions(proc:OS_Process|OS_Window,n:number) {
        let permName = Permission[n]
        if (!permName || !this.#perms.has(proc)) {
            return
        }
        let y = confirm("Do you want to give a app this permission:\n"+permName)
        if (y) {
            let perms = this.#perms.get(proc) as number;
            this.#perms.set(proc, perms+n);
        }
    }

    // TEMP CODE BELOW ui not done

    closeWindow(obj:OS_Window,) {}

    getDesktop() {return {
        focusWindow(obj:OS_Window) {}
    }}

    updatePosition(obj:OS_Window,x:number,y:number) {}

    updateSize(obj:OS_Window,width:number,height:number) {}
} // NOT FINISHED

export class FS {
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

export class OS_Process {
    #pid: number;
    #name: string;
    #os: OS;
    #parent: OS_Process | null;
    children: (OS_Process|Window)[] = [];
    constructor(name: string, os: any, parent: OS_Process | null = null) {
        this.#pid = os.getNewPID();
        this.#name = name;
        this.#os = os; // Reference to the OS instance
        this.#parent = parent;
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

    async askPermissions(type: number): Promise<boolean> {
        await this.#os.requestPermissions(this, (1 << type)); // Request permissions from the OS
        return this.getPermissions(type);
    }

    createChildProcess(name: string,code: string) {
        if (this.getPermissions(0)) { // Check for create child process permission
            let child = this.#os.createProcess(name, code, this);
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

    createWindow(x: number, y: number, width: number, height: number, name: string): OS_Window | null {
        if (this.getPermissions(1)) { // Check for create window permission
            return this.#os.createWindow(x, y, width, height, name, this);
        } else {
            console.warn("Permission denied: Cannot create window");
            return null;
        }
    }
}

export class OS_Window {
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

    async askPermissions(type: number): Promise<boolean> {
        await this.#os.requestPermissions(this, (1 << type)); // Request permissions from the OS
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
            let child = this.#os.createWindow(x, y, width, height, name, this.#parent as OS_Process);
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