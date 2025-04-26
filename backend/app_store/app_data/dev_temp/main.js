//remove boot app store
for (let i = 0; i < windows.length; i++) {
    if (windows[i].name == "App Store") {
        windows[i].kill();
        break;
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
                5,
                this.height / 2,
                "Failed to fetch app list\\nAre you online?",
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
                        "An error occurred while getting the app list:\\n" +
                        this.getErrorMessage(appErr)
                    );
                    return;
                }
            }
            this.appList = pre_applist;
            this.FLAG_redraw = true;
        } catch (err) {
            console.error("Failed to fetch app list", err);
            this.displayError(
                "An error occurred while getting the app list:\\n" +
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
        screen.draw.text(5, this.height / 2, message, this.screenid);
    }

    addApp(app) {
        this.appList.push(app);
    }

    async download(appid) {
        console.debug("Downloading and installing app: " + appid);

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

        console.info("App installed successfully. Running main.js...");
        let n = 0
        while (!fs.path_exists("apps/" + appid + "/main.js")) {
            if (n > 10) {
                console.error("main.js not found in the app package");
                return
            }
            n++
            console.info("Waiting for main.js to be downloaded...");
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        const mainScript = fs.read("apps/" + appid + "/main.js");
        if (mainScript != null || mainScript != undefined) {
            eval(mainScript); // Execute the main.js script
        }
        this.FLAG_redraw = true;
    }

    _scroll(x, y) {
        this.scroll = this.scroll + y * 3
        if (this.scroll >= this.appList.length * 40) {
            this.scroll -= (this.scroll - this.appList.length * 40) / 5
        } else if (this.scroll < 0) {
            this.scroll += (-this.scroll) / 5
        }
    }

    _click(x, y, detail) {
        this.FLAG_redraw = true;
        if (this.screen == -1) {
            var i = Math.floor((y - 30) / 40)
            this.screen = i
        } else {
            var app = this.appList[this.screen]
            if (point_in_rect(x, y, this.width - 30, 30, 20, 20)) {
                this.screen = -1
            } else if (point_in_rect(x, y, 6, this.height - 23, this.width - 12, 20)) {
                window.open(app.license_url)
            } else if (point_in_rect(x, y, this.width - 55, 55, 45, 20)) {
                if (!fs.path_exists("apps/"+app.appid+"/main.js")) {
                    this.download(app.appid)
                    fs.write("apps/" + app.appid + "/version", app.version)
                } else if (req.is_older(app.version,fs.read("apps/" + app.appid + "/version"))) {
                    fs.write("apps/" + app.appid, {}) // Clear the app folder
                    this.download(app.appid) // Download the app again
                    fs.write("apps/" + app.appid + "/version", app.version) // Save the version
                }
            }
        }
    }

    draw() {
        super.draw();
        if (this.screen == -1) {
            if (this.appList.length === 0 || typeof this.appList[0] === "string") {
                screen.color(pallete.Window_Title_Text, this.screenid);
                screen.draw.text(
                    5,
                    this.height / 2,
                    "No apps available",
                    this.screenid
                );
                return;
            }
            this.appList.forEach((app, i) => {
                screen.color(pallete.Window_Title_BG, this.screenid);
                screen.draw.rectangle(
                    4,
                    30 + i * 40,
                    this.width - 8,
                    35,
                    this.screenid
                );
                screen.color(pallete.Window_Title_Text, this.screenid);
                screen.draw.text(6, 45 + i * 40 + this.scroll, app.name, this.screenid);
                var context = screen.getCanvas(this.screenid).getContext("2d");
                context.textAlign = "right";
                screen.draw.text(
                    this.width - 6,
                    60 + i * 40,
                    app.author,
                    this.screenid
                );
                context.textAlign = "left";
                screen.draw.text(
                    6,
                    60 + i * 40,
                    app.version,
                    this.screenid
                );
            });
        } else {
            var app = this.appList[this.screen]
            screen.color(pallete.Window_Title_BG, this.screenid);
            screen.draw.rectangle(
                4,
                24,
                this.width - 8,
                this.height - 28,
                this.screenid
            );

            screen.color(pallete.Window_Title_Close_Outline, this.screenid)
            screen.draw.rectangle(this.width - 30, 30, 20, 20, this.screenid)
            screen.color(pallete.Window_Shadow, this.screenid)
            screen.draw.rectangle(this.width - 29, 31, 18, 18, this.screenid)
            screen.color(pallete.Window_Title_Close_Outline, this.screenid)
            screen.text.font = "25px Arial"
            screen.draw.text(this.width - 33, 46, "←", this.screenid)
            screen.text.font = "15px Arial"

            screen.color(pallete.Window_Title_Close_Outline, this.screenid)
            screen.draw.rectangle(this.width - 55, 55, 45, 20, this.screenid)
            screen.color(pallete.Main_Success, this.screenid)
            screen.draw.rectangle(this.width - 54, 56, 43, 18, this.screenid)
            screen.color(pallete.Window_Title_Close_Outline, this.screenid)
            if (!fs.path_exists("apps/" + app.appid + "/main.js")) {
                screen.draw.text(this.width - 51, 70, "Install", this.screenid)
            } else if (req.is_older(app.version,fs.read("apps/" + app.appid + "/version"))) {
                screen.draw.text(this.width - 51, 70, "Update", this.screenid)
            } else {
                screen.color(pallete.Window_Title_BG, this.screenid)
                screen.draw.rectangle(this.width - 55, 55, 45, 20, this.screenid)
            }
            

            screen.color(pallete.Window_Title_Text, this.screenid);
            screen.draw.text(6, 40, app.name, this.screenid);
            var context = screen.getCanvas(this.screenid).getContext("2d");
            screen.draw.text(
                6,
                55,
                app.author,
                this.screenid
            );
            screen.draw.text(
                6,
                70,
                app.version,
                this.screenid
            );
            screen.text.wrap_text(
                6,
                90,
                this.width - 12,
                app.description,
                this.screenid
            )
            screen.draw.text(
                6,
                this.height - 6,
                app.license,
                this.screenid
            )
        }
    }
}
windows.push(new AppStore(50, 50, 300, 200, "screen1"));