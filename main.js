/**
 * @fileoverview Main file for Atrack GPS tracker server.
 *
 * This server listens for incoming connections from Atrack GPS trackers and
 * writes the data to InfluxDB and Minio.
 *
 * @author Atrack
 * @version 1.0.0
 */

const net = require('net');
const AtrackSocket = require('./src/atrackSocket');
const InfluxClient = require('./src/influxDB');
const MinioClient = require('./src/minio');
const { StartConsoleInput } = require('./src/console_input');

// Read .env file
const dotenv = require('dotenv');
dotenv.config();

const SERVER_PORT = process.env.PORT || 1221;

// Connect to InfluxDB
const influxClient = new InfluxClient();
// Connect to Minio
const minioClinet = new MinioClient();
// Prepare connected socket dictionary for storing online client
const connectedSocket = {};

// Create Server
const server = net.createServer(async (socket) => {
  // Create AtrackSocket
  const atrackSocket = new AtrackSocket(socket, influxClient, minioClinet);

  // Handle Socket Data Events
  socket.on("data", (buffer) => {
    atrackSocket.RecievedData(buffer);
  });
  // Handle Socket End Events
  socket.on("end", () => {
    atrackSocket.ClearSocket();
    if (atrackSocket.GetDeviceID() in connectedSocket) {
      delete connectedSocket[atrackSocket.GetDeviceID()];
    }
    console.log(`Client disconnected: ${atrackSocket.GetDeviceID()}`);
  });

  // Get Device ID
  const clientID = await atrackSocket.GetDeviceID();
  if (clientID) {
    connectedSocket[clientID] = atrackSocket;
    console.log(`Client connected: ${clientID}`);
  } else {
    console.log('Failed to optain device id in 60 seconds. Terminating connection.');
    socket.end();
  }
});

// Start Server
server.listen(SERVER_PORT, () => {
  console.log(`Server listening on port ${SERVER_PORT}`);
});

// For test sending cmd from console terminal
StartConsoleInput(server, connectedSocket);

