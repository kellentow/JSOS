# JSOS
JSOS is a Javascript based desktop with a backend python server for downloading apps

## Running
### External
Go to https://jsos.sleepyis.dev to see a version of it running 

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

This is the API for the processes that are spawned
``` ts
window = {
    os: OS,
    IPCs: IPC_Wrapper[],
    parent_doc: () => (Document | undefined),
    fs: () => (FSWrapper | undefined),
    proc: OS_Process,
    prockey: ProcessKey,
    requestSudo: () => boolean
}
```

parent_doc requires the "EditDom" permission (id 16)
fs requires the "UseFilesystem" permission (id 2)
requestSudo asks the user if the current process can elevate it's perms to uid 0 (aka root)

For more APIS check os-classes.ts

The pack.sh script is made for Linux and may not work in Windows or MacOS