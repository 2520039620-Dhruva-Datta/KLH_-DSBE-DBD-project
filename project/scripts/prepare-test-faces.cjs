'use strict';
const path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const python=process.env.FACE_PYTHON||(process.platform==='win32'?path.join(root,'.runtime/python/python.exe'):'python3');
const r=spawnSync(python,[path.join(root,'tests/prepare-face-fixtures.py')],{windowsHide:true,stdio:'inherit'});
if(r.error)console.error('Run npm run setup:biometrics first:',r.error.message);
process.exitCode=r.status??1;
