try {
    if (req.is_older(req.version, "1.2")) {
        console.error("Version 1.2 or newer is required.");
    }
    req.load("OS-classes", "1.0");
} catch (error) {
    console.error(error);
    throw new Error("req.js loading failed, is it added to the HTML?");
}
req.add("screen.js", "1.4");
req.add("jszip.js", "3.10.1");

class FS {
    constructor() {
        this.files = { "apps": {} }
        this.write("apps/app_store/metadata", {
            "appid": "app_store",
            "name": "App Store",
            "author": "JSOS Dev",
            "version": "1.0",
            "description": "The app store for the OS.",
            "license": "MPL 2.0",
            "license_url": "https://www.mozilla.org/en-US/MPL/2.0/",
            "hash": null
        });
    }

    write(path, data) {
        path = path.split("/")
        let folder = this.files
        for (var i = 0; i < path.length - 1; i++) {
            if (!folder[path[i]]) {
                folder[path[i]] = {}
            }
            folder = folder[path[i]]
        }
        folder[path[path.length-1]] = data
    }

    read(path) {
        const pathParts = path.split("/");
        let folder = this.files;
        for (var i = 0; i < pathParts.length; i++) {
            if (!folder[pathParts[i]]) {
                console.error("File not found: " + pathParts.join("/"));
                return null;
            }
            folder = folder[pathParts[i]];
        }
        return folder;
    }
}

class Window {
    constructor(x, y, width, height, name, screenid) {
        this.x = x;
        this.y = y;
        this.screenid = screenid
        this.width = width;
        this.height = height;
        this.name = name;
        this.isDragging = false;
        this.draggingOffset = { x: 0, y: 0 };

        this._onMouseMove = this.drag.bind(this);
        this._onMouseUp = this.dragEnd.bind(this);
    }

    draw() {
        // Draw window frame
        screen.color(pallete.Window_Border, this.screenid);
        screen.draw.rectangle(this.x, this.y, this.width, this.height, this.screenid);
        screen.color(pallete.Window_Shadow, this.screenid);
        screen.draw.rectangle(
            this.x + 1,
            this.y + 1,
            this.width - 1,
            this.height - 1,
            this.screenid
        );
        screen.color(pallete.Window_BG, this.screenid);
        screen.draw.rectangle(
            this.x + 1,
            this.y + 1,
            this.width - 2,
            this.height - 2,
            this.screenid
        );

        // Draw title bar
        screen.color(pallete.Window_Title_BG, this.screenid);
        screen.draw.rectangle(
            this.x + 3,
            this.y + 3,
            this.width - 6,
            19,
            this.screenid
        );
        screen.color(pallete.Window_Title_Text, this.screenid);
        screen.draw.text(this.x + 5, this.y + 17, this.name, this.screenid);
        screen.color(pallete.Window_Title_Close_Outline, this.screenid)
        screen.draw.rectangle(
            this.x + this.width - 22,
            this.y + 3,
            18,
            18,
            this.screenid
        );
        screen.color(pallete.Window_Title_Close, this.screenid);
        screen.draw.rectangle(
            this.x + this.width - 21,
            this.y + 4,
            16,
            16,
            this.screenid
        );
        screen.color(pallete.Window_Title_Close_Outline, this.screenid);
        screen.draw.text(
            this.x + this.width - 18,
            this.y + 17,
            "X",
            this.screenid
        );
    }

    _scroll(x, y) { } // Placeholder for scroll event

    _click(x, y) { } // Placeholder for click event

    kill() { } // Placeholder for kill method

    move(x, y) {
        this.x = x;
        this.y = y;
        gui_refresh();
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        gui_refresh();
    }

    setTitle(name) {
        this.name = name;
        this.draw(); // Static window rect so just redraw
    }

    dragStart() {
        this.isDragging = true;
        document.addEventListener("mousemove", this._onMouseMove);
        document.addEventListener("mouseup", this._onMouseUp);
    }

    dragEnd() {
        this.isDragging = false;
        document.removeEventListener("mousemove", this._onMouseMove);
        document.removeEventListener("mouseup", this._onMouseUp);
    }

    drag(event) {
        if (this.isDragging) {
            var { x: mouseX, y: mouseY } = html_to_screen(
                event.clientX,
                event.clientY
            );
            this.move(mouseX - this.draggingOffset.x, mouseY - this.draggingOffset.y);
        }
    }

    update() {
        if (this.x > client_display_rect.width - 20) {
            this.x = client_display_rect.width - 20;
        }
        if (this.y > client_display_rect.height - 20) {
            this.y = client_display_rect.height - 20;
        }
        if (this.x < -this.width + 20) {
            this.x = 20 - this.width;
        }
        if (this.y < -this.height + 20) {
            this.y = 20 - this.height;
        }
    }
}

class AppStore extends Window {
    constructor(x, y, width, height, screenid) {
        super(x, y, width, height, "App Store", screenid);
        this.appList = [];
        this.screen = -1
        this.scroll = 0
        if (!navigator.onLine) {
            console.error("No internet connection");
            screen.color(pallete.Main_Error, this.screenid);
            screen.draw.text(
                this.x + 5,
                this.y + this.height / 2,
                "Failed to fetch app list\nAre you online?",
                this.screenid
            );
        }

        this.refresh();
        setInterval(() => this.refresh(), 60000); // every minute
    }

    async refresh() {
        try {
            const csvResponse = await fetch("/backend/app_store/apps.csv");
            if (!csvResponse.ok) throw csvResponse;

            let appIds = (await csvResponse.text()).replace(/"/g, "").split(",");

            const pre_applist = [];

            for (const appid of appIds) {
                try {
                    const appResponse = await fetch(
                        `/backend/app_store/app_data/${appid}`
                    );
                    if (!appResponse.ok) throw appResponse;

                    const appData = await appResponse.json();
                    pre_applist.push(appData);
                } catch (appErr) {
                    console.error("Failed to fetch app", appErr);
                    this.displayError(
                        "An error occurred while getting the app list:\n" +
                        this.getErrorMessage(appErr)
                    );
                    return;
                }
            }
            this.appList = pre_applist;
        } catch (err) {
            console.error("Failed to fetch app list", err);
            this.displayError(
                "An error occurred while getting the app list:\n" +
                this.getErrorMessage(err)
            );
        }
    }
    getErrorMessage(err) {
        if (err instanceof Response) {
            switch (err.status) {
                case 404:
                    return "App Store not found";
                case 500:
                    return "Server error";
                default:
                    return "Unknown error: " + err.status;
            }
        } else if (!navigator.onLine) {
            return "No internet connection";
        }
        return "Unknown error";
    }

    displayError(message) {
        screen.color(pallete.Main_Error, this.screenid);
        screen.draw.text(this.x + 5, this.y + this.height / 2, message, this.screenid);
    }

    addApp(app) {
        this.appList.push(app);
    }

    async download(appid) {
        console.error("Downloading and installing app: " + appid);

        fs = window.fs

        const zipResponse = await fetch("/backend/app_store/download/" + appid);
        if (!zipResponse.ok) throw zipResponse;

        const zip = await JSZip.loadAsync(await zipResponse.arrayBuffer());

        zip.forEach(async function (relativePath, zipEntry) {
            if (!zipEntry.dir) {
                const content = await zipEntry.async("string");
                fs.write("apps/" + appid + "/" + relativePath, content);
            }
        });

        console.log("App installed successfully. Running main.js...");
        var mainScript = fs.read("apps/" + appid + "/main.js");
        let n = 0
        while (mainScript === undefined || mainScript === null) {
            if (n > 10) {
                console.error("main.js not found in the app package");
                return
            }
            n++
            console.log("Waiting for main.js to be downloaded...");
            mainScript = fs.read("apps/" + appid + "/main.js");
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (mainScript != null || mainScript != undefined) {
            eval(mainScript); // Execute the main.js script
        }
    }

    _scroll(x, y) {
        this.scroll = this.scroll + y * 3
        if (this.scroll >= this.appList.length * 40) {
            this.scroll -= (this.scroll - this.appList.length * 40) / 5
        } else if (this.scroll < 0) {
            this.scroll += (-this.scroll) / 5
        }
    }

    _click(x, y) {
        if (this.screen == -1) {
            var i = Math.floor((y - 30) / 40)
            this.screen = i
        } else {
            if (point_in_rect(x, y, this.width - 30, 30, 20, 20)) {
                this.screen = -1
            } else if (point_in_rect(x, y, 6, this.height - 23, this.width - 12, 20)) {
                window.open(this.appList[this.screen].license_url)
            } else if (point_in_rect(x, y, this.width - 55, 55, 45, 20)) {
                this.download(this.appList[this.screen].appid)
            }
        }
    }

    draw() {
        super.draw();
        if (this.screen == -1) {
            if (this.appList.length === 0 || typeof this.appList[0] === "string") {
                screen.color(pallete.Window_Title_Text, this.screenid);
                screen.draw.text(
                    this.x + 5,
                    this.y + this.height / 2,
                    "No apps available",
                    this.screenid
                );
                return;
            }
            this.appList.forEach((app, i) => {
                screen.color(pallete.Window_Title_BG, this.screenid);
                screen.draw.rectangle(
                    this.x + 4,
                    this.y + 30 + i * 40,
                    this.width - 8,
                    35,
                    this.screenid
                );
                screen.color(pallete.Window_Title_Text, this.screenid);
                screen.draw.text(this.x + 6, this.y + 45 + i * 50 + this.scroll, app.name, this.screenid);
                var context = screen.getCanvas(this.screenid).getContext("2d");
                context.textAlign = "right";
                screen.draw.text(
                    this.x + this.width - 6,
                    this.y + 60 + i * 50,
                    app.author,
                    this.screenid
                );
                context.textAlign = "left";
                screen.draw.text(
                    this.x + 6,
                    this.y + 60 + i * 50,
                    app.version,
                    this.screenid
                );
            });
        } else {
            var app = this.appList[this.screen]
            screen.color(pallete.Window_Title_BG, this.screenid);
            screen.draw.rectangle(
                this.x + 4,
                this.y + 24,
                this.width - 8,
                this.height - 28,
                this.screenid
            );

            screen.color(pallete.Window_Title_Close_Outline, this.screenid)
            screen.draw.rectangle(this.x + this.width - 30, this.y + 30, 20, 20, this.screenid)
            screen.color(pallete.Window_Shadow, this.screenid)
            screen.draw.rectangle(this.x + this.width - 29, this.y + 31, 18, 18, this.screenid)
            screen.color(pallete.Window_Title_Close_Outline, this.screenid)
            screen.text.font = "25px Arial"
            screen.draw.text(this.x + this.width - 33, this.y + 46, "←", this.screenid)
            screen.text.font = "15px Arial"

            screen.color(pallete.Window_Title_Close_Outline, this.screenid)
            screen.draw.rectangle(this.x + this.width - 55, this.y + 55, 45, 20, this.screenid)
            screen.color(pallete.Main_Success, this.screenid)
            screen.draw.rectangle(this.x + this.width - 54, this.y + 56, 43, 18, this.screenid)
            screen.color(pallete.Window_Title_Close_Outline, this.screenid)
            screen.draw.text(this.x + this.width - 51, this.y + 70, "Install", this.screenid)

            screen.color(pallete.Window_Title_Text, this.screenid);
            screen.draw.text(this.x + 6, this.y + 40, app.name, this.screenid);
            var context = screen.getCanvas(this.screenid).getContext("2d");
            screen.draw.text(
                this.x + 6,
                this.y + 55,
                app.author,
                this.screenid
            );
            screen.draw.text(
                this.x + 6,
                this.y + 70,
                app.version,
                this.screenid
            );
            screen.text.wrap_text(
                this.x + 6,
                this.y + 90,
                this.width - 12,
                app.description,
                this.screenid
            )
            screen.draw.text(
                this.x + 6,
                this.y + this.height - 6,
                app.license,
                this.screenid
            )
        }
    }
}