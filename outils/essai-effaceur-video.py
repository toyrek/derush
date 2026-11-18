# Dérush — pour outils/essai-effaceur.mjs : deux vidéos de 2 s (540×960, 30 i/s, avec du son), le fond seul (la
# référence) et le même fond avec un sous-titre incrusté façon appli (blanc, contour noir). Lancé avec le Python de Dérush.
#   python essai-effaceur-video.py <dossier> [ffmpeg]
import subprocess, sys, numpy as np, cv2
dossier = sys.argv[1]
FFMPEG = sys.argv[2] if len(sys.argv) > 2 else 'ffmpeg'
W, H, N = 540, 960, 60
yy, xx = np.mgrid[0:H, 0:W]
def fond(i):
    r = (np.sin(xx / 37 + i / 9) * 60 + 110 + yy / H * 60).astype(np.uint8)
    g = (np.cos(yy / 29 - i / 11) * 50 + 120).astype(np.uint8)
    b = ((xx + yy + i * 4) % 160 + 60).astype(np.uint8)
    return np.dstack([r, g, b])
def ecrire(nom, texte):
    p = subprocess.Popen([FFMPEG, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', '30', '-i', '-', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=2', '-shortest', '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f'{dossier}/{nom}'], stdin=subprocess.PIPE)
    for i in range(N):
        im = fond(i).copy()
        if texte:
            for (t, y) in [('ON EST A OSAKA', 760), ('AVEC LES JEUNES', 815)]:
                cv2.putText(im, t, (60, y), cv2.FONT_HERSHEY_DUPLEX, 1.5, (0, 0, 0), 9, cv2.LINE_AA)
                cv2.putText(im, t, (60, y), cv2.FONT_HERSHEY_DUPLEX, 1.5, (255, 255, 255), 3, cv2.LINE_AA)
        p.stdin.write(im.tobytes())
    p.stdin.close(); p.wait()
ecrire('fond.mp4', False)
ecrire('incruste.mp4', True)
