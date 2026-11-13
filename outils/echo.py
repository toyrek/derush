# Dérush — réduire l'écho d'une voix (la réverbération d'une pièce) : WPE, prédiction linéaire pondérée et retardée.
# Pour chaque fréquence, on prédit la traîne d'écho à partir des instants précédents, puis on la retire. Méthode
# classique (Nakatani, Yoshioka), sans réseau de neurones ni téléchargement : numpy et scipy suffisent.
#   python echo.py entree.wav sortie.wav
# Écrit « progress=NN% » sur la sortie d'erreur. Traite par morceaux de 30 s (avec un recouvrement) pour garder peu de
# mémoire, même sur une heure de son.
import sys
import numpy as np
import soundfile as sf
from scipy.signal import stft, istft

TAPS, DELAI, NFFT, PAS, TOURS = 20, 2, 2048, 512, 3


def wpe(y, sr):
    _, _, Y = stft(y, sr, nperseg=NFFT, noverlap=NFFT - PAS)
    F, T = Y.shape
    X = Y.copy()
    Yt = np.zeros((F, T, TAPS), dtype=np.complex64)
    for k in range(TAPS):
        s = DELAI + k
        if s < T:
            Yt[:, s:, k] = Y[:, : T - s]
    for _ in range(TOURS):
        w = 1.0 / np.maximum(np.abs(X) ** 2, 1e-10)
        R = np.einsum('ft,ftk,ftl->fkl', w, Yt, Yt.conj())
        r = np.einsum('ft,ftk,ft->fk', w, Yt, Y.conj())
        R += 1e-4 * np.trace(R, axis1=1, axis2=2)[:, None, None].real / TAPS * np.eye(TAPS)
        g = np.linalg.solve(R, r[..., None])[..., 0]
        X = Y - np.einsum('fk,ftk->ft', g.conj(), Yt)
    _, x = istft(X, sr, nperseg=NFFT, noverlap=NFFT - PAS)
    return x[: len(y)]


def main(entree, sortie):
    y, sr = sf.read(entree, dtype='float32', always_2d=True)
    morceau, bord = 30 * sr, 2 * sr
    sortie_son = np.zeros_like(y)
    n = len(y)
    debuts = list(range(0, n, morceau)) or [0]
    for i, d in enumerate(debuts):
        a, b = max(0, d - bord), min(n, d + morceau + bord)
        for c in range(y.shape[1]):
            x = wpe(y[a:b, c].astype(np.float64), sr)
            sortie_son[d:min(n, d + morceau), c] = x[d - a: d - a + min(morceau, n - d)]
        print(f'progress={int(100 * (i + 1) / len(debuts))}%', file=sys.stderr, flush=True)
    sf.write(sortie, sortie_son, sr, subtype='FLOAT')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
