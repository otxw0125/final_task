package com.cookandroid.mth;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import com.github.mikephil.charting.charts.LineChart;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.components.YAxis;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;
import com.github.mikephil.charting.formatter.ValueFormatter;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "BluetoothApp";
    private static final int REQUEST_PERMISSION_CODE = 101;
    private static final int REQUEST_ENABLE_BT = 102;
    private static final UUID MY_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String HC06_DEVICE_NAME = "HC-06";
    private static final String WEB_SERVER_URL = "http://192.168.71.251:3000/sensor-data";
    private static final String CHANNEL_ID = "posture_alert_channel";
    private static final int NOTIFICATION_ID = 1;
    private static final long ANGLE_THRESHOLD_DURATION = 5000; // 5초
    private static final double ACCEL_MAGNITUDE_THRESHOLD_DELTA = 0.1;  // m/s²

    // ─── 버퍼링 관련 필드 ─────────────────────────────────────────
    private final List<JSONObject> sendBuffer = new ArrayList<>();
    private long bufferStartTime = -1;
    private static final long BUFFER_DURATION_MS = 10_000; // 10초
    // ───────────────────────────────────────────────────────────────
    private long lastAlertTime = 0;
    private List<Entry> chartEntries = new ArrayList<>();
    private long chartStartTime = System.currentTimeMillis();
    private int postureAlertCount = 0;

    private double baselineAccelerationMagnitude = -1.0;
    private float baselineX, baselineY, baselineZ;
    private long angleThresholdStartTime = 0;
    private boolean angleThresholdMet = false;
    private boolean alertNotificationShown = false;

    private enum State {IDLE, PENDING, ALERT}

    private State postureState = State.IDLE;
    private long belowThresholdTime = 0;

    private BluetoothAdapter bluetoothAdapter;
    private ConnectThread connectThread;
    private ConnectedThread connectedThread;

    private LineChart chart;
    private TextView statusTextView, dataTextView, baselineTextView;
    private Button connectButton, disconnectButton;
    private OkHttpClient okHttpClient;


    private Handler handler = new Handler(Looper.getMainLooper()) {
        @Override
        public void handleMessage(Message msg) {
            switch (msg.what) {
                case MessageConstants.MESSAGE_READ:
                    String readMessage = (String) msg.obj;
                    dataTextView.setText("수신 데이터: " + readMessage);
                    processReceivedData(readMessage);
                    break;
                case MessageConstants.MESSAGE_TOAST:
                    // 1) 번들에 "toast" 가 있으면 사용
                    String text = msg.getData().getString("toast");
                    // 2) 없으면 msg.obj 를 확인
                    if (text == null && msg.obj instanceof String) {
                        text = (String) msg.obj;
                    }
                    // 3) 비어 있지 않을 때만 Toast 띄우기
                    if (text != null && !text.isEmpty()) {
                        Toast.makeText(getApplicationContext(), text, Toast.LENGTH_SHORT).show();
                    }
                    break;
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        statusTextView = findViewById(R.id.statusTextView);
        dataTextView = findViewById(R.id.dataTextView);
        baselineTextView = findViewById(R.id.baselineTextView);
        connectButton = findViewById(R.id.connectButton);
        disconnectButton = findViewById(R.id.disconnectButton);
        okHttpClient = new OkHttpClient();

        createNotificationChannel();
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        checkAndRequestPermissions();

        connectButton.setOnClickListener(v -> startBluetoothConnection());
        disconnectButton.setOnClickListener(v -> {
            cancelConnection();
        });

        updateBluetoothStatus();
    }

    private void processReceivedData(String data) {
        if (data == null || data.trim().isEmpty() || data.startsWith("ALERT:")) return;
        try {
            float x = 0, y = 0, z = 0;
            for (String part : data.split(",")) {
                part = part.trim();
                if (part.startsWith("X:")) x = Float.parseFloat(part.substring(2));
                else if (part.startsWith("Y:")) y = Float.parseFloat(part.substring(2));
                else if (part.startsWith("Z:")) z = Float.parseFloat(part.substring(2));
            }
            bufferAcceleration(x, y, z);
            checkAndTriggerPostureAlert(x, y, z);
        } catch (Exception e) {
            Log.e(TAG, "Error parsing data", e);
        }
    }

    private void bufferAcceleration(float x, float y, float z) {
        long now = System.currentTimeMillis();
        try {
            JSONObject json = new JSONObject();
            json.put("x_accel", Float.parseFloat(String.format(Locale.US, "%.2f", x)));
            json.put("y_accel", Float.parseFloat(String.format(Locale.US, "%.2f", y)));
            json.put("z_accel", Float.parseFloat(String.format(Locale.US, "%.2f", z)));
            json.put("timestamp", now);

            // 1) 새로운 데이터 추가
            sendBuffer.add(json);

            // 2) 윈도우 바깥(10초 이전) 데이터 삭제
            Iterator<JSONObject> it = sendBuffer.iterator();
            while (it.hasNext()) {
                JSONObject obj = it.next();
                long ts = obj.getLong("timestamp");
                if (ts < now - BUFFER_DURATION_MS) {
                    it.remove();
                }
            }
        } catch (JSONException e) {
            Log.e(TAG, "Buffering failed", e);
        }
    }

    private void sendBufferedDataToServer() {
        if (sendBuffer.isEmpty()) return;
        JSONArray array = new JSONArray(sendBuffer);
        RequestBody body = RequestBody.create(
                MediaType.get("application/json; charset=utf-8"),
                array.toString()
        );
        Request request = new Request.Builder()
                .url(WEB_SERVER_URL)
                .post(body)
                .build();
        okHttpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Log.e(TAG, "Buffered send failed", e);
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                if (!response.isSuccessful()) {
                    Log.e(TAG, "Server error: " + response.code());
                } else {
                    Log.d(TAG, "Buffered data sent");
                }
                if (response.body() != null) response.body().close();
            }
        });
        sendBuffer.clear();
        bufferStartTime = -1;
    }

    private static final double ENTER_THRESHOLD = 0.06;  // 기울임 감지 시작
    private static final double EXIT_THRESHOLD = 0.04;  // 정상 복귀 기준
    private static final long THRESHOLD_DURATION = 5000;   // 5초
    private static final long RESET_DELAY = 1000;  // 1초

    // 수신된 가속도 값을 처리하는 메소드
    private void checkAndTriggerPostureAlert(float x, float y, float z) {
        long now = System.currentTimeMillis();
        double curr = Math.sqrt(x * x + y * y + z * z);
        double delta = Math.abs(curr - baselineAccelerationMagnitude);
        Log.d(TAG, String.format(
                "DEBUG ▶ curr=%.3f, baseline=%.3f, delta=%.3f, threshold=%.3f",
                curr,
                baselineAccelerationMagnitude,
                delta,
                ACCEL_MAGNITUDE_THRESHOLD_DELTA
        ));
        if (baselineAccelerationMagnitude < 0
                && (Math.abs(x) + Math.abs(y) + Math.abs(z)) > 1.0) {
            baselineX = x;
            baselineY = y;
            baselineZ = z;
            baselineAccelerationMagnitude = curr;
            baselineTextView.setText(
                    String.format("초기 값: X:%.2f, Y:%.2f, Z:%.2f",
                            baselineX, baselineY, baselineZ)
            );
            postureState = State.IDLE;  // 상태 초기화
            belowThresholdTime = 0;
            angleThresholdStartTime = 0;
            return;


        }
        switch (postureState) {
            case IDLE:
                if (delta > ENTER_THRESHOLD) {
                    postureState = State.PENDING;
                    angleThresholdStartTime = now;
                    belowThresholdTime = 0;
                }
                break;

            case PENDING:
                if (delta > ENTER_THRESHOLD) {
                    // 연속 초과 시간 누적
                    if (now - angleThresholdStartTime >= THRESHOLD_DURATION) {
                        // 5초 진입 시 알림
                        sendBufferedDataToServer();
                        showPostureAlertNotification("자세 경고!", "등받이가 너무 뒤로 젖혀졌습니다!");
                        postureState = State.ALERT;
                    }
                    belowThresholdTime = 0; // 노이즈 구간 초기화
                } else if (delta < EXIT_THRESHOLD) {
                    // 노이즈 시작
                    if (belowThresholdTime == 0) belowThresholdTime = now;
                    if (now - belowThresholdTime > 1000) {
                        // 1초 이상 정상 구간이면 완전 리셋
                        postureState = State.IDLE;
                    }
                }
                break;

            case ALERT:
                if (delta < EXIT_THRESHOLD) {
                    // 즉시 정상 복귀로 간주
                    hidePostureAlertNotification();
                    postureState = State.IDLE;
                    angleThresholdStartTime = 0;
                } else {
                    // 다시 불안정해지면 타이머 리셋
                    belowThresholdTime = 0;
                }
                break;
        }
    }


    private void hidePostureAlertNotification() {
        NotificationManagerCompat.from(this).cancel(NOTIFICATION_ID);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        cancelConnection();
    }

    private void checkAndRequestPermissions() {
        String[] permissions;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions = new String[]{
                    Manifest.permission.BLUETOOTH_SCAN,
                    Manifest.permission.BLUETOOTH_CONNECT,
                    Manifest.permission.ACCESS_FINE_LOCATION
            };
        } else {
            permissions = new String[]{
                    Manifest.permission.BLUETOOTH,
                    Manifest.permission.BLUETOOTH_ADMIN,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.ACCESS_FINE_LOCATION
            };
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions = addPermission(permissions, Manifest.permission.POST_NOTIFICATIONS);
        }

        boolean needsRequest = false;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm)
                    != PackageManager.PERMISSION_GRANTED) {
                needsRequest = true;
                break;
            }
        }
        if (needsRequest) {
            ActivityCompat.requestPermissions(this, permissions, REQUEST_PERMISSION_CODE);
        } else if (bluetoothAdapter != null && !bluetoothAdapter.isEnabled()) {
            startActivityForResult(
                    new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),
                    REQUEST_ENABLE_BT
            );
        } else {
            statusTextView.setText("블루투스 준비 완료. 연결하세요.");
        }
    }

    private String[] addPermission(String[] arr, String perm) {
        String[] dst = new String[arr.length + 1];
        System.arraycopy(arr, 0, dst, 0, arr.length);
        dst[arr.length] = perm;
        return dst;
    }

    @SuppressLint("MissingPermission")
    @Override
    public void onRequestPermissionsResult(
            int requestCode, @NonNull String[] perms, @NonNull int[] results) {
        super.onRequestPermissionsResult(requestCode, perms, results);
        if (requestCode == REQUEST_PERMISSION_CODE) {
            boolean all = true;
            for (int r : results)
                if (r != PackageManager.PERMISSION_GRANTED) {
                    all = false;
                    break;
                }
            if (all) {
                Toast.makeText(this, "권한 허용됨", Toast.LENGTH_SHORT).show();
                if (bluetoothAdapter != null && !bluetoothAdapter.isEnabled()) {
                    startActivityForResult(
                            new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),
                            REQUEST_ENABLE_BT
                    );
                } else {
                    statusTextView.setText("블루투스 준비 완료. 연결하세요.");
                }
            } else {
                Toast.makeText(this, "권한 거부됨", Toast.LENGTH_LONG).show();
                statusTextView.setText("권한 필요");
            }
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQUEST_ENABLE_BT) {
            if (res == RESULT_OK) updateBluetoothStatus();
            else {
                Toast.makeText(this, "블루투스 미활성화", Toast.LENGTH_SHORT).show();
                statusTextView.setText("블루투스 꺼짐");
            }
        }
    }

    private void updateBluetoothStatus() {
        if (bluetoothAdapter == null) {
            statusTextView.setText("미지원");
            return;
        }
        if (bluetoothAdapter.isEnabled()) {
            statusTextView.setText("블루투스 켜짐");
            connectButton.setEnabled(true);
            disconnectButton.setEnabled(false);
        } else {
            statusTextView.setText("블루투스 꺼짐");
            connectButton.setEnabled(false);
            disconnectButton.setEnabled(false);
        }
    }

    @SuppressLint("MissingPermission")
    private void startBluetoothConnection() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            Toast.makeText(this, "블루투스 활성화 필요", Toast.LENGTH_SHORT).show();
            startActivityForResult(
                    new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),
                    REQUEST_ENABLE_BT
            );
            return;
        }
        Set<BluetoothDevice> paired = bluetoothAdapter.getBondedDevices();
        BluetoothDevice device = null;
        for (BluetoothDevice d : paired) {
            if (HC06_DEVICE_NAME.equals(d.getName())) {
                device = d;
                break;
            }
        }
        if (device == null) {
            Toast.makeText(this,
                    "HC-06 페어링 필요", Toast.LENGTH_LONG).show();
            return;
        }
        connectButton.setEnabled(false);
        statusTextView.setText("연결 중...");
        if (connectThread != null) connectThread.cancel();
        if (connectedThread != null) connectedThread.cancel();
        connectThread = new ConnectThread(device);
        connectThread.start();
    }

    private void cancelConnection() {
        if (connectThread != null) {
            connectThread.cancel();
            connectThread = null;
        }
        if (connectedThread != null) {
            connectedThread.cancel();
            connectedThread = null;
        }
        statusTextView.setText("연결 해제됨");
        dataTextView.setText("수신 데이터:");
        connectButton.setEnabled(true);
        disconnectButton.setEnabled(false);
        baselineAccelerationMagnitude = -1.0;
        angleThresholdMet = false;
        alertNotificationShown = false;
        hidePostureAlertNotification();
        Log.d(TAG, "Connection cancelled");
    }

    private class ConnectThread extends Thread {
        private final BluetoothSocket mmSocket;

        @SuppressLint("MissingPermission")
        ConnectThread(BluetoothDevice device) {
            BluetoothSocket tmp = null;
            try {
                tmp = device.createRfcommSocketToServiceRecord(MY_UUID);
            } catch (IOException e) {
                Log.e(TAG, "Socket 생성 실패", e);
            }
            mmSocket = tmp;
        }

        @SuppressLint("MissingPermission")
        public void run() {
            try {
                mmSocket.connect();
                handler.post(() -> {
                    statusTextView.setText("연결됨");
                    disconnectButton.setEnabled(true);
                });
            } catch (IOException e) {
                Log.e(TAG, "연결 실패", e);
                try {
                    mmSocket.close();
                } catch (IOException ignored) {
                }
                handler.post(() -> {
                    statusTextView.setText("연결 실패");
                    connectButton.setEnabled(true);
                });
                return;
            }
            manageConnectedSocket(mmSocket);
        }

        void cancel() {
            try {
                mmSocket.close();
            } catch (IOException e) {
                Log.e(TAG, "소켓 닫기 실패", e);
            }
        }
    }

    private class ConnectedThread extends Thread {
        private final BluetoothSocket mmSocket;
        private final InputStream mmInStream;
        private final OutputStream mmOutStream;
        private byte[] readBuffer = new byte[1024];
        private int readPos = 0;
        private boolean stop = false;

        ConnectedThread(BluetoothSocket socket) {
            mmSocket = socket;
            InputStream tmpIn = null;
            OutputStream tmpOut = null;
            try {
                tmpIn = socket.getInputStream();
                tmpOut = socket.getOutputStream();
            } catch (IOException e) {
                Log.e(TAG, "스트림 생성 실패", e);
            }
            mmInStream = tmpIn;
            mmOutStream = tmpOut;
            handler.post(() -> {
                statusTextView.setText("통신 시작");
                disconnectButton.setEnabled(true);
            });
        }

        public void run() {
            while (!stop) {
                try {
                    int bytes = mmInStream.read(readBuffer, readPos,
                            readBuffer.length - readPos);
                    if (bytes > 0) {
                        readPos += bytes;
                        for (int i = 0; i < readPos; i++) {
                            if (readBuffer[i] == '\n') {
                                String data = new String(
                                        readBuffer, 0, i, StandardCharsets.UTF_8);
                                handler.obtainMessage(
                                        MessageConstants.MESSAGE_READ,
                                        data
                                ).sendToTarget();
                                int rem = readPos - (i + 1);
                                System.arraycopy(
                                        readBuffer, i + 1, readBuffer, 0, rem
                                );
                                readPos = rem;
                                i = -1;
                            }
                        }
                    } else if (bytes == -1) {
                        handler.obtainMessage(
                                MessageConstants.MESSAGE_TOAST,
                                0, 0, "연결 끊김"
                        ).sendToTarget();
                        break;
                    }
                } catch (IOException e) {
                    Log.e(TAG, "수신 오류", e);
                    sendMessageToHandler("수신 오류");
                    break;
                }
            }
            cancel();
        }

        private void sendMessageToHandler(String message) {
            Message msg = handler.obtainMessage(MessageConstants.MESSAGE_TOAST);
            Bundle b = new Bundle();
            b.putString("toast", message);
            msg.setData(b);
            handler.sendMessage(msg);
        }

        void cancel() {
            stop = true;
            try {
                mmSocket.close();
            } catch (IOException e) {
                Log.e(TAG, "소켓 닫기 실패", e);
            }
        }
    }

    private void manageConnectedSocket(BluetoothSocket socket) {
        if (connectedThread != null) connectedThread.cancel();
        connectedThread = new ConnectedThread(socket);
        connectedThread.start();
    }

    private interface MessageConstants {
        int MESSAGE_READ = 1;
        int MESSAGE_TOAST = 2;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "자세 경고 알림",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("등받이 자세가 일정 시간 이상 불안정할 때 알림");
            channel.enableVibration(true);
            NotificationManager mgr = getSystemService(NotificationManager.class);
            mgr.createNotificationChannel(channel);
        }
    }

    private void showPostureAlertNotification(String title, String message) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(this,
                        Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) return;

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(false)
                .setOnlyAlertOnce(false)
                .setWhen(System.currentTimeMillis());

        NotificationManagerCompat.from(this)
                .notify(NOTIFICATION_ID, b.build());
    }
}