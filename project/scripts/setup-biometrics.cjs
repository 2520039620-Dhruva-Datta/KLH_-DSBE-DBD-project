'use strict';
// Install project-local Python and public model files; never changes system Python.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'.runtime'),pythonDir=path.join(runtime,'python'),models=path.join(runtime,'face-models');
async function download(url,file){if(fs.existsSync(file)&&fs.statSync(file).size>100)return;console.log('Downloading '+path.basename(file));const r=await fetch(url);if(!r.ok)throw Error('Download failed '+r.status+' '+url);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));}
// Reads one entry from a zip archive (MediaPipe .task bundles are plain zips).
function unzipEntry(archive,name){
  const zlib=require('node:zlib');let end=archive.length-22;
  while(end>=0&&archive.readUInt32LE(end)!==0x06054b50)end--;
  if(end<0)throw Error('Not a zip archive.');
  for(let i=0,p=archive.readUInt32LE(end+16);i<archive.readUInt16LE(end+10);i++){
    const method=archive.readUInt16LE(p+10),size=archive.readUInt32LE(p+20),nameLength=archive.readUInt16LE(p+28),extra=archive.readUInt16LE(p+30),comment=archive.readUInt16LE(p+32),local=archive.readUInt32LE(p+42);
    if(archive.toString('utf8',p+46,p+46+nameLength)===name){
      const start=local+30+archive.readUInt16LE(local+26)+archive.readUInt16LE(local+28),data=archive.subarray(start,start+size);
      return method===0?data:method===8?zlib.inflateRawSync(data):(()=>{throw Error('Unsupported zip compression.');})();
    }
    p+=46+nameLength+extra+comment;
  }
  throw Error('Missing '+name+' in archive.');
}
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error('Setup command failed: '+cmd);}
(async()=>{
  fs.mkdirSync(runtime,{recursive:true});
  if(process.platform==='win32'){
    await download('https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip',path.join(runtime,'python-3.12.10.zip'));
    if(!fs.existsSync(path.join(pythonDir,'python.exe'))){fs.mkdirSync(pythonDir,{recursive:true});run('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath '${path.join(runtime,'python-3.12.10.zip').replaceAll("'","''")}' -DestinationPath '${pythonDir.replaceAll("'","''")}'`]);}
    fs.writeFileSync(path.join(pythonDir,'python312._pth'),'python312.zip\n.\nLib/site-packages\nimport site\n');
  }
  const python=process.env.FACE_PYTHON||(process.platform==='win32'?path.join(pythonDir,'python.exe'):'python3');
  await download('https://bootstrap.pypa.io/get-pip.py',path.join(runtime,'get-pip.py'));
  run(python,[path.join(runtime,'get-pip.py'),'--no-warn-script-location']);
  run(python,['-m','pip','install','--no-warn-script-location','opencv-python-headless==4.12.0.88','numpy==2.2.6','openvino==2025.2.0']);
  const zoo='https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/';
  await download(zoo+'face_detection_yunet/face_detection_yunet_2023mar.onnx',path.join(models,'yunet.onnx'));
  await download(zoo+'face_recognition_sface/face_recognition_sface_2021dec.onnx',path.join(models,'sface.onnx'));
  for(const [dir,file]of [['face_detection_yunet','YUNET_LICENSE'],['face_recognition_sface','SFACE_LICENSE']])await download('https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/'+dir+'/LICENSE',path.join(models,file));
  const age='https://storage.openvinotoolkit.org/repositories/open_model_zoo/2023.0/models_bin/1/age-gender-recognition-retail-0013/FP16/';
  for(const ext of ['xml','bin'])await download(age+'age-gender-recognition-retail-0013.'+ext,path.join(models,'age.'+ext));
  // Blink liveness: MediaPipe's 478-point face mesh, run by OpenVINO's TFLite reader.
  const mesh=path.join(models,'face-mesh.tflite');
  if(!fs.existsSync(mesh)){
    const bundle=path.join(runtime,'face_landmarker.task');
    await download('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',bundle);
    fs.writeFileSync(mesh,unzipEntry(fs.readFileSync(bundle),'face_landmarks_detector.tflite'));
  }
  await download('https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE',path.join(models,'MEDIAPIPE_LICENSE'));
  const manifest=Object.fromEntries(fs.readdirSync(models).map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(models,n))).digest('hex')]));
  fs.writeFileSync(path.join(models,'checksums.json'),JSON.stringify(manifest,null,2));
  console.log('Biometric runtime and models installed locally. No camera data was collected.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
