
const SERVER_KEEP_ALIVE_TIMEOUT = 5000; // Default nodejs http API value in ms
const SERVER_HEADERS_TIMEOUT = 40000; // Default nodejs http API value in ms
const SERVER_STARTUP_DEBUG = false;
const SERVER_STARTUP_THRESHOLD = 3.2; // Number of seconds before you get a warning

// Just a wrapper JS script to run the app directly from node
module.exports = function (appName, startTime) {
  // run app from it's specific folder
  let app = require(`./${appName}/app`);
  if (typeof app.run !== 'function') {
    app = app();
  }

  const PORT = 5000;
  const server = app.listen(PORT, function (err) {
    if (err) {
      return console.error({ err }, err.message);
    }
    return console.log('Listening on 0.0.0.0:%d', PORT);
  });

  server.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT;
  server.headersTimeout = SERVER_HEADERS_TIMEOUT;

  const onShutdown = function () {
    console.log('Shutting down');
    return process.exit();
  };

  process.on('SIGTERM', onShutdown);
  process.on('SIGINT', onShutdown);

  // Keeping track of how long startup times are
  if (!SERVER_STARTUP_DEBUG) {
    return;
  }

  const totalStartupTime = (Date.now() - startTime) / 1000;

  if (totalStartupTime > SERVER_STARTUP_THRESHOLD) {
    return console.warn(
      `Startup time has increased to: ${totalStartupTime} secs. Is this the first time you have started me?`
    );
  } else {
    return console.log(`Startup time: ${totalStartupTime} secs`);
  }
};
