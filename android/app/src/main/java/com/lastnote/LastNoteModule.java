package com.lastnote;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.ratta.supernote.pluginlib.api.HostDataCacheAPI;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class LastNoteModule extends ReactContextBaseJavaModule {
    private static final String FILE_NAME = "last_note_path.txt";
    private static final String PREFS_NAME = "LastNotePrefs";
    private static final String TAG = "LastNoteModule";
    
    private final ReactApplicationContext reactContext;
    private WindowManager windowManager;
    private View floatingView;
    private WindowManager.LayoutParams floatingParams;
    private SharedPreferences prefs;

    LastNoteModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @Override
    public String getName() {
        return "LastNote";
    }

    private int dpToPx(float dp) {
        float density = reactContext.getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    private String readLastPathSync() {
        try {
            File file = new File(reactContext.getFilesDir(), FILE_NAME);
            if (!file.exists()) {
                return null;
            }
            byte[] bytes = new byte[(int) file.length()];
            FileInputStream input = new FileInputStream(file);
            try {
                int read = input.read(bytes);
                if (read <= 0) {
                    return null;
                }
                return new String(bytes, 0, read, StandardCharsets.UTF_8).trim();
            } finally {
                input.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "readLastPathSync failed", e);
            return null;
        }
    }

    private void writeLastPathSync(String path) {
        try {
            File file = new File(reactContext.getFilesDir(), FILE_NAME);
            FileOutputStream output = new FileOutputStream(file, false);
            try {
                output.write(path.getBytes(StandardCharsets.UTF_8));
                output.flush();
            } finally {
                output.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "writeLastPathSync failed", e);
        }
    }

    private void openNoteInternal(String filePath) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setComponent(new ComponentName(
                "com.ratta.supernote.note",
                "com.ratta.supernote.note.view.NoteInsidePagesActivity"
        ));
        intent.putExtra("file_path", filePath);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(intent);
    }

    private void openDocumentInternal(String filePath) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setComponent(new ComponentName(
                "com.supernote.document",
                "com.supernote.document.MainActivity"
        ));
        intent.putExtra("file_path", filePath);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(intent);
    }

    public void performToggleInternal() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                String currentPath = null;
                if (HostDataCacheAPI.getInstance() != null) {
                    currentPath = HostDataCacheAPI.getInstance().getCurrentFilePath();
                }

                String lastPath = readLastPathSync();

                if (!TextUtils.isEmpty(currentPath)) {
                    if (!TextUtils.isEmpty(lastPath) && !lastPath.equals(currentPath)) {
                        writeLastPathSync(currentPath);
                        if (lastPath.toLowerCase().endsWith(".note")) {
                            openNoteInternal(lastPath);
                        } else if (lastPath.toLowerCase().endsWith(".pdf") || lastPath.toLowerCase().endsWith(".epub")) {
                            openDocumentInternal(lastPath);
                        }
                    } else {
                        writeLastPathSync(currentPath);
                    }
                } else if (!TextUtils.isEmpty(lastPath)) {
                    if (lastPath.toLowerCase().endsWith(".note")) {
                        openNoteInternal(lastPath);
                    } else if (lastPath.toLowerCase().endsWith(".pdf") || lastPath.toLowerCase().endsWith(".epub")) {
                        openDocumentInternal(lastPath);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "performToggleInternal failed", e);
            }
        });
    }

    @ReactMethod
    public void readLastPath(Promise promise) {
        try {
            promise.resolve(readLastPathSync());
        } catch (Exception error) {
            promise.reject("LAST_NOTE_READ_FAILED", error);
        }
    }

    @ReactMethod
    public void writeLastPath(String path, Promise promise) {
        try {
            writeLastPathSync(path);
            promise.resolve(true);
        } catch (Exception error) {
            promise.reject("LAST_NOTE_WRITE_FAILED", error);
        }
    }

    @ReactMethod
    public void openNote(String filePath, Promise promise) {
        try {
            openNoteInternal(filePath);
            promise.resolve(true);
        } catch (Exception error) {
            promise.reject("LAST_NOTE_OPEN_NOTE_FAILED", error);
        }
    }

    @ReactMethod
    public void openDocument(String filePath, Promise promise) {
        try {
            openDocumentInternal(filePath);
            promise.resolve(true);
        } catch (Exception error) {
            promise.reject("LAST_NOTE_OPEN_DOCUMENT_FAILED", error);
        }
    }

    @ReactMethod
    public void performToggle(Promise promise) {
        try {
            performToggleInternal();
            promise.resolve(true);
        } catch (Exception error) {
            promise.reject("LAST_NOTE_TOGGLE_FAILED", error);
        }
    }

    @ReactMethod
    public void showFloatingButton(Promise promise) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                showFloatingButtonInternal();
                if (promise != null) promise.resolve(true);
            } catch (Exception e) {
                Log.e(TAG, "showFloatingButton failed", e);
                if (promise != null) promise.reject("SHOW_FLOATING_FAILED", e);
            }
        });
    }

    @ReactMethod
    public void hideFloatingButton(Promise promise) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                hideFloatingButtonInternal();
                if (promise != null) promise.resolve(true);
            } catch (Exception e) {
                Log.e(TAG, "hideFloatingButton failed", e);
                if (promise != null) promise.reject("HIDE_FLOATING_FAILED", e);
            }
        });
    }

    @ReactMethod
    public void toggleFloatingButton(Promise promise) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (floatingView != null) {
                    hideFloatingButtonInternal();
                } else {
                    showFloatingButtonInternal();
                }
                if (promise != null) promise.resolve(true);
            } catch (Exception e) {
                Log.e(TAG, "toggleFloatingButton failed", e);
                if (promise != null) promise.reject("TOGGLE_FLOATING_FAILED", e);
            }
        });
    }

    private void showFloatingButtonInternal() {
        if (floatingView != null) {
            return;
        }

        windowManager = (WindowManager) reactContext.getSystemService(Context.WINDOW_SERVICE);
        if (windowManager == null) return;

        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        int size = dpToPx(56);
        floatingParams = new WindowManager.LayoutParams(
                size,
                size,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );

        floatingParams.gravity = Gravity.TOP | Gravity.START;
        floatingParams.x = prefs.getInt("floating_x", 40);
        floatingParams.y = prefs.getInt("floating_y", 300);

        FloatingArrowView view = new FloatingArrowView(reactContext);
        floatingView = view;

        view.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;
            private long touchStartTime;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = floatingParams.x;
                        initialY = floatingParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        touchStartTime = System.currentTimeMillis();
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (event.getRawX() - initialTouchX);
                        int dy = (int) (event.getRawY() - initialTouchY);
                        floatingParams.x = initialX + dx;
                        floatingParams.y = initialY + dy;
                        if (windowManager != null && floatingView != null) {
                            windowManager.updateViewLayout(floatingView, floatingParams);
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                        int deltaX = (int) (event.getRawX() - initialTouchX);
                        int deltaY = (int) (event.getRawY() - initialTouchY);
                        long duration = System.currentTimeMillis() - touchStartTime;

                        prefs.edit()
                                .putInt("floating_x", floatingParams.x)
                                .putInt("floating_y", floatingParams.y)
                                .apply();

                        if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
                            if (duration > 1000) {
                                hideFloatingButtonInternal();
                            } else {
                                performToggleInternal();
                            }
                        }
                        return true;
                }
                return false;
            }
        });

        windowManager.addView(floatingView, floatingParams);
    }

    private void hideFloatingButtonInternal() {
        if (windowManager != null && floatingView != null) {
            try {
                windowManager.removeView(floatingView);
            } catch (Exception ignored) {
            }
            floatingView = null;
        }
    }

    private class FloatingArrowView extends View {
        private final Paint circlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint arrowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path topArrow = new Path();
        private final Path bottomArrow = new Path();

        public FloatingArrowView(Context context) {
            super(context);
            circlePaint.setColor(Color.WHITE);
            circlePaint.setStyle(Paint.Style.FILL);

            borderPaint.setColor(Color.BLACK);
            borderPaint.setStyle(Paint.Style.STROKE);
            borderPaint.setStrokeWidth(dpToPx(2.5f));

            arrowPaint.setColor(Color.BLACK);
            arrowPaint.setStyle(Paint.Style.STROKE);
            arrowPaint.setStrokeWidth(dpToPx(3f));
            arrowPaint.setStrokeCap(Paint.Cap.ROUND);
            arrowPaint.setStrokeJoin(Paint.Join.ROUND);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int w = getWidth();
            int h = getHeight();
            float cx = w / 2f;
            float cy = h / 2f;
            float radius = Math.min(w, h) / 2f - dpToPx(3);

            // Draw white background circle & sharp black border
            canvas.drawCircle(cx, cy, radius, circlePaint);
            canvas.drawCircle(cx, cy, radius, borderPaint);

            // Draw two switching arrows in center
            float arrowWidth = radius * 0.85f;
            float arrowHeight = radius * 0.35f;

            // Top arrow (pointing right ->)
            topArrow.reset();
            float tY = cy - arrowHeight * 0.6f;
            topArrow.moveTo(cx - arrowWidth / 2f, tY);
            topArrow.lineTo(cx + arrowWidth / 2f, tY);
            topArrow.lineTo(cx + arrowWidth / 4f, tY - arrowHeight / 2f);
            topArrow.moveTo(cx + arrowWidth / 2f, tY);
            topArrow.lineTo(cx + arrowWidth / 4f, tY + arrowHeight / 2f);
            canvas.drawPath(topArrow, arrowPaint);

            // Bottom arrow (pointing left <-)
            bottomArrow.reset();
            float bY = cy + arrowHeight * 0.6f;
            bottomArrow.moveTo(cx + arrowWidth / 2f, bY);
            bottomArrow.lineTo(cx - arrowWidth / 2f, bY);
            bottomArrow.lineTo(cx - arrowWidth / 4f, bY - arrowHeight / 2f);
            bottomArrow.moveTo(cx - arrowWidth / 2f, bY);
            bottomArrow.lineTo(cx - arrowWidth / 4f, bY + arrowHeight / 2f);
            canvas.drawPath(bottomArrow, arrowPaint);
        }
    }
}
