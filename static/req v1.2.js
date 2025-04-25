// Version 1.2

var req = {
  is_older: function(a,b) { // STATIC: VersionA < VersionB
    var v1 = String(a).split(".");
    var v2 = String(b).split(".");
    for (var i = 0; i < v1.length; i++) {
      if (parseInt(v1[i]) < parseInt(v2[i])) {
        return true;
      }
    }
    return false;
  },
  version: "1.2",
  required: {},
  loaded: {},
  add: function(name, version) { // Add a dependency
    if (!req.required[name] || req.is_older(version,req.required[name])) {
      req.required[name] = version;
    }
  },
  load: function(name, version) { // Load a dependency
    if (!req.loaded[name] || req.is_older(version, req.loaded[name])) {
      req.loaded[name] = version;
    }
  },
  log: function() { // Log the dependencies
    console.log("Loaded: " + JSON.stringify(req.loaded));
    console.log("Required: " + JSON.stringify(req.required));

    var outdatedDependencies = Object.keys(req.required).filter(name => 
      !req.loaded[name] || (req.is_older(req.loaded[name],req.required[name]))
    );

    if (outdatedDependencies.length > 0) {
      var updatesNeeded = outdatedDependencies.map(name => 
        name + " (minimum version: " + req.required[name] + ")"
      );
      console.log("Outdated Dependencies: " + updatesNeeded.join(", "));
    } else {
      console.log("All dependencies are up to date.");
    }
  }
};
