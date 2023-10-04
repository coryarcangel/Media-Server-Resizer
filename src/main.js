const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const os = require('os');
const storage = require('electron-json-storage');
const { dialog, shell } = require('electron')
// storage.setDataPath(os.tmpdir());
storage.setDataPath(app.getPath('userData'));
console.log(app.getPath('userData'))
//get or initialize the files array
let files = storage.getSync('files');
let settings = storage.getSync('settings');
if(!files.hasOwnProperty("length")){
    storage.set('files', [], function(error) {
        if (error) throw error;
      }
    );
    files = [];
}
if(!settings || !settings.hasOwnProperty("output_folder")){
    storage.set('settings', {output_folder: ""}, function(error) {
        if (error) throw error;
        }
    );
    settings = {output_folder: ""};
}

const { convert } = require('./convert.js');
let w;

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      webSecurity: false
      // contextIsolation: true,
      // nodeIntegration: true
    }
  })
  w = win;

  win.loadFile('src/index.html')

  ipcMain.on('open-file-dialog', (event) => {
    console.log("ipc open");
    dialog.showOpenDialog(win,{
        properties: ['openDirectory', 'createDirectory']
    }).then(result => {
        console.log("result.canceled",result.canceled)
        console.log("result.filePaths",result.filePaths)
        if(!result.canceled){
            //update the output folder
            storage.set('settings', {
              output_folder: result.filePaths[0],
            },(error)=>{
                console.log(error);
            });
        }
        console.log(JSON.stringify(event,null,2))
        event.sender.send("selected-directory",result.filePaths[0])
    })
    // .catch(err => {
    //     console.log(err)
    // })
})
}

const iconName = path.join(__dirname, 'iconForDragAndDrop.png')
const icon = fs.createWriteStream(iconName)

// Create a new file to copy - you can also copy existing files.
// fs.writeFileSync(path.join(__dirname, 'drag-and-drop-1.md'), '# First file to test drag and drop')
// fs.writeFileSync(path.join(__dirname, 'drag-and-drop-2.md'), '# Second file to test drag and drop')

https.get('https://img.icons8.com/ios/452/drag-and-drop.png', (response) => {
  response.pipe(icon)
})

ipcMain.on('load', (event, arg) => {
  console.log("ipc load");
  //load files and settings and send them back
  let files = storage.getSync('files');
  let settings = storage.getSync('settings');
  console.log(files)
  event.sender.send('load-complete', {files: files, settings: settings});
});

ipcMain.on('textInput', (event, arg) => {
    const {id,name,value} = arg;
    //add or update the title property on the file with id: id to name
    let files = storage.getSync('files');

    let fileIndex = files.findIndex((file) => file.id === id);
    files[fileIndex][name] = value;
    
    storage.setSync('files', files);
    event.sender.send('textInput-complete', files);
    console.log("textInput",arg)
});


ipcMain.on('ondragstart', (event, filePath) => {
  console.log("ipc ondragstart");
  event.sender.startDrag({
    file: path.join(__dirname, filePath),
    icon: iconName
  })
})


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

  function randomString(len) {
    var text = "";
    var possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < len; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }


ipcMain.on('dropped-file', (event, arg) => {
  console.log("ipc dropped");
    console.log('Dropped File(s):', arg);
    event.returnValue = `Received ${arg.length} paths.`; // Synchronous reply
    const files = arg;
    //for each filename, clone the defaultFileObject and add it to the files array
    // let files = .map((fileName, i) => {
    //     let file = Object.assign({}, defaultFileObject);
    //     file.id = randomString(5);
    //     file.name = fileName;
    //     return file;
    // });

    const currentFiles = storage.getSync('files');
    const newFiles = currentFiles.concat(files);
    storage.setSync('files', newFiles);
    event.sender.send('dropped-file-complete', newFiles);
})

ipcMain.on('convert', async (event,arg) => {
  console.log("ipc convert");
    const id = arg;
    //get files
    let files = storage.getSync('files');
    let settings = storage.getSync('settings');
    let fileIndex = files.findIndex((file) => file.id === id);
    let file = files[fileIndex];
    let result = await convert(file,settings.output_folder);
    //update the proper file as completed or not based on result
    console.log("result",result);
    files[fileIndex].completed = true;
    files[fileIndex].files = result;
    storage.setSync('files', files);
    event.sender.send('convert-complete', files);
})

ipcMain.on('open-file', async (event,arg) => {
  console.log("ipc open");
    const id = arg;
    //get files
    let files = storage.getSync('files');
    let settings = storage.getSync('settings');
    let fileIndex = files.findIndex((file) => file.id === id);
    let file = files[fileIndex];
    let sizes = ["db","web","press"];
    if(file.files){
        let found = false;
        sizes.forEach(size => {
            if(!found && file.files[size]){
                if(fs.existsSync(file.files[size])){
                    shell.showItemInFolder(file.files[size]);
                    found = true;
                    return;
                }
            }
             else {
                console.log("file has moved",file.files[size])
            }
        });
    } else {
        if(fs.existsSync(file.name)){
            shell.showItemInFolder(file.name);
            return;
        }
    }
});

ipcMain.on("open-folder", async (event,arg) => {
  console.log("ipc open");
    let settings = storage.getSync('settings');
    shell.showItemInFolder(settings.output_folder);
});


ipcMain.on("convert-all", async (event,arg) => {
    let files = storage.getSync('files');
    let settings = storage.getSync('settings');

    let results = await Promise.all(files.filter(f => !f.completed).map(async file => {
        let result = await convert(file,settings.output_folder);
        return {id: file.id, result: result};
    }));
    //update the proper file as completed or not based on result
    results.forEach((result,i) => {
        let fileIndex = files.findIndex((file) => file.id === result.id);
        files[fileIndex].completed = true;
        files[fileIndex].files = result.result;
    });
    storage.setSync('files', files);
    event.sender.send('convert-complete', files);
});

ipcMain.on("batch", async (event,arg) => {
  console.log("doing batch!!",arg)
  let files = storage.getSync('files');
    let settings = storage.getSync('settings');
    //give each file the title of the arg object
    files = files.map(file => {
        let newFile = file;
        newFile.title = arg.title;
        return newFile;
    });
    let results = await Promise.all(files.filter(f => !f.completed).map(async (file,i) => {
        let result = await convert(file,settings.output_folder,arg,i);
        return {id: file.id, result: result};
    }));
    console.log("results",results)
    //update the proper file as completed or not based on result
    results.forEach((result,i) => {
        let fileIndex = files.findIndex((file) => file.id === result.id);
        files[fileIndex].completed = true;
        files[fileIndex].files = result.result;
    });
    console.log("Files to set",files)
    storage.setSync('files', files);
    event.sender.send('convert-complete', files);
});

ipcMain.on("delete", async (event,arg) => {
  console.log("ipc delete");
    console.log("DELETING!")
    const id = arg;
    //get files
    let files = storage.getSync('files');
    let fileIndex = files.findIndex((file) => file.id === id);
    files = files.slice(0,fileIndex).concat(files.slice(fileIndex+1));
    storage.setSync('files', files);
    event.sender.send('delete-complete', files);
});

ipcMain.on("checkbox", async (event,arg) => {
  console.log("ipc checkbox");
    const id = arg.id;
    const name = arg.name;
    const checked = arg.checked;
    let files = storage.getSync('files');
    //get files
    let fileIndex = files.findIndex((file) => file.id === id);
    files[fileIndex][name] = checked;
    
    storage.setSync('files', files);
    event.sender.send('checkbox-complete', files);
});

ipcMain.on("delete-completed", async (event,arg) => {
  console.log("ipc delete");
    console.log("DELETING ALL!")
    //get files
    let files = storage.getSync('files');
    files = files.filter(f => !f.completed);
    storage.setSync('files', files);
    event.sender.send('delete-all-complete', files);
});

app.whenReady().then(createWindow)


// try {
// require('electron-reloader')(module)
// } catch (_) {}