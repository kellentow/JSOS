var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _OS_processes, _OS_windows, _OS_parents, _OS_perms, _OS_scripts, _OS_window_htmls, _OS_lastPID, _OS_root_proc, _Sandbox_element, _OS_Process_pid, _OS_Process_name, _OS_Process_os, _OS_Process_parent, _OS_Process_scriptenv, _OS_Window_instances, _OS_Window_x, _OS_Window_y, _OS_Window_width, _OS_Window_height, _OS_Window_name, _OS_Window_isDragging, _OS_Window_isResizing, _OS_Window_os, _OS_Window_body, _OS_Window_parent, _OS_Window_draggingOffset, _OS_Window_getBody, _OS_Window_focus, _IPC_queueA, _IPC_queueB;
var Permission;
(function (Permission) {
    Permission[Permission["CreateProcess"] = 0] = "CreateProcess";
    Permission[Permission["CreateWindow"] = 1] = "CreateWindow";
    Permission[Permission["SetPosition"] = 2] = "SetPosition";
    Permission[Permission["SetSize"] = 3] = "SetSize";
    Permission[Permission["ForceFocus"] = 4] = "ForceFocus";
    Permission[Permission["UseFilesystem"] = 5] = "UseFilesystem";
    Permission[Permission["NetworkAccess"] = 6] = "NetworkAccess";
    Permission[Permission["ExecuteCode"] = 7] = "ExecuteCode";
})(Permission || (Permission = {}));
var OSErrorCode;
(function (OSErrorCode) {
    OSErrorCode[OSErrorCode["ProcessKilled"] = 0] = "ProcessKilled";
    OSErrorCode[OSErrorCode["PermissionViolated"] = 1] = "PermissionViolated";
})(OSErrorCode || (OSErrorCode = {}));
class OSError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "OSError";
        this.code = code;
    }
}
class OS {
    constructor() {
        _OS_processes.set(this, []);
        _OS_windows.set(this, []);
        _OS_parents.set(this, new Map());
        _OS_perms.set(this, new Map());
        _OS_scripts.set(this, new Map());
        _OS_window_htmls.set(this, new Map());
        _OS_lastPID.set(this, 0);
        _OS_root_proc.set(this, void 0);
        __classPrivateFieldSet(this, _OS_root_proc, new OS_Process("root", this, null, {}), "f");
        let permission = 0;
        permission |= this.decodePermID(Permission.CreateProcess);
        permission |= this.decodePermID(Permission.CreateWindow);
        permission |= this.decodePermID(Permission.ExecuteCode);
        permission |= this.decodePermID(Permission.ForceFocus);
        permission |= this.decodePermID(Permission.NetworkAccess);
        permission |= this.decodePermID(Permission.SetPosition);
        permission |= this.decodePermID(Permission.SetSize);
        permission |= this.decodePermID(Permission.UseFilesystem);
        __classPrivateFieldGet(this, _OS_perms, "f").set(__classPrivateFieldGet(this, _OS_root_proc, "f"), permission);
    }
    getNewPID() {
        __classPrivateFieldSet(this, _OS_lastPID, __classPrivateFieldGet(this, _OS_lastPID, "f") + 1, "f");
        return __classPrivateFieldGet(this, _OS_lastPID, "f");
    }
    createProcess(name, script, parent) {
        if (!parent) {
            parent = __classPrivateFieldGet(this, _OS_root_proc, "f");
        }
        const sandbox = new Sandbox(script);
        let proc = new OS_Process(name, this, parent, sandbox.env());
        __classPrivateFieldGet(this, _OS_perms, "f").set(proc, __classPrivateFieldGet(this, _OS_perms, "f").get(parent));
        __classPrivateFieldGet(this, _OS_scripts, "f").set(proc, sandbox);
        __classPrivateFieldGet(this, _OS_processes, "f").push(proc);
        return proc;
    }
    createWindow(x, y, width, height, name, process) {
        let id = Math.random().toString(36).substring(2, 15);
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
        let window = new OS_Window(x, y, width, height, name, this, process, body.contentDocument);
        __classPrivateFieldGet(this, _OS_windows, "f").push(window);
        __classPrivateFieldGet(this, _OS_window_htmls, "f").set(window, div);
        return window;
    }
    getPermissions(proc) {
        if (__classPrivateFieldGet(this, _OS_perms, "f").has(proc)) {
            return __classPrivateFieldGet(this, _OS_perms, "f").get(proc);
        }
        return null;
    }
    decodePermID(perm) {
        return (1 << perm);
    }
    killProcess(proc) {
        let kp = this.killProcess;
        let kw = this.closeWindow;
        function recursive(v) {
            if (v instanceof OS_Process) {
                kp(v);
            }
            else if (v instanceof OS_Window) {
                kw(v);
            }
        }
        __classPrivateFieldGet(this, _OS_parents, "f").get(proc)?.forEach(recursive);
        __classPrivateFieldGet(this, _OS_scripts, "f").delete(proc);
    }
    requestPermissions(proc, n) {
        let permName = Permission[n];
        if (!permName || !__classPrivateFieldGet(this, _OS_perms, "f").has(proc)) {
            return;
        }
        let y = confirm("Do you want to give a app this permission:\n" + permName);
        if (y) {
            let perms = __classPrivateFieldGet(this, _OS_perms, "f").get(proc);
            __classPrivateFieldGet(this, _OS_perms, "f").set(proc, perms + n);
        }
    }
    closeWindow(obj) {
        let elem = __classPrivateFieldGet(this, _OS_window_htmls, "f").get(obj);
        elem.remove();
        let i = __classPrivateFieldGet(this, _OS_windows, "f").indexOf(obj);
        __classPrivateFieldGet(this, _OS_windows, "f").splice(i, 1);
    }
    updatePosition(obj, x, y) { }
    updateSize(obj, width, height) { }
    // TEMP CODE BELOW desktop not done
    getDesktop() {
        return {
            focusWindow(obj) { }
        };
    }
} // NOT FINISHED
_OS_processes = new WeakMap(), _OS_windows = new WeakMap(), _OS_parents = new WeakMap(), _OS_perms = new WeakMap(), _OS_scripts = new WeakMap(), _OS_window_htmls = new WeakMap(), _OS_lastPID = new WeakMap(), _OS_root_proc = new WeakMap();
class FS {
    constructor() {
        this.files = { "apps": {} };
        this._saveTimeout = null;
    }
    save() {
        try {
            localStorage.setItem("fs", JSON.stringify(this.files));
        }
        catch (error) {
            console.error("Failed to save to localStorage:", error);
        }
    }
    static load(data) {
        const fs = new FS();
        try {
            if (data) {
                fs.files = JSON.parse(data);
            }
        }
        catch (error) {
            console.error("Failed to load from localStorage:", error);
        }
        return fs;
    }
    write(path, data) {
        let path_arr = path.split("/");
        let folder = this.files;
        for (let i = 0; i < path.length - 1; i++) {
            if (!folder[path_arr[i]]) {
                folder[path_arr[i]] = {};
            }
            folder = folder[path_arr[i]];
        }
        folder[path_arr[path_arr.length - 1]] = data;
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
        ;
        this._saveTimeout = setTimeout(() => {
            this.save();
        }, 250); // Save after 250ms of not writing
    }
    path_exists(path) {
        let path_arr = path.split("/");
        let folder = this.files;
        for (let i = 0; i < path_arr.length; i++) {
            if (!folder[path_arr[i]]) {
                return false;
            }
            folder = folder[path_arr[i]];
        }
        return true;
    }
    read(path) {
        if (path === "") {
            return this.files;
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
    constructor(script) {
        _Sandbox_element.set(this, void 0);
        __classPrivateFieldSet(this, _Sandbox_element, document.createElement("iframe"), "f");
        __classPrivateFieldGet(this, _Sandbox_element, "f").sandbox.add("allow-scripts");
        __classPrivateFieldGet(this, _Sandbox_element, "f").style.width = "0px";
        __classPrivateFieldGet(this, _Sandbox_element, "f").style.height = "0px";
        __classPrivateFieldGet(this, _Sandbox_element, "f").style.border = "none";
        __classPrivateFieldGet(this, _Sandbox_element, "f").srcdoc = "<script>" + script + "</script>";
        let w = this.env();
        let dummy = (...a) => { return () => { }; };
        w.alert = dummy();
        w.confirm = dummy();
        w.prompt = dummy();
        // @ts-ignore
        w.cookieStore = {}; // @ts-ignore
        w.indexedDB = {}; // @ts-ignore
        w.document = {};
    }
    env() {
        return __classPrivateFieldGet(this, _Sandbox_element, "f").contentWindow;
    }
    destroy() {
        __classPrivateFieldGet(this, _Sandbox_element, "f").remove();
    }
}
_Sandbox_element = new WeakMap();
class OS_Process {
    constructor(name, os, parent = null, scriptenv) {
        _OS_Process_pid.set(this, void 0);
        _OS_Process_name.set(this, void 0);
        _OS_Process_os.set(this, void 0);
        _OS_Process_parent.set(this, void 0);
        _OS_Process_scriptenv.set(this, void 0);
        this.children = [];
        this.ipcs = [];
        __classPrivateFieldSet(this, _OS_Process_pid, os.getNewPID(), "f");
        __classPrivateFieldSet(this, _OS_Process_name, name, "f");
        __classPrivateFieldSet(this, _OS_Process_os, os, "f"); // Reference to the OS instance
        __classPrivateFieldSet(this, _OS_Process_parent, parent, "f");
        __classPrivateFieldSet(this, _OS_Process_scriptenv, scriptenv, "f");
        const w = scriptenv;
        w.fetch = (input, init) => {
            if (this.getPermissions(Permission.NetworkAccess)) {
                return fetch(input, init);
            }
        };
        w.process = this;
    }
    parentData(p) {
        if (p === __classPrivateFieldGet(this, _OS_Process_parent, "f") || p == __classPrivateFieldGet(this, _OS_Process_os, "f")) {
            return {
                scriptenv: __classPrivateFieldGet(this, _OS_Process_scriptenv, "f"),
                name: __classPrivateFieldGet(this, _OS_Process_name, "f"),
                pid: __classPrivateFieldGet(this, _OS_Process_pid, "f")
            };
        }
    }
    getPID() {
        return __classPrivateFieldGet(this, _OS_Process_pid, "f");
    }
    getName() {
        return __classPrivateFieldGet(this, _OS_Process_name, "f");
    }
    getPermissions(type) {
        return ((__classPrivateFieldGet(this, _OS_Process_os, "f").getPermissions(this) || 0) & (1 << type)) !== 0; // Return true if the privilege is granted
    }
    getPermissionsAll() {
        return (__classPrivateFieldGet(this, _OS_Process_os, "f").getPermissions(this) || 0) + 0; // Deref
    }
    async askPermissions(type) {
        await __classPrivateFieldGet(this, _OS_Process_os, "f").requestPermissions(this, (1 << type)); // Request permissions from the OS
        return this.getPermissions(type);
    }
    createChildProcess(name, code) {
        if (this.getPermissions(0)) { // Check for create child process permission
            let child = __classPrivateFieldGet(this, _OS_Process_os, "f").createProcess(name, code, this);
            this.children.push(child);
            return child;
        }
    }
    kill() {
        __classPrivateFieldGet(this, _OS_Process_os, "f").killProcess(this);
        throw new OSError("", OSErrorCode.ProcessKilled);
    }
    getParent() {
        return __classPrivateFieldGet(this, _OS_Process_parent, "f");
    }
    createWindow(x, y, width, height, name) {
        if (this.getPermissions(1)) { // Check for create window permission
            return __classPrivateFieldGet(this, _OS_Process_os, "f").createWindow(x, y, width, height, name, this);
        }
        else {
            console.warn("Permission denied: Cannot create window");
            return null;
        }
    }
}
_OS_Process_pid = new WeakMap(), _OS_Process_name = new WeakMap(), _OS_Process_os = new WeakMap(), _OS_Process_parent = new WeakMap(), _OS_Process_scriptenv = new WeakMap();
class OS_Window {
    constructor(x, y, width, height, name, os, parent = null, doc) {
        _OS_Window_instances.add(this);
        _OS_Window_x.set(this, void 0);
        _OS_Window_y.set(this, void 0);
        _OS_Window_width.set(this, void 0);
        _OS_Window_height.set(this, void 0);
        _OS_Window_name.set(this, void 0);
        _OS_Window_isDragging.set(this, void 0);
        _OS_Window_isResizing.set(this, void 0);
        _OS_Window_os.set(this, void 0);
        _OS_Window_body.set(this, void 0);
        _OS_Window_parent.set(this, void 0);
        _OS_Window_draggingOffset.set(this, void 0);
        this.children = [];
        __classPrivateFieldSet(this, _OS_Window_x, x, "f");
        __classPrivateFieldSet(this, _OS_Window_y, y, "f");
        __classPrivateFieldSet(this, _OS_Window_width, width, "f");
        __classPrivateFieldSet(this, _OS_Window_height, height, "f");
        __classPrivateFieldSet(this, _OS_Window_name, name, "f");
        __classPrivateFieldSet(this, _OS_Window_isDragging, false, "f");
        __classPrivateFieldSet(this, _OS_Window_isResizing, false, "f");
        __classPrivateFieldSet(this, _OS_Window_draggingOffset, { x: 0, y: 0 }, "f");
        __classPrivateFieldSet(this, _OS_Window_parent, parent, "f");
        __classPrivateFieldSet(this, _OS_Window_os, os, "f"); // Reference to the OS instance
        __classPrivateFieldSet(this, _OS_Window_body, doc, "f");
        __classPrivateFieldGet(this, _OS_Window_instances, "m", _OS_Window_focus).call(this);
    }
    parentData(p) {
        if (p === __classPrivateFieldGet(this, _OS_Window_parent, "f") || p === __classPrivateFieldGet(this, _OS_Window_os, "f")) {
            return {
                body: __classPrivateFieldGet(this, _OS_Window_body, "f")
            };
        }
    }
    addHtml(html) {
        const body = __classPrivateFieldGet(this, _OS_Window_instances, "m", _OS_Window_getBody).call(this);
        if (body) {
            body.body.appendChild(html);
        }
    }
    getPermissionsAll() {
        return __classPrivateFieldGet(this, _OS_Window_os, "f").getPermissions(this) + 0;
    }
    getPermissions(type) {
        return (__classPrivateFieldGet(this, _OS_Window_os, "f").getPermissions(this) & (1 << type)) !== 0; // Return true if the privilege is granted
    }
    async askPermissions(type) {
        await __classPrivateFieldGet(this, _OS_Window_os, "f").requestPermissions(this, (1 << type)); // Request permissions from the OS
        return this.getPermissions(type);
    }
    setPosition(x, y) {
        if (this.getPermissions(2)) { // Check for position permission
            __classPrivateFieldSet(this, _OS_Window_x, x, "f");
            __classPrivateFieldSet(this, _OS_Window_y, y, "f");
            __classPrivateFieldGet(this, _OS_Window_os, "f").updatePosition(this, __classPrivateFieldGet(this, _OS_Window_x, "f"), __classPrivateFieldGet(this, _OS_Window_y, "f"));
        }
        else {
            console.warn("Permission denied: Cannot set position");
        }
    }
    setSize(width, height) {
        if (this.getPermissions(3)) { // Check for size permission
            __classPrivateFieldSet(this, _OS_Window_width, width, "f");
            __classPrivateFieldSet(this, _OS_Window_height, height, "f");
            __classPrivateFieldGet(this, _OS_Window_os, "f").updateSize(this, __classPrivateFieldGet(this, _OS_Window_width, "f"), __classPrivateFieldGet(this, _OS_Window_height, "f"));
        }
        else {
            console.warn("Permission denied: Cannot set size");
        }
    }
    createChildWindow(x, y, width, height, name) {
        if (this.getPermissions(0) && this.getPermissions(1)) { // Check for create child window permissions (process and window)
            let child = __classPrivateFieldGet(this, _OS_Window_os, "f").createWindow(x, y, width, height, name, __classPrivateFieldGet(this, _OS_Window_parent, "f"));
            if (!child) {
                console.warn("Failed to create child window");
                return null;
            }
            this.children.push(child);
            return child;
        }
        else {
            console.warn("Permission denied: Cannot create child window");
            return null;
        }
    }
    close() {
        __classPrivateFieldGet(this, _OS_Window_os, "f").closeWindow(this);
    }
    focus() {
        if (this.getPermissions(4)) { // Check for force focus permission
            __classPrivateFieldGet(this, _OS_Window_instances, "m", _OS_Window_focus).call(this);
        }
        else {
            console.warn("Permission denied: Cannot focus window");
        }
    }
}
_OS_Window_x = new WeakMap(), _OS_Window_y = new WeakMap(), _OS_Window_width = new WeakMap(), _OS_Window_height = new WeakMap(), _OS_Window_name = new WeakMap(), _OS_Window_isDragging = new WeakMap(), _OS_Window_isResizing = new WeakMap(), _OS_Window_os = new WeakMap(), _OS_Window_body = new WeakMap(), _OS_Window_parent = new WeakMap(), _OS_Window_draggingOffset = new WeakMap(), _OS_Window_instances = new WeakSet(), _OS_Window_getBody = function _OS_Window_getBody() {
    return __classPrivateFieldGet(this, _OS_Window_body, "f");
}, _OS_Window_focus = function _OS_Window_focus() {
    __classPrivateFieldGet(this, _OS_Window_os, "f").getDesktop().focusWindow(this);
};
class IPC {
    constructor() {
        _IPC_queueA.set(this, []);
        _IPC_queueB.set(this, []);
    }
    a_wrapper() {
        let send = (data) => { __classPrivateFieldGet(this, _IPC_queueB, "f").push(data); };
        let recv = () => { return __classPrivateFieldGet(this, _IPC_queueA, "f").shift(); };
        return { send, recv };
    }
    b_wrapper() {
        let send = (data) => { __classPrivateFieldGet(this, _IPC_queueA, "f").push(data); };
        let recv = () => { return __classPrivateFieldGet(this, _IPC_queueB, "f").shift(); };
        return { send, recv };
    }
}
_IPC_queueA = new WeakMap(), _IPC_queueB = new WeakMap();
export default { Permission, OSErrorCode, OSError, OS, FS, OS_Process, OS_Window, IPC };
