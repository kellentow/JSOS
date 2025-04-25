// Version 1.4
try {
  if (req.is_older(req.version, "1.2")) {
    console.error("Version 1.2 or newer is required.");
  }
  req.load("screen.js", "1.4");
} catch (error) {
  throw new Error("Can't find req.js");
}

// Change color function
var screen = {
  width: function (sc, size) {
    return document.getElementById(sc).clientWidth / size;
  },
  height: function (sc, size) {
    return document.getElementById(sc).clientHeight / size;
  },
  getCanvas: function (sc) {
    return document.getElementById(sc);
  },
  clear: function (sc) {
    sc = document.getElementById(sc);
    var context = sc.getContext("2d");
    context.clearRect(0, 0, sc.width, sc.height);
  },
  draw: {
    screen: function (w, h, id) {
      var sc = document.createElement("canvas");
      sc.width = w;
      sc.height = h;
      sc.classList.add("screen");
      sc.id = id;

      // Append the screen to the body (you can modify this based on your needs)
      document.body.appendChild(sc);
    },
    line: function (x1, y1, x2, y2, sc, size) {
      var x = 0;
      max = Math.max(x1, y1, x2, y2);
      for (x = 0; x < max; x++) {
        screen.create.pixel(
          x1 + (x2 - x1) * (x / max),
          y1 + (y2 - y1) * (x / max),
          sc
        );
      }
    },
    rectangle: function (x, y, width, height, id) {
      var x = Math.round(x);
      var y = Math.round(y);
      var width = Math.round(width);
      var height = Math.round(height);

      var sc = document.getElementById(id);
      var context = sc.getContext("2d");
      context.fillRect(x, y, width, height);
    },
    elipsis: function (cx, cy, rx, ry, acc, screenId) {
      // Center position
      let centerX = cx;
      let centerY = cy;

      // X and Y radii
      let radiusX = rx;
      let radiusY = ry;

      // Loop to draw points around the ellipse
      for (let degree = 0; degree < 360; degree += acc) {
        // Calculate point on ellipse for this angle
        let x = centerX + radiusX * Math.cos((degree * Math.PI) / 180);
        let y = centerY + radiusY * Math.sin((degree * Math.PI) / 180);

        // Draw point
        screen.pixel.create(x, y, "black", screenId);
      }
    },
    text: function (x, y, text, id) {
      var sc = document.getElementById(id);
      var context = sc.getContext("2d");
      context.font = screen.text.font;
      a = text.split("\n");
      for (i = 0; i < a.length; i++) {
        context.fillText(a[i], x, y + i * 20);
      }
    },
    pixel: function (x, y, id) {
      var x = Math.round(x);
      var y = Math.round(y);

      var sc = document.getElementById(id);
      var context = sc.getContext("2d");
      context.fillRect(x, y, 1, 1);
    }
  },
  text: {
    font: "15px Arial",
    change_font: function (size, font, id) {
      screen.text.font = size + " " + font
      var sc = document.getElementById(id);
      var context = sc.getContext("2d");
      context.font = screen.text.font;
    },
    get_width: function (text, id) {
      const canvas = document.getElementById(id);
      const ctx = canvas.getContext('2d');

      // Set the font before measuring
      ctx.font = screen.text.font;

      const metrics = ctx.measureText(text);
      return metrics.width
    },
    wrap_text: function (x, y, max_width, text, id) {
      words = text.split(" ");
      n=0
      j=0
      for (let i = 0; i < words.length; i++) {
        var test_line = words.slice(j, i).join(" ")
        if (screen.text.get_width(test_line,id) > max_width) {
          var new_line = words.slice(j, i-1).join(" ")
          j=i-1
          screen.draw.text(x,y+n*20,new_line,id)
          n+=1
        }          
      }
      var new_line = words.slice(j).join(" ")
          screen.draw.text(x,y+n*20,new_line,id)
    }
  },
  color: function (color, id) {
    var sc = document.getElementById(id);
    var context = sc.getContext("2d");
    context.fillStyle = color;
  }
};
