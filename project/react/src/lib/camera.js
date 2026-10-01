// Camera geometry shared by the verification component and its tests.

// The guide oval in its SVG viewBox (400 × 300, scaled with "slice").
export const OVAL={cx:200,cy:146,rx:84,ry:108};

// Maps the on-screen oval through the video's object-fit: cover onto the captured
// frame, as fractions of the frame. The server only considers faces inside this
// area, so people in the background outside the oval never fail the check.
// `stage` and `video` need only clientWidth/clientHeight and videoWidth/videoHeight.
export function verificationArea(stage,video,mirrored){
  const W=stage?.clientWidth,H=stage?.clientHeight,vw=video?.videoWidth,vh=video?.videoHeight;
  if(!W||!H||!vw||!vh)return undefined;
  const s=Math.max(W/400,H/300),v=Math.max(W/vw,H/vh),round=n=>Math.round(n*10000)/10000;
  const x=((W-400*s)/2+OVAL.cx*s-(W-vw*v)/2)/v/vw,y=((H-300*s)/2+OVAL.cy*s-(H-vh*v)/2)/v/vh;
  return {cx:round(mirrored?1-x:x),cy:round(y),rx:round(OVAL.rx*s/v/vw),ry:round(OVAL.ry*s/v/vh)};
}
