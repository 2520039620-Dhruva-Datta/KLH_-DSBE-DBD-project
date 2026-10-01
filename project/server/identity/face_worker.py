"""Bounded, server-only biometric inference. Frames live in memory for one request.

YuNet detection + SFace aligned embeddings (OpenCV Zoo). OpenVINO's retail
age model supplies a broad, uncertain age range; its gender output is ignored.
MediaPipe's face-mesh landmark model (run through OpenVINO) measures how open
the eyes are, which the blink liveness step compares across a frame sequence.
No enrollment/search gallery exists in this worker. It never writes images.
"""
import sys, json, base64, os, tempfile, shutil
os.environ['OPENCV_IO_MAX_IMAGE_WIDTH'] = '1920'
os.environ['OPENCV_IO_MAX_IMAGE_HEIGHT'] = '1080'
os.environ['OPENCV_IO_MAX_IMAGE_PIXELS'] = '2073600'
import cv2 as cv
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MODELS = os.environ.get('FACE_MODEL_DIR', os.path.join(ROOT, '.runtime', 'face-models'))
cv.setNumThreads(2)
detector = cv.FaceDetectorYN.create(os.path.join(MODELS, 'yunet.onnx'), '', (640, 480), 0.85, 0.3, 5000)
recognizer = cv.FaceRecognizerSF.create(os.path.join(MODELS, 'sface.onnx'), '')
age_model = None
mesh_model = None
try:
    # OpenVINO's Windows DLL loader does not handle this repository's long path.
    # Cache only installed runtime code in the user's temp directory, never frames.
    if os.name == 'nt':
        package = os.path.join(os.path.dirname(sys.executable),'Lib','site-packages','openvino')
        if len(package) > 180:
            short_runtime = os.path.join(tempfile.gettempdir(),'amap-ov-2025-2')
            target = os.path.join(short_runtime,'openvino')
            if not os.path.exists(os.path.join(target,'__init__.py')):
                shutil.copytree(package,target,dirs_exist_ok=True)
            sys.path.insert(0,short_runtime)
    from openvino import Core
    core = Core()
    age_model = core.compile_model(os.path.join(MODELS, 'age.xml'), 'CPU', {'INFERENCE_NUM_THREADS': 2})
except Exception:
    pass
try:
    mesh_model = core.compile_model(os.path.join(MODELS, 'face-mesh.tflite'), 'CPU', {'INFERENCE_NUM_THREADS': 2})
except Exception:
    pass

def fail(code):
    return {'ok': False, 'code': code}

# Face-mesh indices: eye corners, then upper/lower eyelid pairs, for each eye.
EYES = ((33, 133, ((160, 144), (159, 145), (158, 153))), (362, 263, ((385, 380), (386, 374), (387, 373))))

def mesh_points(image, center, size, angle):
    # Rotate a square of `size` pixels around `center` upright into the model's 256x256 input.
    c, s = np.cos(angle), np.sin(angle)
    m = np.array([[c, s, 0], [-s, c, 0]], np.float64) * (256 / size)
    m[:, 2] = 128 - m[:, :2] @ np.asarray(center, np.float64)
    crop = cv.warpAffine(image, m, (256, 256), flags=cv.INTER_LINEAR)
    tensor = cv.cvtColor(crop, cv.COLOR_BGR2RGB).astype(np.float32)[None] / 255
    points = mesh_model(tensor)[mesh_model.output(0)].reshape(-1, 3)[:, :2]
    inverse = cv.invertAffineTransform(m)
    return points @ inverse[:, :2].T + inverse[:, 2]

def eye_openness(image, face):
    """Mean eye aspect ratio (eyelid gap / eye width): about 0.3 open, under 0.15 closed."""
    if mesh_model is None:
        return None
    eyes = face[4:8].reshape(2, 2)
    x, y, w, h = face[:4]
    points = mesh_points(image, (x + w / 2, y + h / 2), max(w, h) * 1.5, np.arctan2(eyes[1, 1] - eyes[0, 1], eyes[1, 0] - eyes[0, 0]))
    # Refine from the first pass's landmark bounds, as MediaPipe's own tracker does.
    lo, hi = points.min(0), points.max(0)
    points = mesh_points(image, (lo + hi) / 2, float(max(hi - lo)) * 1.5, np.arctan2(points[263, 1] - points[33, 1], points[263, 0] - points[33, 0]))
    ratios = [np.mean([np.linalg.norm(points[u] - points[l]) for u, l in pairs]) / max(float(np.linalg.norm(points[a] - points[b])), 1e-6) for a, b, pairs in EYES]
    return round(float(np.mean(ratios)), 4)

# The on-screen oval as (centre x, centre y, radius x, radius y), as fractions of
# the frame. This default matches the guide on a 4:3 preview; clients send the
# oval as it actually maps onto their camera frame.
DEFAULT_AREA = (0.5, 0.487, 0.21, 0.36)
# A face counts as inside when its centre falls within the oval, with a little
# slack so a face touching the guide is not ignored.
AREA_SLACK = 1.15

def area(value):
    try:
        cx, cy, rx, ry = (float(value[k]) for k in ('cx', 'cy', 'rx', 'ry'))
    except Exception:
        return DEFAULT_AREA
    if not all(np.isfinite((cx, cy, rx, ry))):
        return DEFAULT_AREA
    return (min(max(cx, 0.2), 0.8), min(max(cy, 0.2), 0.8), min(max(rx, 0.08), 0.5), min(max(ry, 0.1), 0.6))

def inside(face, w, h, region):
    cx, cy, rx, ry = region
    fx, fy = (face[0] + face[2] / 2) / w, (face[1] + face[3] / 2) / h
    return ((fx - cx) / (rx * AREA_SLACK)) ** 2 + ((fy - cy) / (ry * AREA_SLACK)) ** 2 <= 1

def frame(source, region=DEFAULT_AREA):
    if not isinstance(source, str) or len(source) > 1100000 or not source.startswith(('data:image/jpeg;base64,', 'data:image/png;base64,')):
        return fail('INVALID_FRAME')
    raw = base64.b64decode(source.split(',', 1)[1], validate=True)
    image = cv.imdecode(np.frombuffer(raw, np.uint8), cv.IMREAD_COLOR)
    if image is None:
        return fail('INVALID_FRAME')
    h, w = image.shape[:2]
    if w < 320 or h < 240 or w > 1920 or h > 1080:
        return fail('RESOLUTION')
    detector.setInputSize((w, h))
    _, faces = detector.detect(image)
    if faces is None or len(faces) == 0:
        return fail('NO_FACE')
    # Only the verification area matters: people in the background outside the
    # oval are ignored rather than failing the check.
    faces = [f for f in faces if inside(f, w, h, region)]
    if len(faces) == 0:
        return fail('FACE_OUTSIDE')
    if len(faces) != 1:
        return fail('MULTIPLE_FACES')
    face = faces[0]
    x, y, fw, fh = face[:4]
    ratio = float(fw / w)
    if fw < 90 or ratio < 0.18:
        return fail('MOVE_CLOSER')
    if ratio > 0.70 or x < 0 or y < 0 or x+fw > w or y+fh > h:
        return fail('MOVE_BACK')
    crop = image[max(0,int(y)):min(h,int(y+fh)),max(0,int(x)):min(w,int(x+fw))]
    gray = cv.cvtColor(crop, cv.COLOR_BGR2GRAY)
    light = float(gray.mean())
    blur = float(cv.Laplacian(gray, cv.CV_64F).var())
    if light < 35 or light > 225:
        return fail('LIGHTING')
    if blur < 28:
        return fail('BLUR')
    eyes = face[4:8].reshape(2,2)
    eye_dist = float(np.linalg.norm(eyes[1]-eyes[0]))
    # The face box is already large enough, so very close-set eyes mean the head
    # is turned too far for reliable landmarks, not that the person looks away.
    if eye_dist < 25:
        return fail('TURN_LESS')
    yaw = float((face[8] - eyes[:,0].mean()) / eye_dist)
    roll = abs(float(eyes[1,1]-eyes[0,1])) / eye_dist
    if abs(yaw) > 0.8:
        return fail('TURN_LESS')
    if roll > 0.35:
        return fail('LEVEL_HEAD')
    # Bounded exposure correction only; never synthesize detail or upsample tiny faces.
    corrected = image
    adjusted = False
    if light < 75:
        corrected = cv.convertScaleAbs(image, alpha=min(1.25,85/max(light,1)), beta=3)
        adjusted = True
    aligned = recognizer.alignCrop(corrected, face)
    embedding = recognizer.feature(aligned).reshape(-1).astype(float)
    embedding /= max(float(np.linalg.norm(embedding)), 1e-8)
    age = None
    if age_model is not None and abs(yaw) < 0.3:
        age_input = cv.resize(crop, (62,62)).transpose(2,0,1)[None].astype(np.float32)
        result = age_model(age_input)
        for output, value in result.items():
            if 'age_conv3' in output.get_any_name():
                estimated = float(value.reshape(-1)[0]) * 100
                age = [max(0, round(estimated-12)), min(100, round(estimated+12))]
    try:
        eyes = eye_openness(image, face)
    except Exception:
        eyes = None
    return {'ok':True, 'embedding':embedding.tolist(), 'yaw':yaw, 'size':ratio,
            'quality':round(min(1,blur/200)*0.6 + (1-abs(light-128)/128)*0.4,4),
            'age_range':age, 'preprocessed':adjusted, 'eyes':eyes}

print(json.dumps({'ready':True,'age_available':age_model is not None,'blink_available':mesh_model is not None}), flush=True)
def safe_frame(source, region):
    # One undecodable frame must not discard the rest of the batch.
    try:
        return frame(source, region)
    except Exception:
        return fail('MODEL_ERROR')

for line in sys.stdin:
    request_id=None
    try:
        request=json.loads(line)
        request_id=request.get('id')
        images=request.get('frames',[])
        # Pose steps send a handful of frames; the blink step sends a short sequence.
        if not isinstance(images,list) or not 1 <= len(images) <= 24:
            response=fail('INVALID_FRAME_COUNT')
        else:
            region=area(request.get('region'))
            response={'results':[safe_frame(s,region) for s in images]}
        print(json.dumps({'id':request_id,**response}, separators=(',',':')),flush=True)
    except Exception:
        print(json.dumps({'id':request_id,'ok':False,'code':'MODEL_ERROR'}),flush=True)
