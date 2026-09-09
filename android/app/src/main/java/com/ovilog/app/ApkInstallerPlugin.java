package com.ovilog.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Déclenche l'installeur système Android pour une mise à jour de l'appli
 * elle-même, distribuée hors Play Store (voir chantier "Mises à jour
 * automatiques In-App"). Le fichier .apk est déjà téléchargé et écrit dans
 * le cache de l'appli (côté JS, via @capacitor/filesystem, Directory.Cache
 * = context.getCacheDir(), exactement le même dossier que celui utilisé
 * ici) avant d'appeler install() -- ce plugin ne fait QUE l'exposer via le
 * FileProvider déjà configuré (AndroidManifest.xml / file_paths.xml,
 * utilisé jusqu'ici pour l'export du registre en .xlsx) et lancer l'intent
 * système d'installation. C'est ensuite Android, jamais ce code, qui
 * affiche l'écran de confirmation et décide d'installer -- rien ici ne
 * touche aux données de l'appli (localStorage/Firestore), qu'Android
 * préserve automatiquement lors d'une mise à jour par-dessus l'existant
 * (même applicationId + même clé de signature, déjà garantis par le
 * pipeline CI -- voir .github/workflows/build-apk.yml).
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    // Android 8 (API 26) a introduit l'autorisation "Installer des
    // applications inconnues", accordée par source (par appli), à la place
    // du réglage global "Sources inconnues" des versions antérieures --
    // en dessous de cette API, aucune vérification n'est nécessaire.
    @PluginMethod
    public void canRequestInstall(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            granted = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject ret = new JSObject();
        ret.put("value", granted);
        call.resolve(ret);
    }

    // Ouvre l'écran système où l'utilisateur active "Installer des
    // applications inconnues" pour Ovilog -- ne peut pas être accordée par
    // code, uniquement par l'utilisateur lui-même (protection Android). Sans
    // effet en dessous d'Android 8 (aucun écran équivalent nécessaire).
    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    // fileName : nom du fichier déjà présent dans le cache de l'appli
    // (context.getCacheDir(), le même dossier que Directory.Cache côté
    // @capacitor/filesystem -- voir writeFile appelé juste avant côté JS,
    // dans telechargerEtInstallerMiseAJour).
    @PluginMethod
    public void install(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || fileName.isEmpty()) {
            call.reject("fileName manquant");
            return;
        }
        File apkFile = new File(getContext().getCacheDir(), fileName);
        if (!apkFile.exists()) {
            call.reject("Fichier introuvable : " + fileName);
            return;
        }
        try {
            Uri apkUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apkFile);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Impossible de lancer l'installation : " + e.getMessage(), e);
        }
    }
}
