// Dérush — lanceur natif de Dérush.app (Contents/MacOS/Derush).
//
// Pourquoi un programme et pas directement un script : macOS traite une app dont l'exécutable est un script
// comme une app Intel (elle passe par Rosetta), et peut refuser de l'ouvrir. Ce petit programme natif
// (arm64 + x86_64) lance simplement le vrai lanceur, Contents/Resources/lanceur.sh, avec zsh.
//
// Compilation (faite par « node derush.mjs construire-app » si outils/lanceur-mac manque) :
//   clang -O2 -arch arm64 -arch x86_64 -mmacosx-version-min=13.0 -o outils/lanceur-mac outils/lanceur.c
#include <limits.h>
#include <mach-o/dyld.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

int main(void) {
  char brut[PATH_MAX], vrai[PATH_MAX], script[PATH_MAX];
  uint32_t n = sizeof brut;
  if (_NSGetExecutablePath(brut, &n) != 0 || !realpath(brut, vrai)) return 1;
  // …/Dérush.app/Contents/MacOS/Derush → …/Dérush.app/Contents
  for (int k = 0; k < 2; k++) {
    char *s = strrchr(vrai, '/');
    if (!s) return 1;
    *s = '\0';
  }
  snprintf(script, sizeof script, "%s/Resources/lanceur.sh", vrai);
  char *args[] = {"/bin/zsh", script, NULL};
  execv("/bin/zsh", args);
  perror("Dérush : impossible de lancer /bin/zsh");
  return 1;
}
