import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationArea} from '../src/lib/camera.js';

const near=(actual,expected)=>Object.entries(expected).forEach(([k,v])=>assert.ok(Math.abs(actual[k]-v)<0.002,k+': '+actual[k]+' ≠ '+v));

test('the oval maps directly onto a frame with the preview\'s 4:3 shape',()=>{
  near(verificationArea({clientWidth:680,clientHeight:510},{videoWidth:640,videoHeight:480},true),{cx:.5,cy:146/300,rx:84/400,ry:108/300});
});

test('a wide 16:9 camera behind a 4:3 preview narrows the oval within the frame',()=>{
  // The preview crops the sides, so the oval covers a smaller share of the frame width.
  const area=verificationArea({clientWidth:680,clientHeight:510},{videoWidth:1280,videoHeight:720},true);
  near(area,{cx:.5,cy:146/300,rx:0.1575,ry:108/300});
});

test('a portrait phone preview keeps the oval centred on a portrait stream',()=>{
  const area=verificationArea({clientWidth:358,clientHeight:477},{videoWidth:720,videoHeight:1280},true);
  assert.ok(Math.abs(area.cx-.5)<0.002);assert.ok(area.rx>0.1&&area.rx<0.5);assert.ok(area.ry>0.1&&area.ry<0.6);
});

test('the area is unavailable until the camera has dimensions',()=>{
  assert.equal(verificationArea({clientWidth:680,clientHeight:510},{videoWidth:0,videoHeight:0},false),undefined);
  assert.equal(verificationArea(null,null,false),undefined);
});
