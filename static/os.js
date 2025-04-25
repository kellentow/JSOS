// V8 JavaScript or newer
try {
  if (req.is_older(req.version, "1.2")) {
    console.error("Version 1.2 or newer is required.");
  }
  req.load("OS", "0.1");
} catch (error) {
  console.error(error);
  throw new Error("req.js loading failed, is it added to the HTML?");
}

pallete = {
  Main_BG: "#EFEFEF",
  Window_BG: "#D4D4D4",
  Window_Title_BG: "#999999",
  Window_Title_Text: "#1E1E1E",
  Window_Title_Close: "#EE0000",
  Window_Title_Close_Outline: "#111111",
  Window_Border: "#F0F0F0",
  Window_Shadow: "#B0B0B0",
  Main_Accent1: "#5DADE2",
  Main_Accent2: "#F39C12",
  Main_Error: "#E74C3C",
  Main_Success: "#2ECC71",
};

req.add("screen.js", "1.4");

screen.draw.screen(600, 500, "screen1");
windows = [];
client_display_rect = document
  .getElementById("screen1")
  .getBoundingClientRect();

function gui_refresh() {
  screen.clear("screen1");
  screen.color(pallete.Main_BG, "screen1");
  screen.draw.rectangle(
    0,
    0,
    screen.width("screen1", 1),
    screen.height("screen1", 1),
    "screen1"
  );
  windows.forEach((window) => {
    window.draw(); // Draw window frame
    window.update(); // Update window content
  });
}

function screen_to_html(x, y) {
  // Convert screen coordinates to HTML coordinates
  return {
    x: x + client_display_rect.left,
    y: y + client_display_rect.top,
  };
}

function html_to_screen(x, y) {
  // Convert HTML coordinates to screen coordinates
  return {
    x: x - client_display_rect.left,
    y: y - client_display_rect.top,
  };
}

class Window {
  constructor(x, y, width, height, name) {
    this.x = x;
    this.y = y;
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
    screen.color(pallete.Window_Border, "screen1");
    screen.draw.rectangle(this.x, this.y, this.width, this.height, "screen1");
    screen.color(pallete.Window_Shadow, "screen1");
    screen.draw.rectangle(
      this.x + 1,
      this.y + 1,
      this.width - 1,
      this.height - 1,
      "screen1"
    );
    screen.color(pallete.Window_BG, "screen1");
    screen.draw.rectangle(
      this.x + 1,
      this.y + 1,
      this.width - 2,
      this.height - 2,
      "screen1"
    );

    // Draw title bar
    screen.color(pallete.Window_Title_BG, "screen1");
    screen.draw.rectangle(
      this.x + 3,
      this.y + 3,
      this.width - 6,
      19,
      "screen1"
    );
    screen.color(pallete.Window_Title_Text, "screen1");
    screen.draw.text(this.x + 5, this.y + 17, this.name, "screen1");
    screen.color(pallete.Window_Title_Close_Outline, "screen1")
    screen.draw.rectangle(
      this.x + this.width - 22,
      this.y + 3,
      18,
      18,
      "screen1"
    );
    screen.color(pallete.Window_Title_Close, "screen1");
    screen.draw.rectangle(
      this.x + this.width - 21,
      this.y + 4,
      16,
      16,
      "screen1"
    );
    screen.color(pallete.Window_Title_Close_Outline, "screen1");
    screen.draw.text(
      this.x + this.width - 18,
      this.y + 17,
      "X",
      "screen1"
    );
  }

  kill() {} // Placeholder for kill method

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
    if (this.x > client_display_rect.width-20) {
      this.x = client_display_rect.width - 20;
    }
    if (this.y > client_display_rect.height-20) {
      this.y = client_display_rect.height - 20 ;
    }
    if (this.x < -this.width+20) {
      this.x = 20 - this.width;
    }
    if (this.y < -this.height+20) {
      this.y = 20 - this.height;
    }
  }
}

class AppStore extends Window {
  constructor(x, y, width, height) {
    super(x, y, width, height, "App Store");
    this.appList = [];
    if (!navigator.onLine) {
      console.error("No internet connection");
      screen.color(pallete.Main_Error, "screen1");
      screen.draw.text(
        this.x + 5,
        this.y + this.height / 2,
        "Failed to fetch app list\nAre you online?",
        "screen1"
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
          console.log("App data fetched", appData);
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

  // ✅ Helper: Displays error on screen
  displayError(message) {
    screen.color(pallete.Main_Error, "screen1");
    screen.draw.text(this.x + 5, this.y + this.height / 2, message, "screen1");
  }

  addApp(app) {
    this.appList.push(app);
  }

  draw() {
    super.draw();
    if (this.appList.length === 0 || typeof this.appList[0] === "string") {
      screen.color(pallete.Window_Title_Text, "screen1");
      screen.draw.text(
        this.x + 5,
        this.y + this.height / 2,
        "No apps available",
        "screen1"
      );
      return;
    }
    this.appList.forEach((app, i) => {
      screen.color(pallete.Window_Title_BG, "screen1");
      screen.draw.rectangle(
        this.x + 4,
        this.y + 30 + i * 20,
        this.width - 8,
        35,
        "screen1"
      );
      screen.color(pallete.Window_Title_Text, "screen1");
      screen.draw.text(this.x + 6, this.y + 45 + i * 50, app.name, "screen1");
      var context = screen.getCanvas("screen1").getContext("2d");
      context.textAlign = "right";
      screen.draw.text(
        this.x + this.width-6,
        this.y + 60 + i * 50,
        app.author,
        "screen1"
      );
      context.textAlign = "left";
      screen.draw.text(
        this.x + 6,
        this.y + 60 + i * 50,
        app.version,
        "screen1"
      );
    });
  }
}

document.addEventListener("mousedown", (event) => {
  var { x: mouseX, y: mouseY } = html_to_screen(event.clientX, event.clientY);

  for (let i = windows.length - 1; i >= 0; i--) {
    const window = windows[i];

    if (
      mouseX >= window.x &&
      mouseX <= window.x + window.width - 18 &&
      mouseY >= window.y &&
      mouseY <= window.y + 20
    ) {
      // Move clicked window to the end (top)
      windows.push(windows.splice(i, 1)[0]);

      // Prepare drag
      window.draggingOffset.x = mouseX - window.x;
      window.draggingOffset.y = mouseY - window.y;
      window.dragStart();

      break; // Stop after the topmost hit window
    } else if (
      mouseX >= window.x + window.width - 19 &&
      mouseX <= window.x + window.width - 1 &&
      mouseY >= window.y + 1 &&
      mouseY <= window.y + window.y + 19
    ) {
      window.kill(); // Close window
      windows.splice(i, 1); // Remove from array
      gui_refresh(); // Refresh GUI
    }
  }
});

windows.push(new AppStore(300, 250, 200, 200));
gui_refresh();

function main() {
  gui_refresh();
}

setInterval(main, 1000 / 30); // 30 FPS
