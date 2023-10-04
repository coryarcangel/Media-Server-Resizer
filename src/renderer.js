console.log(electron)
const {ipcRenderer,on, shell} = electron;

let batch = true;

let filesDiv = document.getElementById("files");
let completedFilesDiv = document.getElementById("completed-files");
let batchWrapper = document.getElementById("batch-wrapper");
let page = document.getElementById("page");

//I am reusing a lot of this code to show the batch editor
const fileTemplate = (file,batch=false) => file ? `<div id="${batch ? "batch" : file.id}" class="file ${file?.completed ? "completed" : ""}">
    <div class="file-header">
        <input type="text" class="file-name-input" placeholder="Enter ${batch ? "base " : ""}title" name="title" value="${file.title && file.title !== "undefined" ? file.title : ""}"></input>
        <div class="file-name">File name: ${file.name.split("/").splice(-1)}</div>
    </div>
    <div class="file-numbers">
        <label for="year">year</label>
        <input type="number" name="year" class="file-year" placeholder="Year" value="${file.year ? file.year : new Date().getUTCFullYear()}"></input>
        <label for="inv">inventory # </label>
        <input type="text" name="inv" class="file-inv" placeholder="XXX" value="${file.inv ? file.inv : ""}"></input>
    </div>
    <div class="file-screenshot">
        <label>screenshot?</label>
        <input type="checkbox" name="screenshot" class="cb file-screenshot" ${file.screenshot ? "checked" : ""}></input>
    
            <label>photog. </label>
            <input type="text" name="photographer" class="cb file-photog-input" placeholder="${file.photographer ? file.photographer : "Photog. Initials"}" value="${file.photographer ? file.photographer : "ih"}"></input>
        </div>
        <div class="file-info">
            ${batch ? batchPreviews(batch): `<img class="file-img" src="file://${file.name}"></img>`} 
            <div class="sizes">
                <div class="size-press">
                    <input type="checkbox" name="press" class="cb file-press" ${file.press ? "checked" : ""}></input>
                    <label>press</label>
                </div>
                <div class="size-web">
                    <input type="checkbox" name="web" class="cb file-web" ${file.web ? "checked" : ""}></input>
                    <label>web</label>
                </div>
                <div class="size-db">
                    <input type="checkbox" name="db" class="cb file-db" ${file.db ? "checked" : ""}></input>
                    <label>db</label>
                </div>
            </div>
        </div>
        ${file.files ? `<div class="file-files">${Object.keys(file.files).toString()} sizes.</div>` : ""}
        <div class="file-buttons">
            <button class="${batch ? "run-batch":"file-convert"}"> ${batch ? "Batch g":"G"}enerate images</button>
            ${batch ? '' : `<button class="delete">remove</button>`}
        </div>
        <div class="file-reveal overlay">Reveal in finder</div>
    </div>` : ""

const batchPreviews = (files) => {
    console.log(files)
    return `
    <div class="img-previews">
        ${files.map(f => `<img class="file-img" src="file://${f.name}"></img>`).join("")}
    </div>
`}

//use #div and fill it with children for each file in files
const renderFiles = (files) => {
    console.log("YEAH",files)
    batchWrapper.innerHTML = files.length ? fileTemplate(files[0],files): 
    "<div class='header no-files'>No new files. Drop files onto this window to convert!</div>";
    let completeCount = files.filter(f => f?.completed).length;
    let incompleteCount = files.length - completeCount;
    filesDiv.innerHTML = "";
    filesDiv.innerHTML = incompleteCount ? "<div class='header not-yet-files'><div>Your files:</div><button class='convert-all'>Convert all</button></div>":
    "<div class='header no-files'>No new files. Drop files onto this window to convert!</div>";
    completedFilesDiv.innerHTML = completeCount ? 
        "<div class='header completed-header'><div>Converted:</div><button class='remove-completed'>Remove all</button></div>" : "";
    for(let i = 0; i < files.length; i++){
        let file = files[i];
        let div = fileTemplate(file);
        if(files[i].completed){
            completedFilesDiv.innerHTML += (div);
        } else {
            filesDiv.innerHTML += (div);
        }
    }
    let fileInputs = filesDiv.querySelectorAll("input[type=text],input[type=number]");
    //add event listeners to the file name inputs
    for(let i = 0; i < fileInputs.length; i++){
        fileInputs[i].addEventListener("input", (e) => {
            console.log(e.target.value,e.target.closest(".file").id,e.target.getAttribute("name"))
            let id = e.target.closest(".file").id;
            let value = e.target.value;
            let name = e.target.getAttribute("name");
            ipcRenderer.send('textInput', {id,name,value});
            e.target.focus();
        });
    }
};

document.getElementById('set_output_folder').addEventListener('click', async () => {
    const ret = await ipcRenderer.send('open-file-dialog');
    console.log("ret",ret)
    if(ret)
    document.getElementById('output_folder').innerHTML = ret;
});

document.getElementById('mode').addEventListener("change",(e) => {
    let which = e.target.getAttribute("value").toLowerCase();
    if(which === "batch"){
        page.classList.add("batch");
    } else {
        page.classList.remove("batch");
    }
});


console.log("SETTINGS!",settings)

ipcRenderer.on('selected-directory', (event, path) => {
    console.log("selected-directory",path)
    document.getElementById('output_folder').innerHTML = "Output folder: "+path;
});

ipcRenderer.on('convert-complete', (event, files) => {
    console.log("convert complete",files);
    renderFiles(files);
});

const defaultFileObject = {
    name: "no name",
    title: null,
    press: true,
    web: true,
    db: true,
    year: new Date().getFullYear(),
    inventory: "XXX",
    screenshot: false,
    photographer: "ih",
    completed: false
}

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});
const fileClickHandler = (e) => {
    let batch = false;
    let id = e.target.closest(".file")?.id;
    console.log("id",id )
    if(e.target.getAttribute("type") === "text"){
        return;

    }
    if(e.target.classList.contains("cb")){
        let name = e.target.getAttribute("name");
        let checked = e.target.checked;
        ipcRenderer.send('checkbox', {id,name,checked});
    }
    if(e.target.classList.contains("file-convert")){
        //send a convert message to main.js with filename as argument
        console.log("convert",id);
        ipcRenderer.send('convert', id);
    }
    if(e.target.classList.contains("file-reveal")){
        //send a convert message to main.js with filename as argument
        ipcRenderer.send('open-file', id);
    }
    if(e.target.classList.contains("delete")){
        let id = e.target.closest(".file").id;
        ipcRenderer.send('delete',id);
    }
    if(e.target.classList.contains("remove-completed")){
        ipcRenderer.send('delete-completed');
    }
    if(e.target.classList.contains("run-batch")){
        let obj = {};
        obj.id = randomString(5);
        obj.title = batchWrapper.querySelector(".file-name-input").value;
        obj.year = batchWrapper.querySelector(".file-year").value;
        obj.inv = batchWrapper.querySelector(".file-inv").value;
        obj.screenshot = batchWrapper.querySelector(".file-screenshot > .file-screenshot").checked;
        obj.photographer = batchWrapper.querySelector(".file-photog-input").value;
        obj.press = batchWrapper.querySelector(".file-press").checked;
        obj.web = batchWrapper.querySelector(".file-web").checked;
        obj.db = batchWrapper.querySelector(".file-db").checked;
        console.log("obj",obj)
        ipcRenderer.send('batch',obj);
        
    }
    if(e.target.classList.contains("convert-all")){
        ipcRenderer.send('convert-all');
    }
}
//add a click listener to the files div
document.getElementById("files-wrapper").addEventListener('click', fileClickHandler);
document.getElementById("batch-wrapper").addEventListener('click', fileClickHandler);

//random letters string of n length function
function randomString(len) {
    var text = "";
    var possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < len; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

document.getElementById("view_output_folder").addEventListener("click",() => {
    console.log("yeah!")
    ipcRenderer.send('open-folder');
});

document.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();

    let files = [];
    for (const f of event.dataTransfer.files) {
        // Using the path attribute to get absolute file path
        console.log('File Path of dragged files: ', f.path)
        let fileDiv = document.createElement("pre");
        let file = Object.assign({}, defaultFileObject);
        file.name = f.path;
        file.id = randomString(5);
        files.push(file); // assemble array for main.js
        console.log("file",file);
        fileDiv.innerHTML = JSON.stringify(file,null,2);
        let div = fileTemplate(file);
        filesDiv.innerHTML +=(div);
    }
    const ret = ipcRenderer.sendSync('dropped-file', files);
    console.log(ret);
});


ipcRenderer.on('dropped-file-complete', (event, files) => {
    console.log("dropped file complete")
    renderFiles(files);
});

ipcRenderer.on('delete-complete', (event, files) => {
    renderFiles(files);
});

ipcRenderer.on('delete-all-complete', (event, files) => {
    renderFiles(files);
});

//on load-complete
ipcRenderer.on('load-complete', (event, data) => {
  let {files,settings} = data;
  if(settings.output_folder){
    document.getElementById('output_folder').innerHTML =  "Output folder: "+settings.output_folder;
  } else {
    document.getElementById('output_folder').innerHTML =  "No output folder set.";
  }
  
  console.log(files)
  renderFiles(files);
});

ipcRenderer.send('load');