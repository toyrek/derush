import {Config} from '@remotion/cli/config';

// Les plans du pack sont visibles dans public/ (liens vers ../plans).
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
// Les effets d'optique (flou de zoom, filé, décalage des couleurs) passent par WebGL.
Config.setChromiumOpenGlRenderer('angle');
