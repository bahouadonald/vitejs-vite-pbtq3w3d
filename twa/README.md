# Build Android TWA — Doniel Zik (art.doniel.twa)

Application : Trusted Web Activity générée par Bubblewrap, hébergée sur https://doniel.art.

## Ce qui est versionné

Seuls `twa/twa-manifest.json` (configuration de la TWA) et ce fichier sont suivis dans Git.
Le projet Android (`twa/app/`, wrapper Gradle, `local.properties`), le keystore et les
artefacts de build sont ignorés : ils se régénèrent avec `bubblewrap update` puis
`bubblewrap build`. **Le keystore et son mot de passe doivent être sauvegardés à part.**

## Configuration de la machine

- `~/.bubblewrap/config.json` — JDK 17 (via la jonction `C:\Users\Arosoftstech\JDK17`, créée car Bubblewrap casse sur les chemins contenant un espace) et SDK Android.
- `twa/local.properties` — `sdk.dir` et `org.gradle.java.home` pour Gradle.

## Build

Depuis le dossier `twa/` :

```bash
export BUBBLEWRAP_KEYSTORE_PASSWORD=$(cat .keystore-password.txt)
export BUBBLEWRAP_KEY_PASSWORD=$(cat .keystore-password.txt)
bubblewrap update --skipVersionUpgrade   # régénère le projet (optionnel)
bubblewrap build                          # produit APK signé + AAB
```

Si `jarsigner` n'est pas trouvé (bug d'environnement Git Bash), signer l'AAB à la main
avec le PATH du JDK :

```bash
export PATH="/c/Users/Arosoftstech/JDK17/bin:$PATH"
jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore doniel-zik.keystore \
  app/build/outputs/bundle/release/app-release.aab doniel \
  -storepass "$BUBBLEWRAP_KEYSTORE_PASSWORD" -keypass "$BUBBLEWRAP_KEY_PASSWORD" \
  -signedjar app-release-bundle.aab
```

Cible : `compileSdkVersion 36` / `targetSdkVersion 36` (Android 16), généré par le
template Bubblewrap 1.27 (`node_modules/@bubblewrap/core/template_project/app/build.gradle`).

## Clé de signature

- `twa/doniel-zik.keystore` — NOUVELLE clé d'upload (alias `doniel`), validité 10 000 jours.
- Empreinte SHA-256 : `3F:5A:F8:96:57:03:70:DD:39:0C:25:89:88:96:16:AA:A8:BE:E6:82:51:5F:94:A5:20:3C:D5:13:5B:5F:93:CB`
- Le mot de passe est dans `twa/.keystore-password.txt`.

⚠️ **Ces deux fichiers sont vitales** : sans eux, impossible de signer les futures mises
à jour. Les sauvegarder hors du dépôt (ils sont volontairement absents de Git).

## Publication (une fois, pour la nouvelle clé)

1. Play Console → *Configuration* → *Signature de l'application* → demander une
   **réinitialisation de la clé d'upload** (motif : perte de la clé d'origine).
2. Une fois la nouvelle clé enregistrée, uploader `builds-android/doniel-zik-1.0.6.aab`.
3. Mettre à jour `https://doniel.art/.well-known/assetlinks.json` (déployée automatiquement
   avec la version mise à jour de `public/.well-known/assetlinks.json`, qui contient déjà la
   nouvelle empreinte) pour que les liens profonds restent validés.
4. Dans Play Console → *App content* → *Deep links*, vérifier la validation du domaine
   `doniel.art`.
