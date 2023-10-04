const os = require('os');
const path = require('path');
const electron = require('electron')
const { contextBridge, ipcRenderer, ipcMain, shell } = electron;

contextBridge.exposeInMainWorld('electron', {
    startDrag: (fileName) => {
        ipcRenderer.send('ondragstart', fileName)
    },
    ipcRenderer: {...ipcRenderer, on: ipcRenderer.on.bind(ipcRenderer)},
    on: ipcRenderer.on,
    shell: shell
})
