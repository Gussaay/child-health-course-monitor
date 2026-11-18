package com.nchp.monitoring.app;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * "Share the app": hands this app's own installed APK to the Android share
 * sheet, so it can be sent by Bluetooth, WhatsApp, Nearby Share, email ...
 * No download is needed, so it also works offline. Each app (NCHP, EmONC,
 * ch-sudan) shares itself, because the APK is read from the running app.
 *
 * JavaScript: registerPlugin('AppShare').shareApk({ fileName, title, text }).
 */
@CapacitorPlugin(name = "AppShare")
public class AppSharePlugin extends Plugin {

    @PluginMethod
    public void shareApk(PluginCall call) {
        final Context context = getContext();
        final String title = call.getString("title", "");
        final String text = call.getString("text", "");
        String fileName = call.getString("fileName", "app.apk");
        fileName = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (!fileName.endsWith(".apk")) fileName = fileName + ".apk";
        final String outName = fileName;

        new Thread(() -> {
            try {
                File source = new File(context.getApplicationInfo().sourceDir);
                // FileProvider shares cache/ (res/xml/file_paths.xml). A
                // folder of its own keeps old copies from piling up.
                File dir = new File(context.getCacheDir(), "share-app");
                if (dir.exists()) {
                    File[] old = dir.listFiles();
                    if (old != null) for (File f : old) f.delete();
                } else {
                    dir.mkdirs();
                }
                File out = new File(dir, outName);
                try (InputStream in = new FileInputStream(source); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                }

                Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", out);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("application/vnd.android.package-archive");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                if (!text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
                if (!title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
                send.setClipData(ClipData.newRawUri(outName, uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(send, title.isEmpty() ? null : title);
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().runOnUiThread(() -> {
                    try {
                        getActivity().startActivity(chooser);
                        JSObject ret = new JSObject();
                        ret.put("size", out.length());
                        ret.put("version", versionName(context));
                        call.resolve(ret);
                    } catch (Exception e) {
                        call.reject("Could not open the share sheet: " + e.getMessage(), e);
                    }
                });
            } catch (Exception e) {
                call.reject("Could not prepare the app file: " + e.getMessage(), e);
            }
        }).start();
    }

    private static String versionName(Context context) {
        try {
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return info.versionName == null ? "" : info.versionName;
        } catch (Exception e) {
            return "";
        }
    }
}
