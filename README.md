# Atrack AK7V Performance Test Project

![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![InfluxDB](https://img.shields.io/badge/InfluxDB-22ADF6?style=for-the-badge&logo=InfluxDB&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=MinIO&logoColor=white)
![Grafana](https://img.shields.io/badge/grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)


### Real-time Monitoring
![Grafana Demo](GrafanaUI-GIF.gif)


## Objective
The primary objective of this project is to test the performance of the **Atrack AK7V** telematics device. The system captures real-time data from the device, processes it via a Node.js script, stores it in InfluxDB, and visualizes the results in Grafana.

## System Workflow

![System Workflow](System-Workflow.png)



## Architecture Design
![Architecture Design](Architecture-Design.png)


## Technical Components

1.  **Atrack GPS Server**: Receives telemetry from AK7V, parses it, and writes to InfluxDB.
2.  **GPS Sensor Script**: (Optional) Additional script for benchmarking USB GPS sensors.

## Setup & Configuration

### 1. Prerequisites
-   Node.js v14+
-   InfluxDB (Time-series database)
-   MinIO (Object storage for images)
-   Grafana (Visualization)

### 2. Installation
```bash
npm install
```

### 3. Configuration
Create a `.env` file (based on `example/.example.env`):
```env
PORT=1221
INFLUXDB_SERVER_URL=http://localhost:8086
INFLUXDB_ORG=MyOrg
INFLUXDB_BUCKET=VehicleData
INFLUXDB_TOKEN=my-token
MINIO_ENDPOINT=localhost
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

```

### 4. Running the System
```bash
node main.js
```

### 5. Console Commands
To send AT commands to the AK7V device:
```text
{DeviceID}|{Command}
```
Example: `876521358213|AT$INFO=?`

---

## GPS Sensor Experiment (USB)
For testing standalone GPS sensors:
```bash
node scripts/gps_test.js
```

## Visualization (Grafana)
![Grafana Dashboard](GrafanaUI.png)

---
<div align="center">
  <sub>Developed by KNP| Last Updated: Sep 2025</sub>
</div>