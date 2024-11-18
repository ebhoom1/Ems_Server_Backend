    #include <WiFiClientSecure.h>
    #include <PubSubClient.h>
    #include <ArduinoJson.h>

    // WiFi credentials
    const char* ssid = "BSNL_FibroNET_5850";    // Replace with your WiFi SSID
    const char* password = "JohnBC64";           // Replace with your WiFi password

    // AWS IoT MQTT Broker Details
    const char* MQTT_SERVER = "a3gtwu0ec0i4y6-ats.iot.ap-south-1.amazonaws.com";
    const int MQTT_PORT = 8883;  // Standard port for MQTT over TLS

    // MQTT Topics
    const char* PUB_TOPIC = "ebhoomPub";
    const char* CLIENT_ID = "iotconsole-3be8bc10-ef43-442b-946e-40a559d72a26";

    // Root CA Certificate, Device Certificate, and Private Key
    WiFiClientSecure wifiClient;
    PubSubClient mqttClient(wifiClient);

    // AWS IoT certificates and private key
    const char cacert[] PROGMEM = R"EOF(
    -----BEGIN CERTIFICATE-----
    MIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF
    ADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6
    b24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL
    MAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv
    b3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj
    ca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM
    9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw
    IFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6
    VOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L
    93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm
    jgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC
    AYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA
    A4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI
    U5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs
    N+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv
    o/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU
    5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy
    rqXRfboQnoZsG4q5WTP468SQvvG5
    -----END CERTIFICATE-----
    )EOF";

    const char client_cert[] PROGMEM = R"KEY(
    -----BEGIN CERTIFICATE-----
    MIIDWTCCAkGgAwIBAgIUP0rj7wFReU8JxIw12rg3jDwz5XMwDQYJKoZIhvcNAQEL
    BQAwTTFLMEkGA1UECwxCQW1hem9uIFdlYiBTZXJ2aWNlcyBPPUFtYXpvbi5jb20g
    SW5jLiBMPVNlYXR0bGUgU1Q9V2FzaGluZ3RvbiBDPVVTMB4XDTI0MDEwNjEzMDE0
    MloXDTQ5MTIzMTIzNTk1OVowHjEcMBoGA1UEAwwTQVdTIElvVCBDZXJ0aWZpY2F0
    ZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALnbWGGxlc2fex0BvT2k
    u++47WPBWFdBIR589hN1kNArJH4ZP6WboClEa99UnAmmLLTBIJn1CZ4LAgOM0eem
    1GVrgbagCPnPWiZrMtVHY/hSTx3i1mUnXgIlGqJWKYGvartmHYFV7a3fnSRvXTsU
    f3dvxw5D6+o8mb8V92czswzoUVDfbJfn++g60AYz2CSvUsySYF5zgz8UEtwtMDsz
    CnpxQz+w3Ie3Y4X+ata5e+bzLgKdPOFLVswoZsAk08RSyLmegRAybs82Cj+b9Ahi
    4lIFcpWGCbiCedCs/+v/zqletC41cSD802a9cmpt1fP+PtBCE6GEUv8lCbHYtj2t
    TKsCAwEAAaNgMF4wHwYDVR0jBBgwFoAUSs+TwmP/DoInQrfT0sQzfWYYR4AwHQYD
    VR0OBBYEFN7EE43iGXatMce8ob3alckPoIBrMAwGA1UdEwEB/wQCMAAwDgYDVR0P
    AQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4IBAQC2OutlWws/CsBsd+H1KufukJrk
    H9SKMbe41k+b6x+9y6svIRNSTmGzNPyQOZ8PuBOidebl/2unb/iSrAzWVbHUzevR
    YYiTR6Cv/KhNT2FgjqhG1WUP0fM3ymzDwh8KU0ZEt2qZDP5MTvMzEVHUYabUP2qe
    41hIbCKJjKDiXqcw92/7zYStUlvmLXsOww+KG2iyyudiYD4PCo+uuWl7/psF3JTg
    yxMiwyPmbNgV00AAcf8BoD3frBiRjZR5lNoIwpsrW9ptDn3l7uGmP3LB6kqLzz/t
    2e5T7eSQRFmmbh4HfeVURoqObec3INdqGr9GF34x4+I2THMw5y29o/PpBWrb
    -----END CERTIFICATE-----
    )KEY";

    const char privkey[] PROGMEM = R"KEY(
    -----BEGIN RSA PRIVATE KEY-----
    MIIEpQIBAAKCAQEAudtYYbGVzZ97HQG9PaS777jtY8FYV0EhHnz2E3WQ0Cskfhk/
    pZugKURr31ScCaYstMEgmfUJngsCA4zR56bUZWuBtqAI+c9aJmsy1Udj+FJPHeLW
    ZSdeAiUaolYpga9qu2YdgVXtrd+dJG9dOxR/d2/HDkPr6jyZvxX3ZzOzDOhRUN9s
    l+f76DrQBjPYJK9SzJJgXnODPxQS3C0wOzMKenFDP7Dch7djhf5q1rl75vMuAp08
    4UtWzChmwCTTxFLIuZ6BEDJuzzYKP5v0CGLiUgVylYYJuIJ50Kz/6//OqV60LjVx
    IPzTZr1yam3V8/4+0EIToYRS/yUJsdi2Pa1MqwIDAQABAoIBAQCWcG4B5fUUE9tb
    h2Te2NEnIdFFxeLz/cwJGa014xvs5H8NcvKJ4oap4LBQffQv+0qEpS72b9nxC4f9
    x6bAk9GopnTAlpmtW6HlJzBmYvsQrc9MqahRCKSXp+D/Ni8ywgLq3aVUY3GYJEDW
    lS4p/FWRH/FIIsJ7P8JTYjx4VOjBsId+w/HyjjoSNtxZxFioXzbRTaZ/w0Ksrtvj
    lfCdX8jXjGPGSdbraGS4S41mU0bJgy/WMIcAbYPA3o6CP6PtYkjjGf4qE5agBJia
    z0O3T+YgH1P7jLC9U9XZ2eh+WICQHIC9iAHlMcLBRlaJaeUeXOmv02BL8tNBWcIW
    LnOCVp0BAoGBAPQ/yRAX6La1xe7xQfHiOIyw/wms8vktLsz813qjH7tll7BLrBWz
    NpeGAtL5mcs84KpQkJ2iGV3JmZcbqpoXJ2yKCvAZfCMf8RN8RkL8Zur1xq8KJNPf
    GU/OD2G3xH6IJ9liIFPFP+lly05PrLTYBMK+oY8sT1HwFh7piEkhVhrbAoGBAMLM
    Y8OWMfA40nfqIHxgsYl0T3gjnVP7fxQip+Hl+0QBLIYB0A25mQCn64FivN8L2mmh
    I0wzFu2NOK7SssrtumfbjgA1SOt/kyOgb18/FPUBVsvA9l2G7NXvsxxKsiYzOBYC
    g5wAVq8nFXeI0dB/YGjR5tuiejrBZXTW+2gMp/ZxAoGBAOOcwXEW5s3FrTOTbmHL
    7+jkVHcezbp5aaCrit6FP1/yN56Zlj8OqDQiNWWIJtLn43Gz7GCJm9vzsAbKSHya
    USnrpm/DQBS3goAnEo8ACaSx7zpVWKZ8xGjDXUAx8ZH8ri39LKUELyAAtao/w3Ev
    0Zft8D6tCyoPc33RISkNQOF7AoGAQVE1doSrNAhpkingQLRPc26bowYWH+3pe3/v
    WRC7gt795eU/tQpxokWr8xN/jy6zSs3sPwW2f2rmAcDGkMLLyT1WTP2Q+N4rITwP
    fBlz1n9fciy+rzepvEaGgUsOlz5/ZOns5Wc7qblqOk2XRNkhI6SWSzkc0Qy+D0Jy
    xD3SKBECgYEAoG1nf9EWOvuQ8BUG5QgyCxzXALs5oIbHD/Rm3W529eMgS8Uheh2w
    L6FZqX2Xb9aIYVWWH7yOraLFoCjgnmhXoLGMqNiDMLT8RhmN81D3rMIDO4z0l8Em
    8GCNA9y0BXmHdDaWlK7BWJJXtH45L+69nEO0GxgeuTntV8cQ+RVOIzY=
    -----END RSA PRIVATE KEY-----
    )KEY";

    // Function to connect to WiFi
    void connectWiFi() {
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi...");
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }
    Serial.println("Connected to WiFi");
    }

    // Function to connect to MQTT broker
    void connectMQTT() {
    while (!mqttClient.connected()) {
        Serial.print("Connecting to MQTT...");
        if (mqttClient.connect(CLIENT_ID)) {
        Serial.println("Connected to MQTT broker");
        } else {
        Serial.print("Failed, rc=");
        Serial.print(mqttClient.state());
        Serial.println(" Trying again in 5 seconds");
        delay(5000);
        }
    }
    }

    // Function to publish JSON array data
    void publishData() {
    // Create a JSON array
    DynamicJsonDocument doc(512);

    // Create the first JSON object in the array
    JsonObject data = doc.createNestedArray().createNestedObject();
    data["product_id"] = "6";
    data["userName"] = "6";
    JsonArray stacks = data.createNestedArray("stacks");

    // Add stack data
    JsonObject stack1 = stacks.createNestedObject();
    stack1["stackName"] = "stack_1";
    stack1["ph"] = "7.2";
    stack1["Totalizer_Flow"] = "1050";
    stack1["ammonicalNitrogen"] = "0.8";
    stack1["Fluoride"] = "0.4";
    data["time"] = "12:34:56";

    // Serialize JSON to string
    String payload;
    serializeJson(doc, payload);

    // Publish the data to the MQTT topic
    if (mqttClient.publish(PUB_TOPIC, payload.c_str())) {
        Serial.println("Data published successfully:");
        Serial.println(payload);
    } else {
        Serial.println("Failed to publish data");
    }
    }

    // Setup function
    void setup() {
    Serial.begin(115200);
    
    // Load certificates and set MQTT server
    wifiClient.setCACert(cacert);
    wifiClient.setCertificate(client_cert);
    wifiClient.setPrivateKey(privkey);
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);

    connectWiFi();
    connectMQTT();
    }

    // Loop function
    void loop() {
    if (!mqttClient.connected()) {
        connectMQTT();
    }
    
    mqttClient.loop();
    
    // Publish data every 10 seconds
    publishData();
    delay(10000);
    }
