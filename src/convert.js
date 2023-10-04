//write a suite of functions for converting between image sizes with the sharp library

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const handle = (string) => {
    return string.replace(/[^a-zA-Z0-9]/g,"-").toLowerCase();
};

const RESIZE_CONFIGS = [
    {
      name: "db",
      size: [800,-1],
      format: "jpeg",
      resampleMethod: "BILINEAR"
    },
    {
      name: "web",
      size: [1400,-1],
      format: "jpeg",
      method: "LZW",
      resampleMethod: "BILINEAR"
    },
    {
      name: "press",
      size: 3600,
      format: "png",
      resampleMethod: (opt,img) => {
        if(opt.screenshot && img.width < 3600){
          return "NEARESTNEIGHBOR"
        }
        return "BILINEAR"
      }
    }
  ]

  const fileName = (file,config,batchObj={},i) => {
    let data = {...file,...batchObj};
    return `${toHandle(data.title)}-${data.year}-${data.inv}-${config.name}-${data.photographer}-${data.id}${i>-1 ? `-${i+1}`:""}.${config.format}`
  }

  const toHandle = (string) => {
    return string.replace(/[^a-zA-Z0-9]/g,"-").toLowerCase();
    }

const convert = async (file,output_folder,batchObj,i) => {
    console.log("convert",file,output_folder);
    //load image with sharp from path
    const img = new sharp(file.name);
    const meta = await img.metadata();
    let {width, height} = await img.metadata();
    let results = await Promise.all(
        RESIZE_CONFIGS
        .filter(config => file[config.name])
        .map(async config => {
        //calculate actual width and height of new document. Scale proportionally from source img!
        let newWidth;
        let newHeight;
        let resample = typeof config.resampleMethod === "string" ? config.resampleMethod : config.resampleMethod(config,meta);
        let resizeOptions = {};
        if(resample==="NEARESTNEIGHBOR"){
            resizeOptions.kernel = sharp.kernel.nearest;
        }
        //if size is a number, use that as the largest side. Otherwise, fix the height or width based on the provided array
        if(typeof config.size === "number"){
            if(width>height){
                newWidth = config.size;
                newHeight = height/(width/config.size);
            } else {
                newWidth = width/(height/config.size);
                newHeight = config.size;
            }
            } else {
            newWidth = config.size[0] === -1 ? width/(height/config.size[1]) : config.size[0];
            newHeight = config.size[1] === -1 ? height/(width/config.size[0]) : config.size[1];
        }
        //If method is provided explicitly, use that. Otherwise, use the function provided
        console.log("convert!!!",file)
        return await img
            .resize({width: Math.floor(newWidth), height: Math.floor(newHeight), ...resizeOptions})
            .toFormat(config.format)
            .toBuffer()
            .then(data => {
                let theImageName = fileName(file,config,batchObj,i);
                console.log("theImageName",theImageName)
                let filePath = path.join(output_folder,theImageName);
                // fs.writeFileSync(path.join(output_folder,file.name.split("/").slice(-1)[0].replace(".",`-${config.name}.`)),data);
                fs.writeFileSync(filePath,data);
                return {type: config.name, filename: filePath}
            }).catch(function(err) {
                console.log("Error occured ", err);
                throw new Error(err);
              });
    }));
    return results.reduce((acc,cur) => {
        acc[cur.type] = cur.filename;
        return acc;
    },{});
}

module.exports = {
    convert: convert
};