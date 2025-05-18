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
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
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
import com.github.mikephil.charting.charts.LineChart;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.components.YAxis;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;
import com.github.mikephil.charting.formatter.ValueFormatter;

public class MainActivity extends AppCompatActivity {
    private final Handler chartUpdateHandler = new Handler(Looper.getMainLooper());
    private final Runnable chartUpdater = new Runnable() {
        @Override
        public void run() {
            updateChart(false); // 알림 없어도 시간만 반영
            chartUpdateHandler.postDelayed(this, 30_000); // 30초마다 반복
        }
    };
    private static final String TAG = "BluetoothApp";
    private static final int REQUEST_PERMISSION_CODE = 101;
    private static final int REQUEST_ENABLE_BT = 102;
    // HC-06의 SPP UUID (고정된 값)
    private static final UUID MY_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String HC06_DEVICE_NAME = "HC-06"; // 아두이노에 연결된 HC-06의 블루투스 이름 (필요 시 변경)
    // 또는 MAC 주소로 직접 연결 가능 (페어링 후 설정에서 확인 가능)
    // private static final String HC06_DEVICE_MAC_ADDRESS = "XX:XX:XX:XX:XX:XX"; // 실제 MAC 주소로 변경
    private List<Entry> chartEntries = new ArrayList<>();
    private long chartStartTime = System.currentTimeMillis();
    private int postureAlertCount = 0;

    private BluetoothAdapter bluetoothAdapter = null;
    private BluetoothDevice hc06Device = null;
    private ConnectThread connectThread = null;
    private ConnectedThread connectedThread = null;
    private LineChart chart;

    private TextView statusTextView;
    private TextView dataTextView;
    private Button connectButton;
    private Button disconnectButton;
    private TextView baselineTextView;
    // 웹 서버 설정
    private static final String WEB_SERVER_URL = "http://192.168.255.251:3000/sensor-data"; // 실제 웹 서버 URL로 변경
    private OkHttpClient okHttpClient;

    // 알림 채널 ID
    private static final String CHANNEL_ID = "posture_alert_channel";
    private static final int NOTIFICATION_ID = 1;

    // 가속도 변화 감지 및 알림 관련 변수
    private double baselineAccelerationMagnitude = -1.0; // 초기 기준 가속도 크기
    private long angleThresholdStartTime = 0; // 조건 만족 시작 시간
    private boolean angleThresholdMet = false; // 조건 만족 중 플래그
    private boolean alertNotificationShown = false; // 알림이 이미 표시되었는지 플래그
    private static final long ANGLE_THRESHOLD_DURATION = 5000; // 조건 지속 시간 (5초)
    private static final double ACCEL_MAGNITUDE_THRESHOLD_DELTA = 0.1; // 가속도 크기 변화 임계값 (m/s^2), 필요 시 조정
    private float baselineX = 0;
    private float baselineY = 0;
    private float baselineZ = 0;

    // 수신된 데이터를 파싱하고 처리하는 핸들러 (UI 업데이트, 웹 전송, 알림 로직 수행)
    private Handler handler = new Handler(Looper.getMainLooper()) {
        @Override
        public void handleMessage(android.os.Message msg) {
            switch (msg.what) {
                case MessageConstants.MESSAGE_READ:
                    String readMessage = (String) msg.obj; // 수신된 데이터 문자열
                    dataTextView.setText("수신 데이터: " + readMessage);
                    Log.d(TAG, "Received: " + readMessage);

                    // 수신된 데이터 파싱 및 처리
                    processReceivedData(readMessage);

                    break;
                case MessageConstants.MESSAGE_TOAST:
                    // 상태 메시지 토스트로 출력
                    Toast.makeText(getApplicationContext(), msg.getData().getString("toast"), Toast.LENGTH_SHORT).show();
                    break;
                // 다른 메시지 타입 (연결 성공/실패 등) 처리 가능
            }
        }
    };

    // 데이터 파싱 및 처리, 웹 전송, 알림 로직
    private void processReceivedData(String data) {
        // 예시 데이터 형식: "X:1.23,Y:4.56,Z:7.89" 또는 "ALERT:..." (아두이노 코드에 따라 다름)
        if (data == null || data.trim().isEmpty()) {
            return; // 유효하지 않은 데이터
        }

        // 경고 메시지인지 확인 (아두이노에서 ALERT: 접두사를 붙였다면)
        if (data.startsWith("ALERT:")) {
            // 아두이노에서 이미 경고를 판단하여 보낸 경우, 여기서는 알림만 트리거
            // String alertContent = data.substring(6); // "ALERT:" 뒤 내용
            // showPostureAlertNotification("자세 경고!", "목 각도가 기울어졌습니다. (" + alertContent + ")");
            // 이 예시에서는 안드로이드 앱에서 직접 가속도 변화를 감지하고 알림을 보냅니다.
            return; // ALERT 메시지는 여기서 추가 처리하지 않음 (아래 가속도 로직 사용)
        }

        // 가속도 값 파싱
        try {
            float x = 0, y = 0, z = 0;
            String[] parts = data.split(",");
            Log.d(TAG, "Parsed parts length: " + parts.length);

            for (String part : parts) {
                part = part.trim();  // 공백 제거 추가
                if (part.startsWith("X:")) {
                    x = Float.parseFloat(part.substring(2));
                } else if (part.startsWith("Y:")) {
                    y = Float.parseFloat(part.substring(2));
                } else if (part.startsWith("Z:")) {
                    z = Float.parseFloat(part.substring(2));
                }
            }

            // 웹 서버로 데이터 전송
            sendAccelerationToServer(x, y, z);

            // 가속도 변화 감지 및 알림 로직
            checkAndTriggerPostureAlert(x, y, z);

        } catch (NumberFormatException e) {
            Log.e(TAG, "Failed to parse acceleration data: " + data, e);
            // 파싱 오류 처리
        } catch (Exception e) {
            Log.e(TAG, "Error processing received data: " + data, e);
        }
    }

    // 웹 서버로 X, Y, Z 가속도 값 전송
    private void sendAccelerationToServer(float x, float y, float z) {
        JSONObject jsonData = new JSONObject();
        try {
            float xRounded = (float) Math.round(x * 100) / 100;
            float yRounded = (float) Math.round(y * 100) / 100;
            float zRounded = (float) Math.round(z * 100) / 100;
            long timestamp = System.currentTimeMillis();

            // JSON에 소수 둘째자리까지 반올림한 값을 넣기 위해 문자열로 포맷
            jsonData.put("x_accel", Float.parseFloat(String.format("%.2f", xRounded)));
            jsonData.put("y_accel", Float.parseFloat(String.format("%.2f", yRounded)));
            jsonData.put("z_accel", Float.parseFloat(String.format("%.2f", zRounded)));
            jsonData.put("timestamp", timestamp);

            Log.d(TAG, "Sending JSON: " + jsonData.toString());

        } catch (JSONException e) {
            Log.e(TAG, "Failed to create JSON object", e);
            return;
        }

        RequestBody body = RequestBody.create(
                MediaType.get("application/json; charset=utf-8"),
                jsonData.toString()
        );

        Request request = new Request.Builder()
                .url(WEB_SERVER_URL)
                .post(body)
                .build();

        okHttpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(@NonNull Call call, @NonNull IOException e) {
                Log.e(TAG, "Failed to send data to server", e);
                // UI 스레드에서 토스트 메시지 표시 등 오류 처리
                runOnUiThread(() -> Toast.makeText(getApplicationContext(), "데이터 서버 전송 실패", Toast.LENGTH_SHORT).show());
            }

            @Override
            public void onResponse(@NonNull Call call, @NonNull Response response) throws IOException {
                if (!response.isSuccessful()) {
                    Log.e(TAG, "Server response error: " + response.code());
                    // UI 스레드에서 오류 처리
                    runOnUiThread(() -> Toast.makeText(getApplicationContext(), "서버 응답 오류: " + response.code(), Toast.LENGTH_SHORT).show());
                } else {
                    // 성공적으로 전송됨
                    Log.d(TAG, "Data sent to server successfully");
                    // UI 스레드에서 성공 메시지 표시 등
                    // runOnUiThread(() -> Toast.makeText(getApplicationContext(), "데이터 서버 전송 성공", Toast.LENGTH_SHORT).show()); // 너무 자주 뜨면 번잡할 수 있음
                }
                if (response.body() != null) {
                    response.body().close(); // 응답 본문 닫기
                }
            }
        });
    }

    private long lastUpdateTime = 0;
    private long alertAccumulatedTime = 0;

    private void checkAndTriggerPostureAlert(float x, float y, float z) {
        double currentMagnitude = Math.sqrt(x * x + y * y + z * z);
        long now = System.currentTimeMillis();

        if (baselineAccelerationMagnitude < 0 && (Math.abs(x) + Math.abs(y) + Math.abs(z)) > 1.0) {
            baselineX = x;
            baselineY = y;
            baselineZ = z;
            baselineAccelerationMagnitude = currentMagnitude;
            baselineTextView.setText(String.format("초기 값: X:%.2f, Y:%.2f, Z:%.2f", baselineX, baselineY, baselineZ));
            Log.d(TAG, String.format("초기 기준 설정: %.2f", baselineAccelerationMagnitude));

            lastUpdateTime = now;
            alertAccumulatedTime = 0;

            // 아래 줄을 제거해야 합니다!
            // return;
            // => return을 없애면 이 시점부터 바로 조건 비교가 들어갑니다.
        }

        double magnitudeDelta = Math.abs(currentMagnitude - baselineAccelerationMagnitude);

        if (magnitudeDelta > ACCEL_MAGNITUDE_THRESHOLD_DELTA) {
            if (!angleThresholdMet) {
                angleThresholdMet = true;
                angleThresholdStartTime = now;
                Log.d(TAG, "Posture condition met. Timer started.");
            } else {
                long elapsed = now - angleThresholdStartTime;
                if (elapsed >= ANGLE_THRESHOLD_DURATION && !alertNotificationShown) {
                    showPostureAlertNotification("자세 경고!", "자세가 불안정합니다!");
                    alertNotificationShown = true;
                    Log.d(TAG, "Posture alert triggered after 5 seconds.");
                }
            }
        } else {
            // 기준 범위 이내로 돌아오면 초기화
            if (alertNotificationShown) {
                hidePostureAlertNotification();
            }
            alertNotificationShown = false;
            angleThresholdMet = false;
            angleThresholdStartTime = 0;
        }
    }


    // 알림 숨기기 함수 (선택 사항)
    private void hidePostureAlertNotification() {
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        notificationManager.cancel(NOTIFICATION_ID);
        Log.d(TAG, "Notification canceled");
        alertNotificationShown = false;
    }


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main); // 실제 레이아웃 파일 이름으로 변경
        chart = findViewById(R.id.chart); // 그래프 연결
        chart.setVisibility(View.VISIBLE); // 앱 실행 시 항상 표시

        statusTextView = findViewById(R.id.statusTextView); // 레이아웃 파일에 TextView 추가 필요
        dataTextView = findViewById(R.id.dataTextView);   // 레이아웃 파일에 TextView 추가 필요
        connectButton = findViewById(R.id.connectButton); // 레이아웃 파일에 Button 추가 필요
        disconnectButton = findViewById(R.id.disconnectButton); // 레이아웃 파일에 Button 추가 필요
        baselineTextView = findViewById(R.id.baselineTextView);

        // OkHttp 클라이언트 초기화
        okHttpClient = new OkHttpClient();

        // 알림 채널 생성 (Android 8.0 이상)
        createNotificationChannel();

        // Bluetooth 어댑터 가져오기
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        if (bluetoothAdapter == null) {
            // 장치가 블루투스를 지원하지 않음
            Toast.makeText(this, "이 장치는 블루투스를 지원하지 않습니다.", Toast.LENGTH_LONG).show();
            finish(); // 앱 종료
            return;
        }

        // 권한 확인 및 요청
        checkAndRequestPermissions();

        // UI 리스너 설정
        connectButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startBluetoothConnection();
            }
        });

        disconnectButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                cancelConnection(); // 연결 끊기
                // 🔹 그래프 초기화 처리
                chartUpdateHandler.removeCallbacks(chartUpdater); //
                chartEntries.clear(); // 데이터 완전 삭제
                chart.clear();        // 그래프 내부 초기화
                chart.invalidate();   // UI 반영
            }
        });

        // 앱 시작 시 블루투스 상태 확인
        updateBluetoothStatus();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // 액티비티 종료 시 Bluetooth 연결 정리
        cancelConnection();
    }

    // --- 권한 관련 ---
    private void checkAndRequestPermissions() {
        String[] permissions;
        int permissionCount = 0;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12 이상
            permissions = new String[]{
                    Manifest.permission.BLUETOOTH_SCAN,
                    Manifest.permission.BLUETOOTH_CONNECT,
                    Manifest.permission.ACCESS_FINE_LOCATION // 위치 권한이 스캔에 필요할 수 있습니다.
            };
            permissionCount = 3;
        } else {
            // Android 11 이하
            permissions = new String[]{
                    Manifest.permission.BLUETOOTH,
                    Manifest.permission.BLUETOOTH_ADMIN,
                    Manifest.permission.ACCESS_COARSE_LOCATION, // 구형 기기 위치 권한
                    Manifest.permission.ACCESS_FINE_LOCATION
            };
            permissionCount = 4; // 또는 2 (BLUETOOTH, BLUETOOTH_ADMIN) 만 필요할 수도 있습니다.
        }

        // 알림 권한 (Android 13 이상)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions = addPermission(permissions, Manifest.permission.POST_NOTIFICATIONS);
            permissionCount++;
        }


        boolean needsRequest = false;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                needsRequest = true;
                break;
            }
        }

        if (needsRequest) {
            ActivityCompat.requestPermissions(this, permissions, REQUEST_PERMISSION_CODE);
        } else {
            // 필요한 모든 권한이 이미 허용됨
            if (bluetoothAdapter != null && !bluetoothAdapter.isEnabled()) {
                // 블루투스 활성화 요청
                Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT);
            } else {
                // 블루투스 활성화 및 권한 모두 OK
                statusTextView.setText("블루투스 준비 완료. 연결하세요.");
            }
        }
    }

    // 배열에 권한 추가 헬퍼 함수
    private String[] addPermission(String[] currentPermissions, String permissionToAdd) {
        String[] newPermissions = new String[currentPermissions.length + 1];
        System.arraycopy(currentPermissions, 0, newPermissions, 0, currentPermissions.length);
        newPermissions[currentPermissions.length] = permissionToAdd;
        return newPermissions;
    }

    @SuppressLint("MissingPermission") // 권한 요청 결과를 받은 후이므로 Lint 경고 무시
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_PERMISSION_CODE) {
            boolean allGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }

            if (allGranted) {
                Toast.makeText(this, "필요한 권한이 모두 허용되었습니다.", Toast.LENGTH_SHORT).show();
                if (bluetoothAdapter != null && !bluetoothAdapter.isEnabled()) {
                    // 블루투스 활성화 요청
                    Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                    startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT);
                } else if (bluetoothAdapter != null) {
                    statusTextView.setText("블루투스 준비 완료. 연결하세요.");
                }
            } else {
                Toast.makeText(this, "일부 권한이 거부되어 앱 기능이 제한될 수 있습니다.", Toast.LENGTH_LONG).show();
                statusTextView.setText("권한 필요");
                // 사용자가 권한을 영구적으로 거부한 경우 설정 화면으로 이동 안내 필요
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_ENABLE_BT) {
            if (resultCode == RESULT_OK) {
                // 블루투스 활성화됨
                updateBluetoothStatus();
            } else {
                // 블루투스 활성화 거부됨
                Toast.makeText(this, "블루투스가 활성화되지 않았습니다.", Toast.LENGTH_SHORT).show();
                statusTextView.setText("블루투스 비활성화");
            }
        }
    }
    // --- 권한 관련 끝 ---


    // 블루투스 상태 업데이트 (UI 및 내부 상태)
    private void updateBluetoothStatus() {
        if (bluetoothAdapter == null) {
            statusTextView.setText("블루투스 미지원");
            return;
        }
        if (bluetoothAdapter.isEnabled()) {
            statusTextView.setText("블루투스 켜짐. 장치 검색/연결 준비.");
            connectButton.setEnabled(true);
            disconnectButton.setEnabled(false);
        } else {
            statusTextView.setText("블루투스 꺼짐.");
            connectButton.setEnabled(false);
            disconnectButton.setEnabled(false);
        }
    }


    // HC-06 장치 검색 및 연결 시작 (페어링된 장치 중에서 찾기)
    @SuppressLint("MissingPermission") // 권한 체크는 checkAndRequestPermissions에서 수행
    private void startBluetoothConnection() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            Toast.makeText(this, "블루투스가 활성화되지 않았습니다.", Toast.LENGTH_SHORT).show();
            Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
            startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT);
            return;
        }

        // 페어링된 장치 목록 가져오기
        Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
        hc06Device = null;
        if (pairedDevices.size() > 0) {
            for (BluetoothDevice device : pairedDevices) {
                // Log.d(TAG, "Paired device: " + device.getName() + " (" + device.getAddress() + ")");
                // 이름 또는 MAC 주소로 HC-06 장치 식별
                if (HC06_DEVICE_NAME.equals(device.getName()) /*|| HC06_DEVICE_MAC_ADDRESS.equals(device.getAddress())*/) {
                    hc06Device = device;
                    Log.d(TAG, "HC-06 device found: " + device.getName());
                    break;
                }
            }
        }

        if (hc06Device == null) {
            Toast.makeText(this, "페어링된 장치 목록에서 HC-06 장치를 찾을 수 없습니다.\n\n블루투스 설정에서 HC-06과 먼저 페어링해주세요.", Toast.LENGTH_LONG).show();
            statusTextView.setText("HC-06 장치 못찾음");
            // 필요하다면 장치 검색 (Scanning) 기능을 추가할 수 있습니다. (더 복잡해짐)
            return;
        }

        // 연결 시도
        statusTextView.setText("HC-06에 연결 중...");
        connectButton.setEnabled(false); // 연결 중에는 버튼 비활성화
        disconnectButton.setEnabled(false);

        // 기존 연결 시도 중이었다면 취소
        if (connectThread != null) {
            connectThread.cancel();
            connectThread = null;
        }
        // 기존 연결이 있다면 취소
        if (connectedThread != null) {
            connectedThread.cancel();
            connectedThread = null;
        }

        // 연결 스레드 시작
        connectThread = new ConnectThread(hc06Device);
        connectThread.start();
    }

    // Bluetooth 연결 해제
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
        // 연결 해제 시 알림 관련 상태 초기화
        baselineAccelerationMagnitude = -1.0;
        angleThresholdMet = false;
        angleThresholdStartTime = 0;
        alertNotificationShown = false;
        hidePostureAlertNotification(); // 혹시 표시된 알림 숨김

        Log.d(TAG, "Bluetooth connection cancelled.");
    }


    // Bluetooth 장치 연결 스레드 (ConnectThread)
    private class ConnectThread extends Thread {
        private final BluetoothSocket mmSocket;
        private final BluetoothDevice mmDevice;

        @SuppressLint("MissingPermission") // 권한 체크는 checkAndRequestPermissions에서 수행
        public ConnectThread(BluetoothDevice device) {
            mmDevice = device;
            BluetoothSocket tmp = null;
            try {
                // SPP 서비스 UUID를 사용하여 소켓 가져오기
                tmp = device.createRfcommSocketToServiceRecord(MY_UUID);
            } catch (IOException e) {
                Log.e(TAG, "Socket's create() method failed", e);
                sendMessageToHandler("Socket 생성 실패");
            }
            mmSocket = tmp;
        }

        @SuppressLint("MissingPermission") // 권한 체크는 checkAndRequestPermissions에서 수행
        public void run() {
            // 연결 시도를 하므로 검색 중지 (필요하다면)
            // if (bluetoothAdapter.isDiscovering()) {
            //     bluetoothAdapter.cancelDiscovery();
            // }

            try {
                // 장치에 연결. 성공 또는 예외 발생 시 반환.
                mmSocket.connect();
                Log.d(TAG, "Bluetooth Socket connected.");
                handler.post(() -> {
                    chartStartTime = System.currentTimeMillis(); // 0초 기준
                    chartEntries.clear();                         // 데이터 초기화
                    chart.clear();                                // 차트 초기화
                    updateChart(false);                           // 빈 그래프 출력
                    chart.setVisibility(View.VISIBLE);            // 혹시 안 보일 경우 표시
                    chartUpdateHandler.post(chartUpdater);        // 🔥 주기적 업데이트 시작
                });
            } catch (IOException connectException) {
                // 연결 실패 처리
                Log.e(TAG, "Could not connect to HC-06 device", connectException);
                sendMessageToHandler("HC-06 연결 실패");
                try {
                    mmSocket.close();
                } catch (IOException closeException) {
                    Log.e(TAG, "Could not close the client socket", closeException);
                }
                // 연결 실패 후 UI 업데이트 등을 위해 핸들러 메시지 전송
                handler.post(() -> {
                    statusTextView.setText("HC-06 연결 실패");
                    connectButton.setEnabled(true);
                    disconnectButton.setEnabled(false);
                });

                return;
            }

            // 연결 성공. 연결된 소켓으로 데이터 전송/수신 스레드 시작.
            manageConnectedSocket(mmSocket);
        }

        // 외부에서 연결 시도를 중단하기 위한 메소드
        public void cancel() {
            try {
                mmSocket.close();
                Log.d(TAG, "ConnectThread socket closed.");
            } catch (IOException e) {
                Log.e(TAG, "Could not close the client socket on cancel", e);
            }
        }

        // 핸들러로 메시지 전송 헬퍼
        private void sendMessageToHandler(String message) {
            Message msg = handler.obtainMessage(MessageConstants.MESSAGE_TOAST);
            Bundle bundle = new Bundle();
            bundle.putString("toast", message);
            msg.setData(bundle);
            handler.sendMessage(msg);
        }
    }

    private class ConnectedThread extends Thread {
        private final BluetoothSocket mmSocket;
        private final InputStream mmInStream;
        private final OutputStream mmOutStream;
        private byte[] readBuffer; // 수신 버퍼
        private int readBufferPosition; // 버퍼 현재 위치
        private volatile boolean stopWorker; // 스레드 중지 플래그
        private Thread workerThread; // 데이터 수신 워커 스레드

        public ConnectedThread(BluetoothSocket socket) {
            mmSocket = socket;
            InputStream tmpIn = null;
            OutputStream tmpOut = null;

            // --- readBuffer를 생성자에서 초기화합니다. ---
            readBuffer = new byte[1024];
            readBufferPosition = 0;

            // UI 업데이트를 위해 메인 스레드 핸들러로 메시지 전송
            handler.post(() -> {
                statusTextView.setText("HC-06 연결 성공");
                connectButton.setEnabled(false);
                disconnectButton.setEnabled(true);
                baselineAccelerationMagnitude = -1.0; // 새로운 연결 시 기준 가속도 초기화
                angleThresholdMet = false;
                angleThresholdStartTime = 0;
                alertNotificationShown = false;
                hidePostureAlertNotification(); // 알림 숨김
            });

            // 소켓의 입/출력 스트림 가져오기
            try {
                tmpIn = socket.getInputStream();
                tmpOut = socket.getOutputStream();
                Log.d(TAG, "InputStream and OutputStream obtained.");
            } catch (IOException e) {
                Log.e(TAG, "temp sockets not created", e);
                sendMessageToHandler("스트림 생성 실패");
            }

            mmInStream = tmpIn;
            mmOutStream = tmpOut;
        }

        public void run() {
            readBuffer = new byte[1024]; // 수신 버퍼 크기
            readBufferPosition = 0;     // 버퍼 현재 위치
            stopWorker = false;         // 스레드 중지 플래그

            Log.d(TAG, "ConnectedThread started. Listening for data...");

            // 데이터를 읽는 루프
            while (!Thread.currentThread().isInterrupted() && !stopWorker) {
                try {
                    int bytesRead = -1; // 읽어온 바이트 수를 저장할 변수

                    // --- 데이터 읽기 시도 로그 ---
                    Log.d("BluetoothRead", "Attempting to read from InputStream...");

                    // 블록킹 read: 데이터가 들어올 때까지 기다립니다.
                    bytesRead = mmInStream.read(readBuffer, readBufferPosition, readBuffer.length - readBufferPosition);

                    // --- 데이터 읽기 결과 로그 ---
                    if (bytesRead > 0) {
                        Log.d("BluetoothRead", "Successfully read " + bytesRead + " bytes.");
                        readBufferPosition += bytesRead; // 버퍼 위치 업데이트

                        // 읽어온 데이터에서 줄바꿈 문자('\n') 찾기 및 패킷 처리
                        int bufferIndex = 0;
                        while (bufferIndex < readBufferPosition) {
                            if (readBuffer[bufferIndex] == '\n') {
                                // 줄바꿈 문자를 찾았습니다. 패킷을 분리합니다.
                                byte[] encodedBytes = new byte[bufferIndex]; // '\n' 이전까지의 데이터
                                System.arraycopy(readBuffer, 0, encodedBytes, 0, bufferIndex);

                                try {
                                    // UTF-8로 디코딩
                                    final String data = new String(encodedBytes, StandardCharsets.UTF_8);
                                    Log.d("BluetoothRead", "Received complete packet: " + data); // 수신 데이터 로그 추가!

                                    // 메인 스레드의 핸들러로 데이터 전송
                                    Message readMsg = handler.obtainMessage(MessageConstants.MESSAGE_READ, data);
                                    readMsg.sendToTarget();

                                } catch (Exception e) {
                                    Log.e("BluetoothRead", "Error decoding or handling data", e); // 데이터 처리/디코딩 오류 로그
                                }

                                // 처리된 패킷 이후의 데이터를 버퍼 앞으로 이동시키고 버퍼 위치 초기화
                                int remainingBytes = readBufferPosition - (bufferIndex + 1); // '\n' 다음부터 남은 데이터
                                if (remainingBytes > 0) {
                                    System.arraycopy(readBuffer, bufferIndex + 1, readBuffer, 0, remainingBytes);
                                }
                                readBufferPosition = remainingBytes; // 남은 데이터만큼 버퍼 위치 설정
                                bufferIndex = 0; // 버퍼 처음부터 다시 검색 시작
                            } else {
                                bufferIndex++; // 다음 바이트로 이동
                            }
                        } // while (bufferIndex < readBufferPosition) 끝

                    } else if (bytesRead == -1) {
                        // 스트림이 닫혔을 때 (연결 끊김)
                        Log.d("BluetoothRead", "Input stream closed (read returned -1). Connection lost.");
                        sendMessageToHandler("블루투스 연결 끊김"); // UI에 연결 끊김 알림
                        break; // 루프 종료
                    }

                } catch (IOException e) {
                    Log.e("BluetoothRead", "IOException while reading from input stream", e); // 읽기 오류 로그
                    sendMessageToHandler("데이터 수신 오류"); // UI에 오류 알림
                    break; // 루프 종료
                } catch (Exception e) {
                    Log.e("BluetoothRead", "Unexpected exception in read loop", e); // 그 외 예외 로그
                    sendMessageToHandler("수신 스레드 오류"); // UI에 오류 알림
                    break; // 루프 종료
                }
            } // while (!Thread.currentThread().isInterrupted() && !stopWorker) 끝

            // 스레드가 종료될 때 소켓 닫기
            cancel(); // 소켓 닫는 메소드 호출
        }

        // 소켓 닫는 메소드
        public void cancel() {
            stopWorker = true; // 스레드 중지 플래그 설정
            try {
                // 스레드가 종료될 때까지 대기 (필요 시)
                if (workerThread != null) {
                    workerThread.join(); // workerThread가 종료될 때까지 대기
                }
                mmSocket.close(); // 소켓 닫기
                Log.d(TAG, "Bluetooth socket closed.");
                sendMessageToHandler("블루투스 연결 종료"); // UI에 연결 종료 알림
            } catch (IOException e) {
                Log.e(TAG, "Could not close the connect socket", e);
                sendMessageToHandler("소켓 닫기 실패"); // UI에 오류 알림
            } catch (InterruptedException e) {
                Log.e(TAG, "Thread interrupted while waiting for worker thread to finish", e);
            }
        }

        // 스레드 외부에서 호출하여 스레드 중지
        public void cancelThread() {
            stopWorker = true;
            Thread.currentThread().interrupt(); // 현재 스레드를 인터럽트하여 블록킹 read() 해제
        }

        // 핸들러로 메시지 전송 헬퍼
        private void sendMessageToHandler(String message) {
            Message msg = handler.obtainMessage(MessageConstants.MESSAGE_TOAST);
            Bundle bundle = new Bundle();
            bundle.putString("toast", message);
            msg.setData(bundle);
            handler.sendMessage(msg);
        }
    }

    // 연결 성공 시 호출되어 데이터 통신 스레드 시작
    private void manageConnectedSocket(BluetoothSocket socket) {
        // 기존 통신 스레드가 있다면 종료
        if (connectedThread != null) {
            connectedThread.cancel();
        }

        connectedThread = new ConnectedThread(socket);
        connectedThread.start();
    }

    // 핸들러 메시지 타입 정의 (내부 클래스)
    private interface MessageConstants {
        int MESSAGE_READ = 1; // 수신된 데이터 메시지
        int MESSAGE_TOAST = 2; // 토스트 메시지
        // 다른 상태 메시지 추가 가능 (예: 연결 성공/실패)
        int MESSAGE_CONNECT_SUCCESS = 3;
        int MESSAGE_CONNECT_FAILURE = 4;
    }


    // 알림 채널 생성 (Android 8.0 이상 필수)
    private void createNotificationChannel() {
        // Android 8.0 이상에서만 채널 생성
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "자세 경고 알림"; // 채널 이름
            String description = "목 자세가 일정 시간 이상 불안정할 때 알림"; // 채널 설명
            int importance = NotificationManager.IMPORTANCE_DEFAULT; // 알림 중요도 (소리, 팝업 등 설정)
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true); // 진동 사용 설정

            // 시스템에 채널 등록
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private int lastNotificationId = -1;

    private void showPostureAlertNotification(String title, String message) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "Notification permission not granted. Cannot show notification.");
                return;
            }
        }

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(false)
                .setOnlyAlertOnce(false)
                .setWhen(System.currentTimeMillis());

        notificationManager.notify(NOTIFICATION_ID, builder.build());
        alertNotificationShown = true;
        postureAlertCount++;
        updateChart(true);
        Log.d(TAG, "Alert count: " + postureAlertCount);
    }

    private void updateChart(boolean isAlert) {
        LineChart chart = findViewById(R.id.chart);

        long now = System.currentTimeMillis();
        float secondsSinceStart = (now - chartStartTime) / 1000f;
        float roundedTime = ((int) (secondsSinceStart / 30)) * 30;

        // 🔹 0초 구간이 없으면 삽입
        boolean hasZero = false;
        for (Entry e : chartEntries) {
            if (e.getX() == 0f) {
                hasZero = true;
                break;
            }
        }
        if (!hasZero) chartEntries.add(new Entry(0f, 0f));

        // 🔹 누락된 시간 구간을 0으로 채움
        List<Float> existingTimes = new ArrayList<>();
        for (Entry e : chartEntries) {
            existingTimes.add(e.getX());
        }

        for (float t = 0; t <= roundedTime; t += 30f) {
            if (!existingTimes.contains(t)) {
                chartEntries.add(new Entry(t, 0f));
            }
        }

        // 🔹 알림 발생 시 해당 시간대 값 +1
        if (isAlert) {
            for (Entry e : chartEntries) {
                if (e.getX() == roundedTime) {
                    e.setY(e.getY() + 1);
                    break;
                }
            }
        }

        // 🔹 정렬
        Collections.sort(chartEntries, new Comparator<Entry>() {
            @Override
            public int compare(Entry e1, Entry e2) {
                return Float.compare(e1.getX(), e2.getX());
            }
        });

        // 🔹 데이터셋 구성
        LineDataSet dataSet = new LineDataSet(chartEntries, "자세 알림 횟수");
        dataSet.setDrawValues(false);       // 점 위 숫자 제거
        dataSet.setLineWidth(2f);
        dataSet.setCircleRadius(4f);
        dataSet.setDrawCircles(true);

        LineData lineData = new LineData(dataSet);
        chart.setData(lineData);

        // 🔹 Y축 설정
        YAxis leftAxis = chart.getAxisLeft();
        leftAxis.setAxisMinimum(0f);
        leftAxis.setAxisMaximum(5f);
        leftAxis.setGranularity(1f);
        leftAxis.setLabelCount(6, true);
        leftAxis.setValueFormatter(new ValueFormatter() {
            @Override
            public String getFormattedValue(float value) {
                return String.format(Locale.getDefault(), "%.0f", value);
            }
        });
        chart.getAxisRight().setEnabled(false);

        // 🔹 X축 설정
        XAxis xAxis = chart.getXAxis();
        xAxis.setPosition(XAxis.XAxisPosition.BOTTOM);
        xAxis.setGranularity(30f);
        xAxis.setLabelCount(5);
        xAxis.setAxisMinimum(0f);
        xAxis.setValueFormatter(new ValueFormatter() {
            @Override
            public String getFormattedValue(float value) {
                return String.format(Locale.getDefault(), "%.0f초", value);
            }
        });

        chart.getDescription().setEnabled(false); // 설명 제거
        chart.notifyDataSetChanged();
        chart.invalidate();
    }
}