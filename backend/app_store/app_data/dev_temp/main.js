class TaskManager extends Window {
    constructor(x, y, width, height, screenid) {
        super(x, y, width, height, "Task Manager", screenid);
        this.scroll = 0;
    }

    _scroll(x, y) {
        this.scroll += y;   
    }

    _click(x, y, detail) {
        i = Math.round((y - this.scroll+23) / 35);
        console.log("click", x, y, i, detail);
        if (x > this.width - 30 && x < this.width - 5 && detail == 1) {
            if (i >= 0 && i < windows.length) {
                windows[i].kill();
                return;
            }
        }
    }

    draw() {
        super.draw();
        let w = null;

        for (let i = 0; i < windows.length; i++) {
            w = windows[i];
            let y_start = i*35 + this.scroll;
            screen.color(pallete.Window_Title_BG,this.screenid)
            screen.draw.rectangle(3, 23 + y_start, this.width - 6, 30, this.screenid);
            screen.color(pallete.Window_Title_Close_Outline,this.screenid)
            screen.draw.text(3, 43 + y_start, w.name, this.screenid);

            screen.color(pallete.Window_Title_Close_Outline,this.screenid)
            screen.draw.rectangle(this.width - 30, 28 + y_start, 25, 20, this.screenid);
            screen.color(pallete.Window_Title_Close,this.screenid)
            screen.draw.rectangle(this.width - 29, 29 + y_start, 23, 18, this.screenid);
            screen.color(pallete.Window_Title_Close_Outline,this.screenid)
            screen.draw.text(this.width - 28, 43 + y_start, "Kill", this.screenid);
        }
    }
}
windows.push(new TaskManager(50, 50, 300, 200, "screen1"));