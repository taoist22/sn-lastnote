package com.lastnote;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.text.TextUtils;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.os.storage.StorageManager;
import android.os.storage.StorageVolume;
import androidx.core.content.ContextCompat;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ScrollView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class LastNoteModule extends ReactContextBaseJavaModule
        implements LifecycleEventListener {

    private static final String TAG              = "LastNoteModule";
    private static final String FILE_HERE        = "ln_here.txt";
    private static final String FILE_THERE       = "ln_there.txt";
    private static final String EVENT_TAP        = "onFloatingToggleTap";
    private static final String EVENT_LONG_PRESS = "onFloatingLongPress";
    private static final String EVENT_PRESET     = "onPresetSelected";
    private static final long   LONG_PRESS_MS    = 600;

    // Static singleton — survives JS reloads within PluginHost process
    private static View          sFloatingView  = null;
    private static View          sPopupView     = null;
    private static WindowManager sWindowManager = null;
    private static int           sSavedX        = 80;
    private static int           sSavedY        = 400;

    private final ReactApplicationContext reactContext;
    private final SharedPreferences overlayPreferences;

    LastNoteModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
        overlayPreferences = context.getSharedPreferences("lastnote_overlay_settings", Context.MODE_PRIVATE);
        if (overlayPreferences.getBoolean("rememberPosition", false)) {
            sSavedX = overlayPreferences.getInt("x", 80);
            sSavedY = overlayPreferences.getInt("y", 400);
        } else {
            sSavedX = 80;
            sSavedY = 400;
        }
        reactContext.addLifecycleEventListener(this);
    }

    @Override public String getName() { return "LastNote"; }

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    @Override public void onHostResume() {}
    @Override public void onHostPause()  {}

    @Override
    public void onHostDestroy() {
        // Fired when plugin is toggled OFF in Supernote's plugin manager
        hidePopupInternal();
        hideOverlayInternal();
        reactContext.removeLifecycleEventListener(this);
    }

    @ReactMethod
    public void getOverlaySettings(Promise promise) {
        WritableMap settings = Arguments.createMap();
        settings.putBoolean("rememberPosition", overlayPreferences.getBoolean("rememberPosition", false));
        settings.putBoolean("restoreOnLoad", overlayPreferences.getBoolean("restoreOnLoad", false));
        promise.resolve(settings);
    }

    @ReactMethod
    public void setOverlaySettings(boolean rememberPosition, boolean restoreOnLoad, Promise promise) {
        reactContext.runOnUiQueueThread(() -> {
            SharedPreferences.Editor editor = overlayPreferences.edit()
                    .putBoolean("rememberPosition", rememberPosition)
                    .putBoolean("restoreOnLoad", restoreOnLoad);
            if (rememberPosition) {
                editor.putInt("x", sSavedX).putInt("y", sSavedY);
            } else {
                editor.remove("x").remove("y");
            }
            if (editor.commit()) promise.resolve(true);
            else promise.reject("SETTINGS_SAVE_FAILED", "Could not save floating button settings.");
        });
    }

    // ─── Floating overlay ────────────────────────────────────────────────────

    @ReactMethod
    public void showOverlay(Promise promise) {
        reactContext.runOnUiQueueThread(() -> {
        try {
            hideOverlayInternal(); // clear any ghost first

            Context appCtx = reactContext.getApplicationContext();
            sWindowManager = (WindowManager) appCtx.getSystemService(Context.WINDOW_SERVICE);

            // Medium grey oval — not too light, not too dark
            GradientDrawable bg = new GradientDrawable();
            bg.setShape(GradientDrawable.OVAL);
            bg.setColor(Color.argb(220, 115, 115, 115));
            bg.setStroke(2, Color.argb(255, 60, 60, 60));

            DisplayMetrics dm = appCtx.getResources().getDisplayMetrics();
            float ydpi = dm.ydpi > 0 ? dm.ydpi : (float) dm.densityDpi;
            int sizePx = Math.round(8.0f * (ydpi / 25.4f));
            if (sizePx < 50) sizePx = 72; // fallback safety
            int paddingPx = Math.max(4, Math.round(sizePx * 0.12f));

            ImageView btn = new ImageView(appCtx);
            btn.setBackground(bg);
            btn.setImageResource(android.R.drawable.ic_menu_revert);
            btn.setColorFilter(Color.WHITE);
            btn.setPadding(paddingPx, paddingPx, paddingPx, paddingPx);
            btn.setContentDescription("LastNote toggle");

            final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    sizePx, sizePx,
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.TOP | Gravity.START;
            params.x = Math.max(0, Math.min(sSavedX, dm.widthPixels - sizePx));
            params.y = Math.max(0, Math.min(sSavedY, dm.heightPixels - sizePx));
            sSavedX = params.x;
            sSavedY = params.y;

            final int maxX = Math.max(0, dm.widthPixels - sizePx);
            final int maxY = Math.max(0, dm.heightPixels - sizePx);
            btn.setOnTouchListener(new View.OnTouchListener() {
                private int     initX, initY, initTouchX, initTouchY;
                private boolean dragging      = false;
                private long    downEventTime = 0;

                @Override
                public boolean onTouch(View v, MotionEvent ev) {
                    int tool = ev.getToolType(0);
                    if (tool == MotionEvent.TOOL_TYPE_STYLUS
                            || tool == MotionEvent.TOOL_TYPE_ERASER) {
                        return false; // pass through to note canvas
                    }

                    switch (ev.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            initX         = params.x;
                            initY         = params.y;
                            initTouchX    = (int) ev.getRawX();
                            initTouchY    = (int) ev.getRawY();
                            downEventTime = ev.getEventTime();
                            dragging      = false;
                            return true;

                        case MotionEvent.ACTION_MOVE:
                            int dx = (int) ev.getRawX() - initTouchX;
                            int dy = (int) ev.getRawY() - initTouchY;
                            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                                dragging = true;
                                params.x = Math.max(0, Math.min(initX + dx, maxX));
                                params.y = Math.max(0, Math.min(initY + dy, maxY));
                                if (sWindowManager != null && sFloatingView != null) {
                                    sWindowManager.updateViewLayout(sFloatingView, params);
                                }
                            }
                            return true;

                        case MotionEvent.ACTION_UP:
                            sSavedX = params.x;
                            sSavedY = params.y;
                            if (overlayPreferences.getBoolean("rememberPosition", false)) {
                                overlayPreferences.edit().putInt("x", sSavedX).putInt("y", sSavedY).apply();
                            }
                            if (!dragging) {
                                long held = ev.getEventTime() - downEventTime;
                                sendEvent(held >= LONG_PRESS_MS ? EVENT_LONG_PRESS : EVENT_TAP);
                            }
                            return true;
                    }
                    return false;
                }
            });

            sFloatingView = btn;
            sWindowManager.addView(sFloatingView, params);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "showOverlay failed", e);
            promise.reject("OVERLAY_SHOW_FAILED", e);
        }
        });
    }

    @ReactMethod
    public void hideOverlay(Promise promise) {
        try {
            hidePopupInternal();
            hideOverlayInternal();
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "hideOverlay failed", e);
            promise.reject("OVERLAY_HIDE_FAILED", e);
        }
    }

    @ReactMethod
    public void isOverlayShowing(Promise promise) {
        promise.resolve(sFloatingView != null);
    }

    private void hideOverlayInternal() {
        hidePopupInternal();
        if (sWindowManager != null && sFloatingView != null) {
            try { sWindowManager.removeView(sFloatingView); } catch (Exception ignored) {}
            sFloatingView = null;
        }
    }

    // ─── Native Presets Popup Window ─────────────────────────────────────────

    @ReactMethod
    public void showPresetPopup(ReadableArray items, Promise promise) {
        reactContext.runOnUiQueueThread(() -> {
        try {
            hidePopupInternal();
            Context appCtx = reactContext.getApplicationContext();
            if (sWindowManager == null) {
                sWindowManager = (WindowManager) appCtx.getSystemService(Context.WINDOW_SERVICE);
            }

            DisplayMetrics dm = appCtx.getResources().getDisplayMetrics();
            float density = dm.density > 0 ? dm.density : 1.5f;
            int margin = Math.round(12 * density);
            int popupWidth = Math.min(Math.round(320 * density), dm.widthPixels - 2 * margin);

            LinearLayout container = new LinearLayout(appCtx);
            container.setOrientation(LinearLayout.VERTICAL);

            GradientDrawable bg = new GradientDrawable();
            bg.setColor(Color.WHITE);
            bg.setCornerRadius(10 * density);
            bg.setStroke((int) (2.5f * density), Color.BLACK);
            container.setBackground(bg);
            int pPad = (int) (6 * density);
            container.setPadding(pPad, pPad, pPad, pPad);

            for (int i = 0; i < items.size(); i++) {
                ReadableMap item = items.getMap(i);
                final String name = item.hasKey("name") ? item.getString("name") : "Note";
                final String path = item.hasKey("path") ? item.getString("path") : "";
                final int page = item.hasKey("page") ? item.getInt("page") : 0;
                final String label = item.hasKey("label") && !item.isNull("label") ? item.getString("label") : null;

                TextView tv = new TextView(appCtx);
                String pageSuffix = page > 0 ? " (p." + page + ")" : " (last viewed)";
                String labelDisplay = (!TextUtils.isEmpty(label)) ? " - " + label : "";
                tv.setText(name + pageSuffix + labelDisplay);
                tv.setTextSize(17);
                tv.setTextColor(Color.BLACK);
                int hPad = (int) (14 * density);
                int vPad = (int) (14 * density);
                tv.setPadding(hPad, vPad, hPad, vPad);

                // Dividers
                if (i > 0) {
                    View line = new View(appCtx);
                    line.setBackgroundColor(Color.argb(60, 0, 0, 0));
                    container.addView(line, new LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT, (int) (1 * density)));
                }

                tv.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        hidePopupInternal();
                        sendTargetEvent(EVENT_PRESET, path, page);
                    }
                });

                container.addView(tv);
            }

            TextView close = new TextView(appCtx);
            close.setText("Close");
            close.setTextColor(Color.BLACK);
            close.setTextSize(17);
            close.setPadding(pPad * 2, pPad * 2, pPad * 2, pPad * 2);
            close.setOnClickListener(v -> hidePopupInternal());
            container.addView(close, 0);
            ScrollView scroll = new ScrollView(appCtx);
            scroll.addView(container);
            int maxHeight = Math.max(1, dm.heightPixels - 2 * margin);
            container.measure(View.MeasureSpec.makeMeasureSpec(popupWidth, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
            int popupHeight = Math.min(container.getMeasuredHeight(), Math.min(maxHeight, Math.round(dm.heightPixels * 0.65f)));
            final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    popupWidth,
                    popupHeight,
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.TOP | Gravity.START;
            params.x = Math.max(margin, Math.min(sSavedX, dm.widthPixels - popupWidth - margin));
            params.y = Math.max(margin, Math.min(sSavedY + 80, dm.heightPixels - popupHeight - margin));

            sPopupView = scroll;
            sWindowManager.addView(sPopupView, params);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "showPresetPopup failed", e);
            promise.reject("POPUP_FAILED", e);
        }
        });
    }

    @ReactMethod
    public void hidePopup(Promise promise) {
        hidePopupInternal();
        promise.resolve(true);
    }

    private void hidePopupInternal() {
        if (sWindowManager != null && sPopupView != null) {
            try { sWindowManager.removeView(sPopupView); } catch (Exception ignored) {}
            sPopupView = null;
        }
    }

    private void sendEvent(String name) {
        try {
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(name, null);
        } catch (Exception e) {
            Log.e(TAG, "sendEvent failed: " + name, e);
        }
    }

    private void sendTargetEvent(String name, String path, int page) {
        try {
            WritableMap target = Arguments.createMap();
            target.putString("path", path);
            target.putInt("page", page);
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(name, target);
        } catch (Exception e) {
            Log.e(TAG, "sendTargetEvent failed: " + name, e);
            // Preserve navigation if JavaScript is temporarily unavailable.
            if (path != null && path.toLowerCase().endsWith(".note")) {
                openNoteInternal(path, page);
            } else {
                openDocumentInternal(path, page);
            }
        }
    }

    // ─── Storage ─────────────────────────────────────────────────────────────

    @ReactMethod
    public void writePair(String here, String there, Promise promise) {
        try {
            writeFile(FILE_HERE, here  != null ? here  : "");
            writeFile(FILE_THERE, there != null ? there : "");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "writePair failed", e);
            promise.reject("WRITE_PAIR_FAILED", e);
        }
    }

    @ReactMethod
    public void readHere(Promise promise) {
        try { promise.resolve(readFile(FILE_HERE)); }
        catch (Exception e) { promise.reject("READ_HERE_FAILED", e); }
    }

    @ReactMethod
    public void readThere(Promise promise) {
        try { promise.resolve(readFile(FILE_THERE)); }
        catch (Exception e) { promise.reject("READ_THERE_FAILED", e); }
    }

    @ReactMethod
    public void readFavorites(Promise promise) {
        try { promise.resolve(readFile("ln_favorites.txt")); }
        catch (Exception e) { promise.reject("READ_FAV_FAILED", e); }
    }

    @ReactMethod
    public void writeFavorites(String json, Promise promise) {
        try {
            writeFile("ln_favorites.txt", json != null ? json : "[]");
            promise.resolve(true);
        } catch (Exception e) { promise.reject("WRITE_FAV_FAILED", e); }
    }

    @ReactMethod
    public void readFavoriteFiles(Promise promise) {
        try { promise.resolve(readFile("ln_fav_files.txt")); }
        catch (Exception e) { promise.reject("READ_FAV_FILES_FAILED", e); }
    }

    @ReactMethod
    public void writeFavoriteFiles(String json, Promise promise) {
        try {
            writeFile("ln_fav_files.txt", json != null ? json : "[]");
            promise.resolve(true);
        } catch (Exception e) { promise.reject("WRITE_FAV_FILES_FAILED", e); }
    }

    @ReactMethod
    public void readPresets(Promise promise) {
        try { promise.resolve(readFile("ln_presets.txt")); }
        catch (Exception e) { promise.reject("READ_PRESETS_FAILED", e); }
    }

    @ReactMethod
    public void writePresets(String json, Promise promise) {
        try {
            writeFile("ln_presets.txt", json != null ? json : "[]");
            promise.resolve(true);
        } catch (Exception e) { promise.reject("WRITE_PRESETS_FAILED", e); }
    }

    @ReactMethod
    public void readRecentFolders(Promise promise) {
        try { promise.resolve(readFile("ln_recent_folders.txt")); }
        catch (Exception e) { promise.reject("READ_RECENT_FOLDERS_FAILED", e); }
    }

    @ReactMethod
    public void writeRecentFolders(String json, Promise promise) {
        try {
            writeFile("ln_recent_folders.txt", json != null ? json : "[]");
            promise.resolve(true);
        } catch (Exception e) { promise.reject("WRITE_RECENT_FOLDERS_FAILED", e); }
    }

    @ReactMethod
    public void readPageLocks(Promise promise) {
        try { promise.resolve(readFile("ln_pagelocks.txt")); }
        catch (Exception e) { promise.reject("READ_PAGELOCKS_FAILED", e); }
    }

    @ReactMethod
    public void writePageLocks(String json, Promise promise) {
        try {
            writeFile("ln_pagelocks.txt", json != null ? json : "{}");
            promise.resolve(true);
        } catch (Exception e) { promise.reject("WRITE_PAGELOCKS_FAILED", e); }
    }

    private void writeFile(String name, String content) throws Exception {
        File f = new File(reactContext.getFilesDir(), name);
        FileOutputStream out = new FileOutputStream(f, false);
        try { out.write(content.getBytes(StandardCharsets.UTF_8)); out.flush(); }
        finally { out.close(); }

        // External backup copy in MyStyle (survives plugin uninstalls and updates!)
        try {
            File backupDir = new File("/storage/emulated/0/MyStyle/LastNote");
            if (!backupDir.exists()) backupDir.mkdirs();
            File backupFile = new File(backupDir, name);
            FileOutputStream bOut = new FileOutputStream(backupFile, false);
            try { bOut.write(content.getBytes(StandardCharsets.UTF_8)); bOut.flush(); }
            finally { bOut.close(); }
        } catch (Exception ignored) {}
    }

    private String readFile(String name) throws Exception {
        File f = new File(reactContext.getFilesDir(), name);
        if (!f.exists() || f.length() == 0) {
            // Auto-restore from MyStyle backup if internal storage was cleared by uninstall
            File backupFile = new File("/storage/emulated/0/MyStyle/LastNote", name);
            if (backupFile.exists() && backupFile.length() > 0) {
                f = backupFile;
            } else {
                return null;
            }
        }
        byte[] buf = new byte[(int) f.length()];
        FileInputStream in = new FileInputStream(f);
        try {
            int n = in.read(buf);
            String val = n > 0 ? new String(buf, 0, n, StandardCharsets.UTF_8).trim() : null;
            return (val != null && !val.isEmpty()) ? val : null;
        } finally { in.close(); }
    }

    // ─── Directory listing for folder-navigation file picker ─────────────────

    @ReactMethod
    public void listRootDirectories(Promise promise) {
        try {
            WritableArray result = Arguments.createArray();

            // 1. Explicit known Supernote directories (accessible under Scoped Storage)
            String[] knownPaths = {
                "/storage/emulated/0/Note",
                "/storage/emulated/0/Document",
                "/storage/emulated/0/MyStyle",
                "/storage/emulated/0/EXPORT",
                "/storage/emulated/0/IMPORT",
                "/storage/emulated/0/INBOX"
            };

            for (String p : knownPaths) {
                File f = new File(p);
                if (f.exists() && f.isDirectory()) {
                    WritableMap entry = Arguments.createMap();
                    entry.putString("name", f.getName());
                    entry.putString("path", f.getAbsolutePath());
                    entry.putBoolean("isDir", true);
                    entry.putBoolean("isSdCard", false);
                    result.pushMap(entry);
                }
            }

            // 2. Discover real removable SD Card volumes only
            List<File> sdCardDirs = new ArrayList<>();

            // A. StorageManager getStorageVolumes — most reliable on Android 7+ (API 24+)
            try {
                StorageManager sm = (StorageManager) reactContext.getSystemService(Context.STORAGE_SERVICE);
                if (sm != null) {
                    List<StorageVolume> volumes = sm.getStorageVolumes();
                    for (StorageVolume vol : volumes) {
                        if (!vol.isRemovable()) continue;
                        File volDir = null;
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                            volDir = vol.getDirectory();
                        }
                        if (volDir != null && volDir.exists() && volDir.canRead() && !sdCardDirs.contains(volDir)) {
                            sdCardDirs.add(volDir);
                        }
                    }
                }
            } catch (Exception ignored) {}

            // B. ContextCompat.getExternalFilesDirs — returns app-sandboxed paths for all volumes
            if (sdCardDirs.isEmpty()) {
                File[] extDirs = ContextCompat.getExternalFilesDirs(reactContext, null);
                if (extDirs != null) {
                    for (File f : extDirs) {
                        if (f == null) continue;
                        String path = f.getAbsolutePath();
                        // Skip the primary internal storage
                        if (path.contains("/emulated/")) continue;
                        int idx = path.indexOf("/Android/data");
                        if (idx > 0) {
                            File sdRoot = new File(path.substring(0, idx));
                            if (sdRoot.exists() && sdRoot.canRead() && !sdCardDirs.contains(sdRoot)) {
                                sdCardDirs.add(sdRoot);
                            }
                        }
                    }
                }
            }

            // C. Last resort: scan /storage/ for UUID-format dirs only (e.g. 69D8-7B85)
            if (sdCardDirs.isEmpty()) {
                File storageRoot = new File("/storage");
                File[] vols = storageRoot.listFiles();
                if (vols != null) {
                    for (File v : vols) {
                        if (!v.isDirectory()) continue;
                        String n = v.getName();
                        // UUID format: 4 hex chars, dash, 4 hex chars
                        if (n.matches("[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}") && v.canRead()) {
                            if (!sdCardDirs.contains(v)) {
                                sdCardDirs.add(v);
                            }
                        }
                    }
                }
            }

            // Deduplicate by canonical path and push into result
            List<String> seenPaths = new ArrayList<>();
            for (File sd : sdCardDirs) {
                try {
                    String canon = sd.getCanonicalPath();
                    if (seenPaths.contains(canon)) continue;
                    seenPaths.add(canon);
                    WritableMap entry = Arguments.createMap();
                    entry.putString("name", "SD Card (" + sd.getName() + ")");
                    entry.putString("path", sd.getAbsolutePath());
                    entry.putBoolean("isDir", true);
                    entry.putBoolean("isSdCard", true);
                    result.pushMap(entry);
                } catch (Exception ignored) {}
            }

            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "listRootDirectories failed", e);
            promise.reject("ROOT_LIST_FAILED", e);
        }
    }

    @ReactMethod
    public void listDirectory(String dirPath, Promise promise) {
        try {
            File dir = new File(dirPath);
            if (!dir.exists() || !dir.isDirectory()) {
                promise.reject("NOT_A_DIR", dirPath + " is not a directory");
                return;
            }
            File[] files = dir.listFiles();
            if (files == null) files = new File[0];

            final String[] exts = {".note", ".pdf", ".epub", ".cbz", ".xps", ".fb2"};

            // Folders first, then supported files, both alpha-sorted
            Arrays.sort(files, (a, b) -> {
                if (a.isDirectory() != b.isDirectory())
                    return a.isDirectory() ? -1 : 1;
                return a.getName().compareToIgnoreCase(b.getName());
            });

            WritableArray result = Arguments.createArray();
            for (File f : files) {
                if (f.getName().startsWith(".")) continue; // skip hidden
                if (f.isDirectory()) {
                    WritableMap entry = Arguments.createMap();
                    entry.putString("name", f.getName());
                    entry.putString("path", f.getAbsolutePath());
                    entry.putBoolean("isDir", true);
                    result.pushMap(entry);
                } else {
                    String lower = f.getName().toLowerCase();
                    for (String ext : exts) {
                        if (lower.endsWith(ext)) {
                            WritableMap entry = Arguments.createMap();
                            entry.putString("name", f.getName());
                            entry.putString("path", f.getAbsolutePath());
                            entry.putBoolean("isDir", false);
                            result.pushMap(entry);
                            break;
                        }
                    }
                }
            }
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "listDirectory failed", e);
            promise.reject("LIST_DIR_FAILED", e);
        }
    }

    // ─── Navigation ──────────────────────────────────────────────────────────

    @ReactMethod
    public void openNoteWithPage(String filePath, int page, Promise promise) {
        try {
            openNoteInternal(filePath, page);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "openNoteWithPage failed", e);
            promise.reject("OPEN_NOTE_FAILED", e);
        }
    }

    @ReactMethod
    public void openNote(String filePath, Promise promise) {
        openNoteWithPage(filePath, 0, promise);
    }

    private void openNoteInternal(String filePath, int page) {
        if (TextUtils.isEmpty(filePath)) return;
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setComponent(new ComponentName(
                "com.ratta.supernote.note",
                "com.ratta.supernote.note.view.NoteInsidePagesActivity"));
        i.putExtra("file_path", filePath);
        if (page > 0) {
            i.putExtra("page", page);
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(i);
    }

    @ReactMethod
    public void openDocumentWithPage(String filePath, int page, Promise promise) {
        try {
            openDocumentInternal(filePath, page);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "openDocumentWithPage failed", e);
            promise.reject("OPEN_DOCUMENT_FAILED", e);
        }
    }

    @ReactMethod
    public void openDocument(String filePath, Promise promise) {
        openDocumentWithPage(filePath, 0, promise);
    }

    private void openDocumentInternal(String filePath, int page) {
        if (TextUtils.isEmpty(filePath)) return;
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setComponent(new ComponentName(
                "com.supernote.document",
                "com.supernote.document.MainActivity"));
        i.putExtra("file_path", filePath);
        if (page > 0) {
            // PDF/EPUB document reader: pass 0-indexed page (UI Page 5 -> intent 4 -> Page 5)
            i.putExtra("page", page - 1);
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(i);
    }
}
