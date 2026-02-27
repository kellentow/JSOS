# JSOS
JSOS is a Javascript based desktop with a backend python server for downloading apps

## Running
### External
Go to https://jsos.sleepyis.dev to see the most recent version of it running 

### Local
git clone this repo
run `./build.sh` in linux
run `python3 main.py`
go to http://localhost:5000

## Developing Apps
Apps are meant to be installed to the FS and then ran, though apps can be started through devtools

``` js
let root = window.os.getRootProc()
await root.createChildProcess(window.root_key, "test_app_name", "console.log('this is a program that ran')")
```

Helpers for using the process API can be found in ./src/helpers.ts though the api for each class is found in ./src/os-classes.ts

The pack.sh and build.sh script is made for Linux and will probably not work in Windows or MacOS