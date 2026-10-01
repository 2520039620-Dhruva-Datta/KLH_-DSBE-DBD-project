# Synthetic biometric test fixtures

`synthetic-faces.png` was generated with imagegen for this project's model tests on 28 September 2026. All depicted adults are fictional. The first four tiles depict one synthetic subject at different poses; the last two are different synthetic subjects. No real citizen or Aadhaar data is represented.

`prepare-face-fixtures.py` crops the sheet, pads inputs, and creates quality variants, blur, blank and multiple-face cases. These fixtures exercise real YuNet/SFace/OpenVINO inference and server state transitions. They do **not** demonstrate certified presentation-attack detection or a physical webcam user's liveness. They are never substituted for a real frame by production code, and the server has no test-success flag.

When the face-mesh model is installed, the script also paints synthetic shut eyelids over the first portrait (using the mesh eye contour) to build `BLINK` (open/closed frames with three closures), `STARE` (no eyelid movement) and `CLOSED` inputs for the blink liveness step. Like the pose tiles, they exercise real inference and the protocol, not resistance to replayed video.
