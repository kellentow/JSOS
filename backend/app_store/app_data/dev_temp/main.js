class FileExplorer extends Window {
    constructor(x, y, width, height, screenid, fs) {
        super(x, y, width, height, "File Explorer", screenid);
        this.fs = fs;
        this.cwd = [];         // start in root "apps" folder
        this.items = [];
        this.selectedIndex = 0;

        // handle clicks inside the window
        this._onClick = this._click.bind(this);
        document.addEventListener("click", this._onClick);
        this.refresh();
    }

    // get current path string
    path() {
        return this.cwd.join("/");
    }

    // read directory entries
    readDir() {
        const dir = this.fs.read(this.path());
        if (!dir || typeof dir !== 'object') return [];
        // list keys, mark folders vs files
        return Object.keys(dir).map(name => ({
            name,
            isDir: typeof dir[name] === 'object'
        })).sort((a,b) => a.isDir === b.isDir ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));
    }

    // refresh contents
    refresh() {
        this.items = this.readDir();
        if (this.cwd.length > 0) {
            this.items.unshift({ name: "..", isDir: true }); // add ".." to go down a directory
            this.draw();
            return; // no items
        }
        this.selectedIndex = 0;
        this.draw();
    }

    // override draw to include file list
    draw() {
        super.draw();
        const startX = this.x + 10;
        const startY = this.y + 50;
        const lineHeight = 15;

        // draw each item
        screen.color(pallete.Window_Title_Text, this.screenid);
        screen.text.change_font("Arial", "10px", this.screenid);
        screen.draw.text(this.x + 10, this.y + 35, "/" + this.cwd.join("/"), this.screenid);
        screen.text.change_font("15px", "Arial", this.screenid);
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const y = startY + i * (lineHeight+2);
            // highlight selected
            if (i === this.selectedIndex) {
                screen.color(pallete.Main_Accent1, this.screenid);
                screen.draw.rectangle(startX - 2, y - 12, this.width - 20, lineHeight, this.screenid);
            }
            // icon
            screen.color(pallete.Window_Title_Text, this.screenid);
            const icon = item.isDir ? "📁" : "📄";
            screen.draw.text(startX, y, icon + " " + item.name, this.screenid);
        }
    }

    // click handling
    _click(x,y,detail) {
        // check inside content area
        if (x < 8 || x > this.width - 8 || y > this.height - 8) return;
        const index = Math.floor((y - 40) / 17);
        if (index < 0 || index >= this.items.length) return;
        this.selectedIndex = index;
        const item = this.items[index];
        if (detail === 2) {
            // double click: open dir or open file
            if (item.isDir) {
                if (item.name == "..") {
                    // go up a directory
                    this.cwd.pop();
                    this.refresh();
                    return;
                }
                // open directory: read and refresh
                this.cwd.push(item.name);
                this.refresh();
            } else {
                // open file: read and alert JSON
                const content = this.fs.read(this.path() + "/" + item.name);
                console.log("Open file", item.name, content);
                // you could spawn a text editor here
            }
        }
        gui_refresh();
    }

    // clean up
    kill() {
        super.kill();
        document.removeEventListener("click", this._onClick);
    }
}

windows.push(new FileExplorer(50, 50, 300, 200, "screen1",window.fs));
