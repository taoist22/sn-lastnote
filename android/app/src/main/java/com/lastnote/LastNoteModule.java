package com.lastnote;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.text.TextUtils;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
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
    private static final long   LONG_PRESS_MS    = 600;

    // Static singleton — survives JS reloads within PluginHost process
    private static View          sFloatingView  = null;
    private static WindowManager sWindowManager = null;
    private static int           sSavedX        = 80;
    private static int           sSavedY        = 400;

    private final ReactApplicationContext reactContext;

    LastNoteModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
        reactContext.addLifecycleEventListener(this);
    }

    @Override public String getName() { return "LastNote"; }

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    @Override public void onHostResume() {}
    @Override public void onHostPause()  {}

    @Override
    public void onHostDestroy() {
        // Fired when plugin is toggled OFF in Supernote's plugin manager
        hideOverlayInternal();
        reactContext.removeLifecycleEventListener(this);
    }

    // ─── Floating overlay ────────────────────────────────────────────────────

    @ReactMethod
    public void showOverlay(Promise promise) {
        try {
            hideOverlayInternal(); // clear any ghost first

            Context appCtx = reactContext.getApplicationContext();
            sWindowManager = (WindowManager) appCtx.getSystemService(Context.WINDOW_SERVICE);

            // Medium grey oval — not too light, not too dark
            GradientDrawable bg = new GradientDrawable();
            bg.setShape(GradientDrawable.OVAL);
            bg.setColor(Color.argb(220, 115, 115, 115));
            bg.setStroke(2, Color.argb(255, 60, 60, 60));

            ImageView btn = new ImageView(appCtx);
            btn.setBackground(bg);
            btn.setImageResource(android.R.drawable.ic_menu_revert);
            btn.setColorFilter(Color.WHITE);
            btn.setPadding(22, 22, 22, 22);
            btn.setContentDescription("LastNote toggle");

            final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    130, 130,
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT
            );
            params.gravity = Gravity.TOP | Gravity.START;
            params.x = sSavedX;
            params.y = sSavedY;

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
                                params.x = initX + dx;
                                params.y = initY + dy;
                                if (sWindowManager != null && sFloatingView != null) {
                                    sWindowManager.updateViewLayout(sFloatingView, params);
                                }
                            }
                            return true;

                        case MotionEvent.ACTION_UP:
                            sSavedX = params.x;
                            sSavedY = params.y;
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
    }

    @ReactMethod
    public void hideOverlay(Promise promise) {
        try {
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
        if (sWindowManager != null && sFloatingView != null) {
            try { sWindowManager.removeView(sFloatingView); } catch (Exception ignored) {}
            sFloatingView = null;
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

    private void writeFile(String name, String content) throws Exception {
        File f = new File(reactContext.getFilesDir(), name);
        FileOutputStream out = new FileOutputStream(f, false);
        try { out.write(content.getBytes(StandardCharsets.UTF_8)); out.flush(); }
        finally { out.close(); }
    }

    private String readFile(String name) throws Exception {
        File f = new File(reactContext.getFilesDir(), name);
        if (!f.exists()) return null;
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
    public void listDirectory(String dirPath, Promise promise) {
        try {
            File dir = new File(dirPath);
            if (!dir.exists() || !dir.isDirectory()) {
                promise.reject("NOT_A_DIR", dirPath + " is not a directory");
                return;
            }
            File[] files = dir.listFiles();
            if (files == null) files = new File[0];

            final String[] exts = {".note", ".pdf", ".epub"};

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
    public void openNote(String filePath, Promise promise) {
        try {
            if (TextUtils.isEmpty(filePath)) {
                promise.reject("BAD_PATH", "filePath is empty"); return;
            }
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setComponent(new ComponentName(
                    "com.ratta.supernote.note",
                    "com.ratta.supernote.note.view.NoteInsidePagesActivity"));
            i.putExtra("file_path", filePath);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(i);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "openNote failed", e);
            promise.reject("OPEN_NOTE_FAILED", e);
        }
    }

    @ReactMethod
    public void openDocument(String filePath, Promise promise) {
        try {
            if (TextUtils.isEmpty(filePath)) {
                promise.reject("BAD_PATH", "filePath is empty"); return;
            }
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setComponent(new ComponentName(
                    "com.supernote.document",
                    "com.supernote.document.MainActivity"));
            i.putExtra("file_path", filePath);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(i);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "openDocument failed", e);
            promise.reject("OPEN_DOCUMENT_FAILED", e);
        }
    }
}
