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
var _GWindow_id;
//@ts-expect-error
let glass_ipc = undefined;
let info = { sc: { x: 0, y: 0, width: 0, height: 0 }, windows: [] };
function waitForDefined(getValue, interval = 50, timeout) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        let id;
        const check = () => {
            try {
                const value = getValue();
                if (value !== undefined) {
                    if (id !== undefined)
                        clearInterval(id);
                    resolve(value);
                    return true;
                }
                if (timeout != null && Date.now() - start > timeout) {
                    if (id !== undefined)
                        clearInterval(id);
                    reject(new Error("waitForDefined: timeout"));
                    return true;
                }
            }
            catch (err) {
                if (id !== undefined)
                    clearInterval(id);
                reject(err);
                return true;
            }
            return false;
        };
        // immediate check
        if (check())
            return;
        id = setInterval(() => {
            check();
        }, interval);
    });
}
class GWindow {
    constructor(on_load) {
        _GWindow_id.set(this, void 0);
        if (glass_ipc === undefined)
            throw Error("tried to summon a window before could communicate with glass");
        glass_ipc.send({ type: "new" });
        __classPrivateFieldSet(this, _GWindow_id, "", "f");
        this.document = document; //gets replaced after glass gives us a document
        waitForDefined(() => { return glass_ipc.recv(); }).then((msg) => {
            if (!msg || msg.type != "new") {
                throw Error("Glass sent unexpected message");
            }
            this.document = msg.document;
            __classPrivateFieldSet(this, _GWindow_id, msg.id, "f");
            if (on_load)
                on_load();
        });
    }
    move(x, y, z) {
        let this_window_info = info.windows.find((v) => { return v.id == __classPrivateFieldGet(this, _GWindow_id, "f"); }) || { x: 0, y: 0, width: 0, height: 0, z: 0, id: 0 };
        x = x !== undefined ? x : this_window_info.x;
        y = y !== undefined ? y : this_window_info.y;
        z = z !== undefined ? z : this_window_info.z;
        glass_ipc.send({ type: "pos", target: __classPrivateFieldGet(this, _GWindow_id, "f"), x, y, z });
    }
    scale(width, height) {
        let this_window_info = info.windows.find((v) => { return v.id == __classPrivateFieldGet(this, _GWindow_id, "f"); }) || { x: 0, y: 0, width: 0, height: 0, z: 0, id: 0 };
        width = width !== undefined ? width : this_window_info.width;
        height = height !== undefined ? height : this_window_info.height;
        glass_ipc.send({ type: "size", target: __classPrivateFieldGet(this, _GWindow_id, "f"), width, height });
    }
}
_GWindow_id = new WeakMap();
function update(Gwindow) {
    glass_ipc.send({ type: "info" });
    let msg = glass_ipc.recv();
    while (msg !== undefined) {
        if (msg.type == "info") {
            info = msg;
        }
        msg = glass_ipc.recv();
    }
    Gwindow.move(0, 0, 0);
    Gwindow.scale(info.sc.width, info.sc.height);
    requestAnimationFrame(() => { update(Gwindow); });
}
document.addEventListener("os-load", async () => {
    let process = window.proc;
    let os = window.os;
    let fs = window.fs();
    let root = os.getRootProc();
    let glass = undefined;
    for (var i = 0; i < root.children.length; i++) {
        if (root.children[i].getName() == "Glass") {
            glass = root.children[i];
        }
    }
    if (glass === undefined)
        throw Error("Could not find Glass");
    os.createIPC(process, glass);
    glass_ipc = window.IPCs[0];
    let Gwindow = new GWindow(() => {
        update(Gwindow);
        let fd = fs.open("/apps/glasstop/index.html");
        let bytes = [];
        if (fd) {
            let out = fd.read();
            while (out !== null) {
                bytes.push(out);
                out = fd.read();
            }
        }
        Gwindow.document.documentElement.innerHTML = new TextDecoder().decode(new Uint8Array(bytes));
        let boot_anim = Gwindow.document.getElementById("boot_anim");
        setTimeout(() => {
            boot_anim.classList.add("fill");
        }, 1000);
        setTimeout(() => {
            const diagonal = Math.sqrt(window.innerWidth ** 2 +
                window.innerHeight ** 2);
            const scale = diagonal / 50;
            boot_anim.style.transform = `scale(${scale})`;
            boot_anim.style.opacity = "0";
        }, 2250);
        setTimeout(() => {
            //boot_anim.remove()
        }, 3500);
    });
});
export {};
