package com.cookandroid.mth;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.ImageFormat;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CameraMetadata;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.util.Log;
import android.util.Size;
import android.view.OrientationEventListener;
import android.view.Surface;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;

public class camera extends Service {

    public static final String ACTION_CAPTURE = "ACTION_CAPTURE_ON_NOTIFICATION";
    private static final String NOTI_CH_ID = "cap_channel";
    private static final int NOTI_ID = 9911;

    private CameraManager cameraManager;
    private HandlerThread bgThread;
    private Handler bgHandler;
    private CameraDevice cameraDevice;
    private CameraCaptureSession captureSession;
    private ImageReader imageReader;

    // (필요시 유지) 기기 자세 추적 - 이번 빠른해결1에서는 회전 고정이라 필수는 아님
    private int deviceOrientationDeg = 0;
    private OrientationEventListener oel;

    @Override
    public void onCreate() {
        super.onCreate();
        cameraManager = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            stopSelf();
            return;
        }

        // (옵션) 센서 기반 각도 추적 - FIXED 사용하므로 없어도 무방
        oel = new OrientationEventListener(this) {
            @Override public void onOrientationChanged(int orientation) {
                if (orientation == ORIENTATION_UNKNOWN) return;
                deviceOrientationDeg = ((orientation + 45) / 90 * 90) % 360; // 0/90/180/270
            }
        };
        if (oel.canDetectOrientation()) oel.enable();

        startInForeground();
    }

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    NOTI_CH_ID, "Camera Capture", NotificationManager.IMPORTANCE_LOW);
            nm.createNotificationChannel(ch);
        }

        Notification noti = new NotificationCompat.Builder(this, NOTI_CH_ID)
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setContentTitle("카메라 촬영 중")
                .setContentText("보안 정책에 따라 포어그라운드 실행")
                .setOngoing(true)
                .build();
        startForeground(NOTI_ID, noti);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_CAPTURE.equals(intent.getAction())) {
            if (!hasCameraPermission()) {
                stopSelf();
            } else {
                startBg();
                captureOnceAndStop();
            }
        }
        return START_NOT_STICKY;
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void startBg() {
        bgThread = new HandlerThread("cap-bg");
        bgThread.start();
        bgHandler = new Handler(bgThread.getLooper());
    }

    private void stopBg() {
        if (bgThread != null) bgThread.quitSafely();
    }

    private void logJpegSizes(String camId) throws CameraAccessException {
        CameraCharacteristics cc = cameraManager.getCameraCharacteristics(camId);
        StreamConfigurationMap map = cc.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
        Size[] sizes = (map != null) ? map.getOutputSizes(ImageFormat.JPEG) : null;
        if (sizes == null || sizes.length == 0) {
            Log.d("Camera", "JPEG sizes: (none)");
            return;
        }
        StringBuilder sb = new StringBuilder("JPEG sizes: ");
        for (Size s : sizes) sb.append(s.getWidth()).append("x").append(s.getHeight()).append(", ");
        Log.d("Camera", sb.toString());
    }

    private void captureOnceAndStop() {
        try {
            // 전면 카메라 우선
            String camId = pickFrontCameraId();
            if (camId == null) {
                finishAndStop();
                return;
            }

            // 해상도 로그
            logJpegSizes(camId);

            // (기존 고정값 유지) 필요시 지원 목록 중 하나를 선택하는 방식으로 바꿔도 됨
            imageReader = ImageReader.newInstance(2544, 3392, ImageFormat.JPEG, 2);
            imageReader.setOnImageAvailableListener(reader -> {
                Image img = reader.acquireLatestImage();
                if (img != null) {
                    byte[] bytes = imageToBytes(img);
                    img.close();
                    saveToMediaStore(bytes); // ✨ EXIF는 건드리지 않음
                }
                finishAndStop();
            }, bgHandler);

            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED) {
                cameraManager.openCamera(camId, new CameraDevice.StateCallback() {
                    @Override public void onOpened(@NonNull CameraDevice camera) {
                        cameraDevice = camera;
                        createSessionAndCapture();
                    }
                    @Override public void onDisconnected(@NonNull CameraDevice camera) {
                        camera.close(); cameraDevice = null; finishAndStop();
                    }
                    @Override public void onError(@NonNull CameraDevice camera, int error) {
                        camera.close(); cameraDevice = null; finishAndStop();
                    }
                }, bgHandler);
            } else {
                finishAndStop();
            }

        } catch (Exception e) {
            e.printStackTrace();
            finishAndStop();
        }
    }

    private void createSessionAndCapture() {
        try {
            final CameraDevice dev = cameraDevice;
            if (dev == null || imageReader == null) {
                finishAndStop(); return;
            }

            Surface surface = imageReader.getSurface();
            dev.createCaptureSession(Collections.singletonList(surface),
                    new CameraCaptureSession.StateCallback() {
                        @Override public void onConfigured(@NonNull CameraCaptureSession session) {
                            captureSession = session;
                            try {
                                CaptureRequest.Builder req =
                                        dev.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE);
                                req.addTarget(surface);
                                req.set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO);

                                // ✅ 빠른 해결 1: 고정 회전값만 사용 (EXIF는 건드리지 않음)
                                final int FIXED = 270; // 틀리면 90으로 바꿔 테스트
                                req.set(CaptureRequest.JPEG_ORIENTATION, FIXED);

                                session.capture(req.build(), new CameraCaptureSession.CaptureCallback(){}, bgHandler);
                            } catch (Exception e) {
                                e.printStackTrace(); finishAndStop();
                            }
                        }
                        @Override public void onConfigureFailed(@NonNull CameraCaptureSession session) { finishAndStop(); }
                    }, bgHandler);
        } catch (Exception e) {
            e.printStackTrace();
            finishAndStop();
        }
    }

    private String pickFrontCameraId() throws CameraAccessException {
        for (String id : cameraManager.getCameraIdList()) {
            Integer facing = cameraManager.getCameraCharacteristics(id)
                    .get(CameraCharacteristics.LENS_FACING);
            if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) {
                return id;
            }
        }
        return null;
    }

    private byte[] imageToBytes(Image img) {
        Image.Plane plane = img.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        byte[] bytes = new byte[buffer.remaining()];
        buffer.get(bytes);
        return bytes;
    }

    private void saveToMediaStore(byte[] jpeg) {
        ContentValues cv = new ContentValues();
        Uri uri = null;
        try {
            String name = "notifycap_" +
                    new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + ".jpg";

            cv.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            cv.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/NotifyCap");
            cv.put(MediaStore.Images.Media.IS_PENDING, 1);

            uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
            if (uri != null) {
                try (ParcelFileDescriptor pfd = getContentResolver().openFileDescriptor(uri, "w")) {
                    if (pfd != null) {
                        FileOutputStream fos = new FileOutputStream(pfd.getFileDescriptor());
                        fos.write(jpeg);
                        fos.flush();
                        fos.close();
                    }
                }
                // ✨ EXIF NORMAL 강제하지 않음 (이중 회전 방지용)
                cv.clear();
                cv.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContentResolver().update(uri, cv, null, null);
            }
        } catch (Exception e) {
            Log.w("Camera", "saveToMediaStore failed", e);
            // 실패 시 IS_PENDING 롤백 시도
            if (uri != null) {
                try {
                    cv.clear();
                    cv.put(MediaStore.Images.Media.IS_PENDING, 0);
                    getContentResolver().update(uri, cv, null, null);
                } catch (Exception ignore) {}
            }
        }
    }

    private void finishAndStop() {
        try { if (captureSession != null) captureSession.close(); } catch (Exception ignored) {}
        try { if (cameraDevice != null) cameraDevice.close(); } catch (Exception ignored) {}
        try { if (imageReader != null) imageReader.close(); } catch (Exception ignored) {}
        stopBg();
        if (Build.VERSION.SDK_INT >= 24) {
            stopForeground(STOP_FOREGROUND_DETACH);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
