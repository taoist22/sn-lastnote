package com.lastnote;

import android.content.ComponentName;
import android.content.Intent;
import android.text.TextUtils;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class LastNoteModule extends ReactContextBaseJavaModule {
    private static final String FILE_NAME = "last_note_path.txt";
    private static final String TAG = "LastNoteModule";
    private final ReactApplicationContext reactContext;

    LastNoteModule(ReactApplicationContext context) {
        super(context);
        reactContext = context;
    }

    @Override
    public String getName() {
        return "LastNote";
    }

    @ReactMethod
    public void readLastPath(Promise promise) {
        try {
            File file = new File(reactContext.getFilesDir(), FILE_NAME);
            if (!file.exists()) {
                promise.resolve(null);
                return;
            }

            byte[] bytes = new byte[(int) file.length()];
            FileInputStream input = new FileInputStream(file);
            try {
                int read = input.read(bytes);
                if (read < 0) {
                    promise.resolve(null);
                    return;
                }
                promise.resolve(new String(bytes, 0, read, StandardCharsets.UTF_8));
            } finally {
                input.close();
            }
        } catch (Exception error) {
            Log.e(TAG, "readLastPath failed", error);
            promise.reject("LAST_NOTE_READ_FAILED", error);
        }
    }

    @ReactMethod
    public void writeLastPath(String path, Promise promise) {
        try {
            File file = new File(reactContext.getFilesDir(), FILE_NAME);
            FileOutputStream output = new FileOutputStream(file, false);
            try {
                output.write(path.getBytes(StandardCharsets.UTF_8));
                output.flush();
            } finally {
                output.close();
            }
            promise.resolve(true);
        } catch (Exception error) {
            Log.e(TAG, "writeLastPath failed", error);
            promise.reject("LAST_NOTE_WRITE_FAILED", error);
        }
    }

    @ReactMethod
    public void openNote(String filePath, Promise promise) {
        try {
            if (TextUtils.isEmpty(filePath)) {
                promise.reject("LAST_NOTE_OPEN_BAD_PATH", "filePath is empty");
                return;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setComponent(new ComponentName(
                    "com.ratta.supernote.note",
                    "com.ratta.supernote.note.view.NoteInsidePagesActivity"
            ));
            intent.putExtra("file_path", filePath);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception error) {
            Log.e(TAG, "openNote failed", error);
            promise.reject("LAST_NOTE_OPEN_NOTE_FAILED", error);
        }
    }

    @ReactMethod
    public void openDocument(String filePath, Promise promise) {
        try {
            if (TextUtils.isEmpty(filePath)) {
                promise.reject("LAST_NOTE_OPEN_BAD_PATH", "filePath is empty");
                return;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setComponent(new ComponentName(
                    "com.supernote.document",
                    "com.supernote.document.MainActivity"
            ));
            intent.putExtra("file_path", filePath);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception error) {
            Log.e(TAG, "openDocument failed", error);
            promise.reject("LAST_NOTE_OPEN_DOCUMENT_FAILED", error);
        }
    }
}
