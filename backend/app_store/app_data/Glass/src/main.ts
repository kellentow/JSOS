interface Window {
    parent_doc: () => Document | undefined,
    os: any,
    proc: any,
    IPCs: any[],
}

interface GlassWindow {
    id: string;
    element: HTMLElement;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
}

let windows: GlassWindow[] = [];

window.proc.requestPermission(4,"Permission to edit the DOM is required to show windows")
// Glass takes full control of the OS document
// Overwrite global document to point to parent_doc
document = window.parent_doc() as Document;
if (!document) {throw new Error("User refused DOM access")};