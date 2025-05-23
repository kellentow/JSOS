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

req.add("OS-classes.js", "1.0");

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

screen.draw.screen(window.innerWidth, window.innerHeight, "screen1");
windows = [];
this.windows = windows
let keysPressed = {};
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
    if (window.FLAG_redraw) {
      window.draw();
      window.FLAG_redraw = false;
    }
    window.drawFlush(); // Flush window content
    window.update(); // Update window content
  });
}
function os_keybinds() { 
  if (keysPressed["Tab"] && keysPressed["r"]) {
    keysPressed["Tab"] = false;
    // Open run dialog
    windows.push(new RunDialog(300, 250, "screen1"));
  }
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
function point_in_rect(px, py, x, y, w, h) {
  var in_x = px >= x && x + w >= px;
  var in_y = py >= y && y + h >= py;
  return in_x && in_y;
}
function point_in_circle(px, py, cx, cy, r) {
  var dist = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
  return dist <= r;
}
function on_scroll(event) {
  var { x: mouseX, y: mouseY } = html_to_screen(event.clientX, event.clientY);
  const LINE_HEIGHT = 16;
  let deltaY = event.deltaY;
  let deltaX = event.deltaX;

  // Normalize if needed
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    deltaY *= LINE_HEIGHT;
    deltaX *= LINE_HEIGHT;
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    deltaY *= window.innerHeight;
    deltaX *= window.innerHeight;
  }

  for (let i = windows.length - 1; i >= 0; i--) {
    const window = windows[i];

    if (
      point_in_rect(
        mouseX,
        mouseY,
        window.x,
        window.y + 20,
        window.width,
        window.height - 20
      )
    ) {
      window._scroll(deltaX, deltaY);
    }
  }
}
function on_click(event) {
  var { x: mouseX, y: mouseY } = html_to_screen(event.clientX, event.clientY);

  for (let i = windows.length - 1; i >= 0; i--) {
    const window = windows[i];

    if (
      point_in_rect(
        // Drag detector
        mouseX,
        mouseY,
        window.x,
        window.y,
        window.width - 20,
        20
      )
    ) {
      // Move clicked window to the end (top)
      windows.push(windows.splice(i, 1)[0]);

      // Prepare drag
      window.draggingOffset.x = mouseX - window.x;
      window.draggingOffset.y = mouseY - window.y;
      window.dragStart();

      return; // Stop after the topmost hit window
    } else if (
      point_in_rect(
        // Close button
        mouseX,
        mouseY,
        window.x + window.width - 19,
        window.y + 1,
        19,
        19
      )
    ) {
      window.kill(); // Close window
      gui_refresh(); // Refresh GUI
      return;
    } else if (
      point_in_rect(
        // Window Content
        mouseX,
        mouseY,
        window.x,
        window.y + 20,
        window.width,
        window.height - 20
      )
    ) {
      // Move clicked window to the end (top)
      windows.push(windows.splice(i, 1)[0]);

      window._click(mouseX - window.x, mouseY - window.y, event.detail);
      return;
    } else if (
      point_in_circle(
        // Resize detector
        mouseX,
        mouseY,
        window.x + window.width,
        window.y + window.height,
        20
      )
    ) {
      // Resize clicked window to the end (top)
      windows.push(windows.splice(i, 1)[0]);
      window.resizeStart();
      return; // Stop after the topmost hit window
    }
  }
}
function on_keydown(event) {
  keysPressed[event.key] = true;
    event.preventDefault();

    if (event.key != "Tab") { // Ignore sys keybinds
      // Tell the window that a key was pressed
      const window = windows[windows.length - 1];
      if (window) {
        window.FLAG_redraw = true; // Mark window for redraw
        window._keypress(event.key);
      }
    }
}
function on_keyup(event) {
  delete keysPressed[event.key];
}

document.addEventListener("scroll", on_scroll);
document.addEventListener("mousedown", (event) => { debounce(on_click, 50)(event); }); // Debounce click event
document.addEventListener('keydown', on_keydown);
document.addEventListener('keyup', on_keyup);

var screen_element = document.getElementById("screen1");
screen_element.style.position = "absolute";
screen_element.style.top = 0;
screen_element.style.left = 0;
try {
  window.fs = FS.load(localStorage.getItem("fs"));
} catch (error) {
  // Create a new file system if it doesn't exist
  window.fs = new FS();
  console.error(error);
}

windows.push(new AppStore(300, 250, 200, 200, "screen1"));

Object.values(fs.read("apps")).forEach((element) => {
  if (Object.hasOwnProperty.call(element, "main.js")) {
    // Load the app
    eval(element["main.js"]);
  }
});

function main() {
  os_keybinds();
  gui_refresh();
}

setInterval(main, 1000 / 30); // 30 FPS

window.dispatchEvent(new Event("resize")); // Trigger resize event to set initial size
window.addEventListener("resize", () => {
  var screen_element = document.getElementById("screen1");
  screen_element.width = window.innerWidth;
  screen_element.height = window.innerHeight;
  client_display_rect = document
    .getElementById("screen1")
    .getBoundingClientRect();
  gui_refresh();
});
