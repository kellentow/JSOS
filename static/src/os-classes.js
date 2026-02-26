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
var _OS_processes, _OS_processKeys, _OS_parents, _OS_procAs, _OS_perms, _OS_scripts, _OS_fs, _OS_lastPID, _OS_root_proc, _FSFD_file, _FSFD_ptr, _FSFD_perms, _FS_files, _Sandbox_element, _Sandbox_name, _OS_Process_pid, _OS_Process_name, _OS_Process_os, _OS_Process_parent, _OS_Process_scriptenv, _OS_Process_key, _IPC_queueA, _IPC_queueB;
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
var FSPermission;
(function (FSPermission) {
    FSPermission[FSPermission["r"] = 4] = "r";
    FSPermission[FSPermission["w"] = 2] = "w";
    FSPermission[FSPermission["x"] = 1] = "x";
    FSPermission[FSPermission["rw"] = 6] = "rw";
    FSPermission[FSPermission["wx"] = 3] = "wx";
    FSPermission[FSPermission["rx"] = 5] = "rx";
    FSPermission[FSPermission["rwx"] = 7] = "rwx";
})(FSPermission || (FSPermission = {}));
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
        _OS_procAs.set(this, new Map());
        _OS_perms.set(this, new Map());
        _OS_scripts.set(this, new Map());
        _OS_fs.set(this, FS.load());
        _OS_lastPID.set(this, 0);
        _OS_root_proc.set(this, void 0);
        __classPrivateFieldSet(this, _OS_root_proc, new OS_Process("root", this, null, { overrideEnv: (...args) => { } }), "f");
        __classPrivateFieldGet(this, _OS_perms, "f").set(__classPrivateFieldGet(this, _OS_root_proc, "f"), 31);
        __classPrivateFieldGet(this, _OS_processes, "f").push(__classPrivateFieldGet(this, _OS_root_proc, "f"));
        let getKey = __classPrivateFieldGet(this, _OS_root_proc, "f").getKey; // preserve get key for whatever is creating the OS to run root calls
        __classPrivateFieldGet(this, _OS_processKeys, "f").set(__classPrivateFieldGet(this, _OS_root_proc, "f").getKey(), __classPrivateFieldGet(this, _OS_root_proc, "f"));
        __classPrivateFieldGet(this, _OS_root_proc, "f").getKey = getKey;
        __classPrivateFieldGet(this, _OS_parents, "f").set(__classPrivateFieldGet(this, _OS_root_proc, "f"), []);
        __classPrivateFieldGet(this, _OS_procAs, "f").set(__classPrivateFieldGet(this, _OS_root_proc, "f"), 0);
        __classPrivateFieldGet(this, _OS_fs, "f").save();
    }
    getRootProc() {
        return __classPrivateFieldGet(this, _OS_root_proc, "f");
    }
    // One time use, for the kernel aka the script constructing the OS
    getKernelData() {
        this.getKernelData = () => { return undefined; };
        return {
            root: __classPrivateFieldGet(this, _OS_root_proc, "f"),
            fs: __classPrivateFieldGet(this, _OS_fs, "f")
        };
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
        __classPrivateFieldGet(this, _OS_procAs, "f").set(proc, __classPrivateFieldGet(this, _OS_procAs, "f").get(parent));
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
            fs: () => { return __classPrivateFieldGet(this, _OS_fs, "f").createWrapper(() => { return __classPrivateFieldGet(this, _OS_procAs, "f").get(proc); }); },
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
        for (let child of __classPrivateFieldGet(this, _OS_parents, "f").get(proc) || []) {
            this.killProcess(child.getKey());
        }
        __classPrivateFieldGet(this, _OS_scripts, "f").get(proc)?.destroy();
        __classPrivateFieldGet(this, _OS_scripts, "f").delete(proc);
        __classPrivateFieldGet(this, _OS_processKeys, "f").delete(key);
        __classPrivateFieldSet(this, _OS_processes, __classPrivateFieldGet(this, _OS_processes, "f").filter((v) => v !== proc), "f");
        __classPrivateFieldGet(this, _OS_parents, "f").delete(proc);
        __classPrivateFieldGet(this, _OS_procAs, "f").delete(proc);
    }
    requestPermissions(key, n, reason) {
        let proc;
        if (__classPrivateFieldGet(this, _OS_processKeys, "f").has(key)) {
            proc = __classPrivateFieldGet(this, _OS_processKeys, "f").get(key);
        }
        else {
            return null;
        }
        let permName = Permission[Math.log2(n)];
        if (!permName || !__classPrivateFieldGet(this, _OS_perms, "f").has(proc)) {
            return;
        }
        let y = confirm(`Do you want to give "${proc.getName()}" this permission:\n${permName}\nReason: "${reason}"`);
        if (y) {
            let perms = __classPrivateFieldGet(this, _OS_perms, "f").get(proc);
            __classPrivateFieldGet(this, _OS_perms, "f").set(proc, perms | n);
        }
    }
    isRoot(key) {
        let key_proc = __classPrivateFieldGet(this, _OS_processKeys, "f").get(key);
        if (!key_proc)
            return false;
        //can we trust them? (is pid 0 or uid 0 aka root)
        return key_proc == __classPrivateFieldGet(this, _OS_root_proc, "f") || __classPrivateFieldGet(this, _OS_procAs, "f").get(key_proc) == 0;
    }
    setProcUser(key, target, user) {
        if (this.isRoot(key)) {
            __classPrivateFieldGet(this, _OS_procAs, "f").set(target, user); //ok change user
        }
    }
} // NOT FINISHED
_OS_processes = new WeakMap(), _OS_processKeys = new WeakMap(), _OS_parents = new WeakMap(), _OS_procAs = new WeakMap(), _OS_perms = new WeakMap(), _OS_scripts = new WeakMap(), _OS_fs = new WeakMap(), _OS_lastPID = new WeakMap(), _OS_root_proc = new WeakMap();
class FSNode {
    constructor() {
        this.owner = 0;
        //group: number = 0
        this.perms = 0o755;
        this.type = "Node";
    }
    static deserialize(data) {
        const ctor = this.registry[data.type] ?? this;
        let node = new ctor();
        if (typeof data.owner == "number")
            node.owner = data.owner;
        //if (typeof data.group == "number") node.group = data.group
        if (typeof data.perms == "number")
            node.perms = data.perms;
        if (typeof data.type == "string")
            node.type = data.type;
        return node;
    }
    serialize() {
        return {
            owner: this.owner,
            //group: this.group,
            perms: this.perms,
            type: this.type,
        };
    }
}
FSNode.registry = {};
class FSDir extends FSNode {
    constructor() {
        super(...arguments);
        this.children = {};
        this.type = "Directory";
    }
    static deserialize(data) {
        let directory = super.deserialize(data);
        let children = {};
        Object.keys(data.children).forEach((key) => {
            let child = data.children[key];
            children[key] = (FSNode.registry[child.type] ?? FSNode).deserialize(child);
        });
        directory.children = children;
        return directory;
    }
    serialize() {
        let data = super.serialize();
        let children = {};
        Object.keys(this.children).forEach(key => {
            let child = this.children[key];
            children[key] = child.serialize();
        });
        data.children = children;
        return data;
    }
}
class FSFile extends FSNode {
    constructor() {
        super(...arguments);
        this.type = "File";
        this.contents = new Uint8Array();
    }
    static deserialize(data) {
        let file = super.deserialize(data);
        if (typeof data.contents === "string") {
            const binary = atob(data.contents);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            file.contents = bytes;
        }
        return file;
    }
    serialize() {
        let data = super.serialize();
        let binary = "";
        this.contents.forEach(byte => {
            binary += String.fromCharCode(byte);
        });
        data.contents = btoa(binary);
        return data;
    }
}
FSNode.registry = {
    Node: FSNode,
    Directory: FSDir,
    File: FSFile
};
class FSFD {
    constructor(file, perms) {
        _FSFD_file.set(this, void 0);
        _FSFD_ptr.set(this, 0);
        _FSFD_perms.set(this, 0o0);
        __classPrivateFieldSet(this, _FSFD_file, file, "f");
        __classPrivateFieldSet(this, _FSFD_perms, perms, "f");
    }
    read() {
        var _a, _b;
        if ((__classPrivateFieldGet(this, _FSFD_perms, "f") & FSPermission.r) == 0)
            return null;
        if (__classPrivateFieldGet(this, _FSFD_ptr, "f") >= __classPrivateFieldGet(this, _FSFD_file, "f").contents.length)
            return null;
        return __classPrivateFieldGet(this, _FSFD_file, "f").contents[__classPrivateFieldSet(this, _FSFD_ptr, (_b = __classPrivateFieldGet(this, _FSFD_ptr, "f"), _a = _b++, _b), "f"), _a];
    }
    write(byte) {
        var _a, _b;
        if ((__classPrivateFieldGet(this, _FSFD_perms, "f") & FSPermission.w) == 0)
            return;
        if (__classPrivateFieldGet(this, _FSFD_ptr, "f") >= __classPrivateFieldGet(this, _FSFD_file, "f").contents.length) {
            const newBuf = new Uint8Array(__classPrivateFieldGet(this, _FSFD_ptr, "f") + 1);
            newBuf.set(__classPrivateFieldGet(this, _FSFD_file, "f").contents);
            __classPrivateFieldGet(this, _FSFD_file, "f").contents = newBuf;
        }
        return __classPrivateFieldGet(this, _FSFD_file, "f").contents[__classPrivateFieldSet(this, _FSFD_ptr, (_b = __classPrivateFieldGet(this, _FSFD_ptr, "f"), _a = _b++, _b), "f"), _a] = byte & 0xFF;
    }
    seek(position) {
        if (position < 0)
            position = 0;
        __classPrivateFieldSet(this, _FSFD_ptr, position, "f");
    }
}
_FSFD_file = new WeakMap(), _FSFD_ptr = new WeakMap(), _FSFD_perms = new WeakMap();
class FS {
    constructor() {
        _FS_files.set(this, void 0);
        __classPrivateFieldSet(this, _FS_files, new FSDir(), "f");
        setInterval(() => { this.save(); }, 30 * 1000);
    }
    save() {
        try {
            localStorage.setItem("fs", JSON.stringify(__classPrivateFieldGet(this, _FS_files, "f").serialize()));
        }
        catch (error) {
            console.error("Failed to save to localStorage:", error);
        }
    }
    static load() {
        const fs = new FS();
        const data = localStorage.getItem("fs");
        try {
            if (data) {
                __classPrivateFieldSet(fs, _FS_files, FSDir.deserialize(JSON.parse(data)), "f");
            }
        }
        catch (error) {
            console.error("Failed to load from localStorage:", error);
        }
        return fs;
    }
    parse_path(path) {
        let parts = path.split("/");
        let new_path = [];
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i];
            if (part == "") {
                if (i != parts.length - 1)
                    new_path = [];
            } // ex /home/user// == /
            else if (part == "..") {
                new_path.pop();
            } // ex /home/user/../ == /home/
            else if (part == ".") { }
            else { // ex /home/user/./ == /home/user/
                new_path.push(part);
            }
        }
        return new_path;
    }
    getNode(path) {
        let path_arr = this.parse_path(path);
        let node = __classPrivateFieldGet(this, _FS_files, "f");
        for (let i = 0; i < path_arr.length; i++) {
            if (node.type !== "Directory" || !(node instanceof FSDir))
                return;
            if (!node.children[path_arr[i]]) {
                return undefined;
            }
            node = node.children[path_arr[i]];
        }
        return node;
    }
    dirname(path) {
        const parts = this.parse_path(path).slice(0, -1);
        return parts.length ? "/" + parts.join("/") : "/";
    }
    path_exists(path) {
        return this.getNode(path) !== undefined;
    }
    mkdir(path) {
        let path_arr = this.parse_path(path);
        let parent_path = path_arr.slice(0, -1).join("/");
        let parent = this.getNode(parent_path);
        if (!parent || parent.type !== "Directory")
            return false;
        let last = path_arr[path_arr.length - 1];
        if (parent.children[last])
            return false;
        parent.children[last] = new FSDir();
        return true;
    }
    touch(path) {
        let path_arr = this.parse_path(path);
        let parent_path = path_arr.slice(0, -1).join("/");
        let parent = this.getNode(parent_path);
        if (!parent || parent.type !== "Directory")
            return false;
        let last = path_arr[path_arr.length - 1];
        if (parent.children[last])
            return false;
        parent.children[last] = new FSFile();
        return true;
    }
    getFD(path, perms = 0o0) {
        let file = this.getNode(path);
        if (!file || file.type !== "File")
            return;
        return new FSFD(file, perms);
    }
    getUserPerms(path, uid) {
        if (!this.path_exists(path))
            return;
        let parts = this.parse_path(path);
        let perm = 0o0;
        let node = __classPrivateFieldGet(this, _FS_files, "f");
        for (let i = 0; i < parts.length; i++) {
            perm = node.owner == uid ? (node.perms & 0o700) >> 6 : node.perms & 0o7;
            if ((perm & FSPermission.x) == 0)
                return;
            node = node.children[parts[i]];
        }
        perm = node.owner == uid ? (node.perms & 0o700) >> 6 : node.perms & 0o7;
        return perm;
    }
    createWrapper(uid_solver) {
        return {
            mkdir: (path) => {
                let perm = this.getUserPerms(this.dirname(path), uid_solver());
                if (perm !== undefined && perm & FSPermission.w) {
                    return this.mkdir(path);
                }
                return false;
            },
            touch: (path) => {
                let perm = this.getUserPerms(this.dirname(path), uid_solver());
                if (perm !== undefined && perm & FSPermission.w) {
                    return this.touch(path);
                }
                return false;
            },
            open: (path) => {
                let perm = this.getUserPerms(path, uid_solver());
                if (perm === undefined)
                    return;
                return this.getFD(path, perm);
            }
        };
    }
}
_FS_files = new WeakMap();
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
            prompt: dummy(), //@ts-ignore
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
        if (this.getPermissions(Permission.CreateProcess)) { // Check for create child process permission
            let child = await __classPrivateFieldGet(this, _OS_Process_os, "f").createProcess(__classPrivateFieldGet(this, _OS_Process_key, "f"), name, code);
            this.children.push(child);
            return child;
        }
    }
    kill(key) {
        if (__classPrivateFieldGet(this, _OS_Process_key, "f") == key || __classPrivateFieldGet(this, _OS_Process_os, "f").isRoot(key)) {
            __classPrivateFieldGet(this, _OS_Process_os, "f").killProcess(__classPrivateFieldGet(this, _OS_Process_key, "f"));
        }
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
export { Permission, OSErrorCode, OSError, OS, FS, OS_Process, IPC, ProcessKey, FSPermission };
