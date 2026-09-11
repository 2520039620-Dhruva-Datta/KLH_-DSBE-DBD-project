'use strict';
const V=require('./validation.cjs');
const TYPES={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',txt:'text/plain'};
function documents(input=[],existingSize=0) {
  if(!Array.isArray(input)||input.length>20)V.fail('Attach at most 20 documents per request.');
  let total=existingSize;
  return input.map(raw=>{
    V.fields(raw,['label','name','size','mime','content']);
    const name=V.text(raw.name,'File name',1,200),label=V.text(raw.label,'Document label',2,100);
    if(/[\/\\\u0000-\u001f]/.test(name))V.fail('Use a plain file name without folders or control characters.');
    const extension=name.split('.').pop().toLowerCase(),mime=TYPES[extension];
    if(!mime)V.fail('Upload a PDF, PNG, JPG, or TXT file.');
    const match=typeof raw.content==='string'&&raw.content.match(/^data:([^;,]*);base64,([A-Za-z0-9+/]*={0,2})$/);
    if(!match||match[2].length%4!==0)V.fail('The attachment is not a valid base64 data URL.');
    const content=Buffer.from(match[2],'base64');
    if(content.toString('base64')!==match[2]||!content.length)V.fail('The attachment is empty or invalid.');
    if(content.length>1048576)V.fail('Each document must be 1 MB or smaller.',413);
    total+=content.length;if(total>2097152)V.fail('Keep total attachments under 2 MB per application.',413);
    if(Number(raw.size)!==content.length)V.fail('The attachment size does not match its content.');
    // Some operating systems report an empty or octet-stream MIME. The extension
    // and actual bytes remain mandatory; claimed MIME is never trusted alone.
    for(const declared of [raw.mime,match[1]])if(declared&&!['application/octet-stream',mime].includes(declared))V.fail('The file type does not match its name.');
    if(extension==='pdf'&&!(content.subarray(0,5).toString()==='%PDF-'&&content.subarray(-1024).includes(Buffer.from('%%EOF'))))V.fail('Invalid PDF document.');
    if(extension==='png'&&!(content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&content.length>24&&content.subarray(12,16).toString()==='IHDR'))V.fail('Invalid PNG image.');
    if(['jpg','jpeg'].includes(extension)&&!(content[0]===255&&content[1]===216&&content[2]===255&&content.at(-2)===255&&content.at(-1)===217))V.fail('Invalid JPEG image.');
    if(extension==='txt'){
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(content);}catch{V.fail('TXT documents must contain UTF-8 text.');}
      if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))V.fail('TXT documents cannot contain binary content.');
    }
    return {name,label,mime,size:content.length,content};
  });
}
module.exports={documents};
