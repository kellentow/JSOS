import classes from "./os-classes";

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
