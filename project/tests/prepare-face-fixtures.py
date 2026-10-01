"""Test-only synthetic portraits, never accepted as proof of a real identity.
Creates reproducible input batches for actual model inference and route tests.
"""
import cv2 as cv, numpy as np, json, base64, os, sys, tempfile
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
models=os.path.join(root,'.runtime','face-models')

def closed_eyes(tile):
    """Paints synthetic shut eyelids over the eyes found by the face mesh."""
    short=os.path.join(tempfile.gettempdir(),'amap-ov-2025-2')
    if os.path.exists(short): sys.path.insert(0,short)
    from openvino import Core
    mesh=Core().compile_model(os.path.join(models,'face-mesh.tflite'),'CPU')
    detector=cv.FaceDetectorYN.create(os.path.join(models,'yunet.onnx'),'',(640,480),0.85,0.3,5000)
    face=detector.detect(tile)[1][0]
    def points(center,size,angle):
        c,s=np.cos(angle),np.sin(angle)
        m=np.array([[c,s,0],[-s,c,0]],np.float64)*(256/size)
        m[:,2]=128-m[:,:2]@np.asarray(center,np.float64)
        crop=cv.cvtColor(cv.warpAffine(tile,m,(256,256)),cv.COLOR_BGR2RGB).astype(np.float32)[None]/255
        p=mesh(crop)[mesh.output(0)].reshape(-1,3)[:,:2]
        inv=cv.invertAffineTransform(m)
        return p@inv[:,:2].T+inv[:,2]
    eyes=face[4:8].reshape(2,2)
    p=points((face[0]+face[2]/2,face[1]+face[3]/2),max(face[2:4])*1.5,np.arctan2(eyes[1,1]-eyes[0,1],eyes[1,0]-eyes[0,0]))
    image=tile.copy()
    contours=[[33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7],[362,398,384,385,386,387,388,466,263,249,390,373,374,380,381,382]]
    lashes=[[33,7,163,144,145,153,154,155,133],[362,382,381,380,374,373,390,249,263]]
    for contour,lash in zip(contours,lashes):
        poly=p[contour].astype(np.float32);centre=poly.mean(0);poly=(poly-centre)*1.25+centre
        width=np.linalg.norm(p[contour[0]]-p[contour[8]])
        above=(centre+[0,-0.45*width]).astype(int);r=max(2,int(width*0.12))
        skin=image[above[1]-r:above[1]+r,above[0]-r:above[0]+r].reshape(-1,3).mean(0)
        mask=np.zeros(image.shape[:2],np.uint8);cv.fillPoly(mask,[poly.astype(np.int32)],255)
        alpha=(cv.GaussianBlur(mask,(0,0),max(1,width*0.04)).astype(np.float32)/255)[...,None]
        image=(image*(1-alpha)+skin*alpha).astype(np.uint8)
        line=p[lash].copy();line[:,1]-=width*0.05
        cv.polylines(image,[line.astype(np.int32)],False,(25,22,20),max(1,int(width*0.05)),cv.LINE_AA)
    return image
image=cv.imread(os.path.join(root,'tests','fixtures','synthetic-faces.png'))
h,w=image.shape[:2]
tiles={}
for i,name in enumerate(['FORWARD','LEFT','RIGHT','CLOSER','WRONG','OTHER']):
    crop=image[(i//3)*h//2:((i//3)+1)*h//2,(i%3)*w//3:((i%3)+1)*w//3]
    tile=np.full((480,640,3),140,np.uint8)
    tile[:,80:560]=cv.resize(crop,(480,480))
    tiles[name]=tile
tiles['BLACK']=np.zeros((480,640,3),np.uint8)
for percent in [45,50,55,60]:
    tiles['DIM'+str(percent)]=cv.convertScaleAbs(tiles['FORWARD'],alpha=percent/100,beta=0)
tiles['BLUR']=cv.GaussianBlur(tiles['FORWARD'],(75,75),30)
multi=np.full((480,640,3),140,np.uint8)
multi[80:400,:320]=cv.resize(tiles['FORWARD'][:,80:560],(320,320))
multi[80:400,320:]=cv.resize(tiles['WRONG'][:,80:560],(320,320))
tiles['MULTIPLE']=multi
# Two faces inside the verification oval: must be rejected as multiple faces.
crowded=np.full((480,640,3),140,np.uint8)
crowded[150:330,140:320]=cv.resize(tiles['FORWARD'][:,80:560],(180,180))
crowded[150:330,320:500]=cv.resize(tiles['WRONG'][:,80:560],(180,180))
tiles['CROWDED']=crowded
# The subject inside the oval with another person in the background corner,
# outside it: the bystander must be ignored.
bystander=tiles['FORWARD'].copy()
bystander[0:150,0:150]=cv.resize(tiles['OTHER'][:,80:560],(150,150))
tiles['BYSTANDER']=bystander
out={}
def encode(tile,j):
    # Brightness and quality vary with j so every frame hashes differently (unique for j < 72).
    _,encoded=cv.imencode('.jpg',cv.convertScaleAbs(tile,alpha=1,beta=j%8),[cv.IMWRITE_JPEG_QUALITY,91+j%9])
    return 'data:image/jpeg;base64,'+base64.b64encode(encoded).decode()
for name,tile in tiles.items():
    out[name]=[encode(tile,j) for j in range(6)]
# Blink sequences for the BLINK step: open/closed frames of the same synthetic
# subject (three closures), and a staring sequence with no eyelid movement.
if os.path.exists(os.path.join(models,'face-mesh.tflite')):
    shut=closed_eyes(tiles['FORWARD'])
    pattern='OOOCCOOOCOOOOCCOOO'
    out['BLINK']=[encode(shut if s=='C' else tiles['FORWARD'],j+6) for j,s in enumerate(pattern)]
    out['STARE']=[encode(tiles['FORWARD'],j+30) for j in range(len(pattern))]
    out['CLOSED']=[encode(shut,j+50) for j in range(6)]
os.makedirs(os.path.join(root,'.test-tools','identity'),exist_ok=True)
with open(os.path.join(root,'.test-tools','identity','face-inputs.json'),'w') as f:
    json.dump(out,f)
print('Prepared synthetic model test inputs.')
