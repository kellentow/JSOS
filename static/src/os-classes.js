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
var _OS_processes, _OS_processKeys, _OS_parents, _OS_perms, _OS_scripts, _OS_lastPID, _OS_root_proc, _Sandbox_element, _Sandbox_name, _OS_Process_pid, _OS_Process_name, _OS_Process_os, _OS_Process_parent, _OS_Process_scriptenv, _OS_Process_key, _IPC_queueA, _IPC_queueB;
function waitForNonNull(getValue, interval = 50) {
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
var Permission;
(function (Permission) {
    Permission[Permission["CreateProcess"] = 1] = "CreateProcess";
    Permission[Permission["UseFilesystem"] = 2] = "UseFilesystem";
    Permission[Permission["NetworkAccess"] = 4] = "NetworkAccess";
    Permission[Permission["ExecuteCode"] = 8] = "ExecuteCode";
    Permission[Permission["EditDom"] = 16] = "EditDom";
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
class ProcessKey {
}
class OS {
    constructor() {
        _OS_processes.set(this, []);
        _OS_processKeys.set(this, new Map());
        _OS_parents.set(this, new Map());
        _OS_perms.set(this, new Map());
        _OS_scripts.set(this, new Map());
        _OS_lastPID.set(this, 0);
        _OS_root_proc.set(this, void 0);
        __classPrivateFieldSet(this, _OS_root_proc, new OS_Process("root", this, null, { overrideEnv: (...args) => { } }), "f");
        __classPrivateFieldGet(this, _OS_perms, "f").set(__classPrivateFieldGet(this, _OS_root_proc, "f"), 31);
        __classPrivateFieldGet(this, _OS_processes, "f").push(__classPrivateFieldGet(this, _OS_root_proc, "f"));
        __classPrivateFieldGet(this, _OS_processKeys, "f").set(__classPrivateFieldGet(this, _OS_root_proc, "f").getKey(), __classPrivateFieldGet(this, _OS_root_proc, "f"));
        __classPrivateFieldGet(this, _OS_parents, "f").set(__classPrivateFieldGet(this, _OS_root_proc, "f"), []);
    }
    getRootProc() {
        return __classPrivateFieldGet(this, _OS_root_proc, "f");
    }
    getNewPID() {
        __classPrivateFieldSet(this, _OS_lastPID, __classPrivateFieldGet(this, _OS_lastPID, "f") + 1, "f");
        return __classPrivateFieldGet(this, _OS_lastPID, "f");
    }
    async createProcess(parentKey, name, script) {
        if (!__classPrivateFieldGet(this, _OS_processKeys, "f").has(parentKey)) {
            return;
        }
        const sandbox = new Sandbox(script, name, {});
        await waitForNonNull(() => sandbox.env(), 50);
        let parent = __classPrivateFieldGet(this, _OS_processKeys, "f").get(parentKey);
        let proc = new OS_Process(name, this, parent, sandbox);
        let key = proc.getKey();
        __classPrivateFieldGet(this, _OS_processKeys, "f").set(key, proc);
        sandbox.overrideEnv({
            os: this,
            IPCs: [],
            parent_doc: () => {
                if (!__classPrivateFieldGet(this, _OS_perms, "f").has(proc)) {
                    return;
                }
                if ((__classPrivateFieldGet(this, _OS_perms, "f").get(proc) & Permission.EditDom) !== 0) {
                    return document;
                }
                else {
                    return undefined;
                }
            },
            proc
        });
        __classPrivateFieldGet(this, _OS_perms, "f").set(proc, __classPrivateFieldGet(this, _OS_perms, "f").get(parent));
        __classPrivateFieldGet(this, _OS_parents, "f").get(parent)?.push(proc);
        __classPrivateFieldGet(this, _OS_scripts, "f").set(proc, sandbox);
        __classPrivateFieldGet(this, _OS_processes, "f").push(proc);
        sandbox.load();
        return proc;
    }
    createIPC(self, target) {
        let self_sand = __classPrivateFieldGet(this, _OS_scripts, "f").get(self);
        let target_sand = __classPrivateFieldGet(this, _OS_scripts, "f").get(target);
        let ipc = new IPC();
        //@ts-ignore
        target_sand?.env().IPCs.push(ipc.b_wrapper());
        //@ts-ignore
        self_sand?.env().IPCs.push(ipc.a_wrapper());
        //return ipc
    }
    getPermissions(key) {
        let proc;
        if (__classPrivateFieldGet(this, _OS_processKeys, "f").has(key)) {
            proc = __classPrivateFieldGet(this, _OS_processKeys, "f").get(key);
        }
        else {
            return null;
        }
        if (__classPrivateFieldGet(this, _OS_perms, "f").has(proc)) {
            return __classPrivateFieldGet(this, _OS_perms, "f").get(proc);
        }
        return null;
    }
    killProcess(key) {
        let proc;
        if (__classPrivateFieldGet(this, _OS_processKeys, "f").has(key)) {
            proc = __classPrivateFieldGet(this, _OS_processKeys, "f").get(key);
        }
        else {
            return null;
        }
        let kp = this.killProcess;
        function recursive(v) {
            kp(v);
        }
        __classPrivateFieldGet(this, _OS_parents, "f").get(proc)?.forEach(recursive);
        __classPrivateFieldGet(this, _OS_scripts, "f").delete(proc);
    }
    requestPermissions(key, n, reason) {
        let proc;
        if (__classPrivateFieldGet(this, _OS_processKeys, "f").has(key)) {
            proc = __classPrivateFieldGet(this, _OS_processKeys, "f").get(key);
        }
        else {
            return null;
        }
        let permName = Permission[n];
        if (!permName || !__classPrivateFieldGet(this, _OS_perms, "f").has(proc)) {
            return;
        }
        let y = confirm(`Do you want to give "${proc.getName()}" this permission:\n${permName}\nReason: "${reason}"`);
        if (y) {
            let perms = __classPrivateFieldGet(this, _OS_perms, "f").get(proc);
            __classPrivateFieldGet(this, _OS_perms, "f").set(proc, perms | n);
        }
    }
} // NOT FINISHED
_OS_processes = new WeakMap(), _OS_processKeys = new WeakMap(), _OS_parents = new WeakMap(), _OS_perms = new WeakMap(), _OS_scripts = new WeakMap(), _OS_lastPID = new WeakMap(), _OS_root_proc = new WeakMap();
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
        for (let i = 0; i < path_arr.length - 1; i++) {
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
    constructor(script, name, override) {
        _Sandbox_element.set(this, void 0);
        _Sandbox_name.set(this, void 0);
        __classPrivateFieldSet(this, _Sandbox_name, name || "UNKNOWN", "f");
        __classPrivateFieldSet(this, _Sandbox_element, document.createElement("iframe"), "f");
        __classPrivateFieldGet(this, _Sandbox_element, "f").setAttribute("sandbox", "allow-scripts allow-same-origin");
        __classPrivateFieldGet(this, _Sandbox_element, "f").style.width = "0px";
        __classPrivateFieldGet(this, _Sandbox_element, "f").style.height = "0px";
        __classPrivateFieldGet(this, _Sandbox_element, "f").style.border = "none";
        __classPrivateFieldGet(this, _Sandbox_element, "f").srcdoc = "<script>" + script + "</script>";
        let dummy = (...a) => { return () => { }; };
        const good_console = globalThis.console;
        let windowConsole = {
            ...good_console,
            debug: (...args) => { good_console.debug(`[${__classPrivateFieldGet(this, _Sandbox_name, "f")}] `, ...args); },
            log: (...args) => { good_console.log(`[${__classPrivateFieldGet(this, _Sandbox_name, "f")}] `, ...args); },
            warn: (...args) => { good_console.warn(`[${__classPrivateFieldGet(this, _Sandbox_name, "f")}] `, ...args); },
            error: (...args) => { good_console.error(`[${__classPrivateFieldGet(this, _Sandbox_name, "f")}] `, ...args); }
        };
        this.overrideEnv({
            alert: dummy(),
            confirm: dummy(),
            prompt: dummy(), // @ts-ignore
            cookieStore: {}, // @ts-ignore
            indexedDB: {}, // @ts-ignore
            document: {},
            console: windowConsole,
            ...override
        });
        document.body.appendChild(__classPrivateFieldGet(this, _Sandbox_element, "f"));
    }
    env() {
        return __classPrivateFieldGet(this, _Sandbox_element, "f").contentWindow;
    }
    overrideEnv(override) {
        const w = this.env();
        if (w) {
            for (let key in override) {
                try {
                    // @ts-ignore
                    w[key] = override[key];
                }
                catch {
                    console.error(`[Sandbox Manager] Failed to overwrite ${key} on ${__classPrivateFieldGet(this, _Sandbox_name, "f")}`);
                }
            }
        }
        else {
            __classPrivateFieldGet(this, _Sandbox_element, "f").addEventListener("load", () => this.overrideEnv(override), { once: true });
        }
    }
    load() {
        const event = new CustomEvent("os-load");
        console.log(`[Sandbox Manager] Loading ${__classPrivateFieldGet(this, _Sandbox_name, "f")}`);
        this.env().document.dispatchEvent(event);
    }
    destroy() {
        __classPrivateFieldGet(this, _Sandbox_element, "f").remove();
    }
}
_Sandbox_element = new WeakMap(), _Sandbox_name = new WeakMap();
class OS_Process {
    constructor(name, os, parent = null, sandbox) {
        _OS_Process_pid.set(this, void 0);
        _OS_Process_name.set(this, void 0);
        _OS_Process_os.set(this, void 0);
        _OS_Process_parent.set(this, void 0);
        _OS_Process_scriptenv.set(this, void 0);
        _OS_Process_key.set(this, void 0);
        this.children = [];
        __classPrivateFieldSet(this, _OS_Process_pid, os.getNewPID(), "f");
        __classPrivateFieldSet(this, _OS_Process_name, name, "f");
        __classPrivateFieldSet(this, _OS_Process_os, os, "f"); // Reference to the OS instance
        __classPrivateFieldSet(this, _OS_Process_parent, parent, "f");
        __classPrivateFieldSet(this, _OS_Process_scriptenv, sandbox, "f");
        __classPrivateFieldSet(this, _OS_Process_key, new ProcessKey(), "f");
        sandbox.overrideEnv({
            fetch: async (input, init) => {
                if (this.getPermissions(Permission.NetworkAccess)) {
                    return await fetch(input, init);
                }
                return new Response(undefined, { status: 403 });
            },
            prockey: __classPrivateFieldGet(this, _OS_Process_key, "f"),
        });
        console.log(__classPrivateFieldGet(this, _OS_Process_os, "f"));
    }
    getKey() {
        this.getKey = () => { return undefined; };
        return __classPrivateFieldGet(this, _OS_Process_key, "f");
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
        return ((__classPrivateFieldGet(this, _OS_Process_os, "f").getPermissions(__classPrivateFieldGet(this, _OS_Process_key, "f")) || 0) & (1 << type)) !== 0; // Return true if the privilege is granted
    }
    getPermissionsAll() {
        return (__classPrivateFieldGet(this, _OS_Process_os, "f").getPermissions(__classPrivateFieldGet(this, _OS_Process_key, "f")) || 0) + 0; // Deref
    }
    async askPermissions(type, reason) {
        if (this.getPermissions(type)) {
            return true;
        }
        await __classPrivateFieldGet(this, _OS_Process_os, "f").requestPermissions(__classPrivateFieldGet(this, _OS_Process_key, "f"), (type), reason); // Request permissions from the OS
        return this.getPermissions(type);
    }
    async createChildProcess(name, code) {
        if (this.getPermissions(1)) { // Check for create child process permission
            let child = await __classPrivateFieldGet(this, _OS_Process_os, "f").createProcess(__classPrivateFieldGet(this, _OS_Process_key, "f"), name, code);
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
}
_OS_Process_pid = new WeakMap(), _OS_Process_name = new WeakMap(), _OS_Process_os = new WeakMap(), _OS_Process_parent = new WeakMap(), _OS_Process_scriptenv = new WeakMap(), _OS_Process_key = new WeakMap();
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
export { Permission, OSErrorCode, OSError, OS, FS, OS_Process, IPC, ProcessKey };
