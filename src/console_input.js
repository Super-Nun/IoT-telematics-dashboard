/**
 * Starts the console input listener.
 *
 * @param {Object} server - The server object from the net module.
 * @param {Object} connectedSocket - A dictionary of connected sockets.
 */
function StartConsoleInput(server, connectedSocket) {
  // Set up listener for terminal input
  process.stdin.on('data', (data) => {
    // Data format id|cmd
    const input = data.toString().trim();

    // Check if the input contains '|'
    if (!input.includes('|')) {
      // Print error message if the input does not contain '|'
      console.log("Input does not contain '|'. Expected format 'id|cmd'");
      return;
    }

    // Split input into id and cmd
    const id = input.split('|')[0];
    const cmd = input.split('|')[1];

    // Send the input to the HandleInput function
    // HandleInput(id, cmd, server, connectedSocket);
    HandleInput(cmd, id, server, connectedSocket);
  });
}

/**
 * Handles the input from the terminal console.
 *
 * @param {string} cmd - The command input from the user.
 * @param {string} id - The device ID to target.
 * @param {Object} server - The server object from the net module.
 * @param {Object} connectedSocket - A dictionary of connected sockets.
 */
function HandleInput(cmd, id, server, connectedSocket) {
  // Get the number of connections on the server.
  server.getConnections((err, count) => {
    if (!err && count > 0) {
      // If there are connected clients, get the socket for the specified
      // device ID.
      let socket = connectedSocket[id];

      // Send the command to the client.
      socket.SendCommand(cmd);

      // Print a message to the console with the command and device ID.
      console.log(`Send command ${cmd} to ${id}`);
    } else {
      // If there are no connected clients, print a message to the console
      // with the device ID.
      console.log(`The Device ${id} is not on the connected list.`);
    }
  });
}

module.exports = { StartConsoleInput }
