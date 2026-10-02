package com.ovilog.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Export réellement accessible à l'éleveur (chantier "Export SAF") : le
 * dossier app-scoped où l'appli écrit ses sauvegardes (getExternalFilesDir,
 * sous Android/data) est masqué par le gestionnaire de fichiers depuis
 * Android 11 -- un fichier n'y est donc jamais "disponible" pour l'éleveur.
 * Ce plugin ouvre le sélecteur système "Enregistrer sous" (Storage Access
 * Framework, ACTION_CREATE_DOCUMENT : aucune permission de stockage requise,
 * sur aucune version d'Android) et y copie un fichier DÉJÀ écrit côté appli,
 * puis le relit via l'URI obtenue pour vérifier que la copie est complète.
 *
 * Volontairement, le contenu ne transite JAMAIS par les options de l'appel
 * natif : Capacitor sauvegarde ces options (JSON complet) dans l'état
 * d'instance de l'activité pendant que le sélecteur système est au premier
 * plan, et un Bundle trop volumineux fait planter l'appli
 * (TransactionTooLargeException). Seuls un dossier logique et un nom de
 * fichier source (quelques octets) sont passés ; le fichier lui-même est
 * écrit AVANT par @capacitor/filesystem (EXTERNAL ou CACHE). Conséquence
 * utile : si l'activité est détruite puis recréée pendant le sélecteur,
 * l'appel restauré par Capacitor contient toujours de quoi retrouver le
 * fichier source, et la copie peut aller à son terme.
 *
 * Aucune méthode de ce plugin ne touche aux données de l'appli
 * (localStorage, Firestore) : elle ne lit qu'un fichier source et n'écrit
 * que là où l'éleveur l'a choisi.
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    // Uniquement un nom de fichier direct dans l'un des deux dossiers
    // logiques connus -- jamais de chemin libre fourni par le JS.
    private File resolveSource(String directory, String path) {
        if (path == null || path.isEmpty() || path.contains("/") || path.contains("\\") || path.contains("..")) {
            return null;
        }
        File base;
        if ("CACHE".equals(directory)) {
            base = getContext().getCacheDir();
        } else if ("EXTERNAL".equals(directory)) {
            base = getContext().getExternalFilesDir(null);
        } else {
            return null;
        }
        if (base == null) return null;
        return new File(base, path);
    }

    // Les échecs d'exécution sont des résultats (ok:false + raison), jamais
    // un reject : même convention {ok, raison} que le reste du code JS, et
    // une annulation de l'éleveur n'est pas une erreur.
    private void resolveEchec(PluginCall call, String raison) {
        JSObject ret = new JSObject();
        ret.put("ok", false);
        ret.put("raison", raison);
        call.resolve(ret);
    }

    @PluginMethod
    public void saveAs(PluginCall call) {
        String directory = call.getString("directory");
        String path = call.getString("path");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        File source = resolveSource(directory, path);
        if (source == null || fileName == null || fileName.isEmpty()) {
            resolveEchec(call, "paramètres d'export invalides");
            return;
        }
        if (!source.isFile() || source.length() == 0) {
            resolveEchec(call, "le fichier source est introuvable ou vide");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        try {
            startActivityForResult(call, intent, "handleSaveAsResult");
        } catch (Exception e) {
            resolveEchec(call, "impossible d'ouvrir le sélecteur de fichiers du système (" + e.getMessage() + ")");
        }
    }

    @ActivityCallback
    private void handleSaveAsResult(PluginCall call, ActivityResult result) {
        Uri uri = null;
        if (result != null && result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            uri = result.getData().getData();
        }
        ContentResolver resolver = getContext().getContentResolver();

        // Activité recréée sans appel restaurable : on ne sait plus quoi
        // copier, et le sélecteur a déjà créé un document vide chez
        // l'éleveur -- le supprimer plutôt que de laisser un fichier vide
        // qui pourrait passer pour une vraie sauvegarde.
        if (call == null) {
            if (uri != null) supprimerDocument(resolver, uri);
            return;
        }

        File source = resolveSource(call.getString("directory"), call.getString("path"));
        boolean supprimerSource = Boolean.TRUE.equals(call.getBoolean("deleteSource", false));
        try {
            if (uri == null) {
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("cancelled", true);
                call.resolve(ret);
                return;
            }
            if (source == null || !source.isFile()) {
                supprimerDocument(resolver, uri);
                resolveEchec(call, "le fichier source a disparu avant la copie");
                return;
            }
            long attendu = source.length();
            long ecrits = 0;
            try (InputStream in = new FileInputStream(source); OutputStream out = resolver.openOutputStream(uri, "wt")) {
                if (out == null) throw new IOException("flux d'écriture indisponible");
                byte[] buffer = new byte[8192];
                int n;
                while ((n = in.read(buffer)) != -1) {
                    out.write(buffer, 0, n);
                    ecrits += n;
                }
                out.flush();
            } catch (Exception e) {
                supprimerDocument(resolver, uri);
                resolveEchec(call, "l'écriture dans l'emplacement choisi a échoué (" + e.getMessage() + ")");
                return;
            }
            long relus;
            try {
                relus = compterOctets(resolver, uri);
            } catch (Exception e) {
                resolveEchec(call, "la relecture de vérification a échoué (" + e.getMessage() + ")");
                return;
            }
            if (relus != attendu) {
                supprimerDocument(resolver, uri);
                resolveEchec(call, "le fichier relu (" + relus + " octets) ne correspond pas au fichier écrit (" + attendu + " octets)");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("uri", uri.toString());
            ret.put("taille", relus);
            String nom = nomAffiche(resolver, uri);
            if (nom != null) ret.put("nom", nom);
            call.resolve(ret);
        } finally {
            if (supprimerSource && source != null) {
                //noinspection ResultOfMethodCallIgnored
                source.delete();
            }
        }
    }

    // Relecture indépendante via l'URI (JS : vérifie taille et, pour le JSON,
    // les compteurs). asText : renvoie aussi le contenu en UTF-8 -- réservé
    // aux fichiers JSON de sauvegarde, jamais aux PDF/tableurs.
    @PluginMethod
    public void readUri(PluginCall call) {
        String uriStr = call.getString("uri");
        boolean asText = Boolean.TRUE.equals(call.getBoolean("asText", false));
        if (uriStr == null || uriStr.isEmpty()) {
            resolveEchec(call, "uri manquante");
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        try (InputStream in = resolver.openInputStream(Uri.parse(uriStr))) {
            if (in == null) {
                resolveEchec(call, "flux de lecture indisponible");
                return;
            }
            long total = 0;
            ByteArrayOutputStream tampon = asText ? new ByteArrayOutputStream() : null;
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) {
                total += n;
                if (tampon != null) tampon.write(buffer, 0, n);
            }
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("taille", total);
            if (tampon != null) ret.put("texte", new String(tampon.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(ret);
        } catch (Exception e) {
            resolveEchec(call, "lecture impossible (" + e.getMessage() + ")");
        }
    }

    private long compterOctets(ContentResolver resolver, Uri uri) throws IOException {
        try (InputStream in = resolver.openInputStream(uri)) {
            if (in == null) throw new IOException("flux de lecture indisponible");
            long total = 0;
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) total += n;
            return total;
        }
    }

    private void supprimerDocument(ContentResolver resolver, Uri uri) {
        try {
            DocumentsContract.deleteDocument(resolver, uri);
        } catch (Exception ignored) {
            // meilleur effort : le fournisseur peut refuser la suppression
        }
    }

    private String nomAffiche(ContentResolver resolver, Uri uri) {
        try (Cursor c = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
            // facultatif : sert seulement à afficher le nom choisi
        }
        return null;
    }
}
