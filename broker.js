require('dotenv').config({ path: `${process.cwd()}/project.env` });
const { ServiceBroker } = require("moleculer");

const broker = new ServiceBroker({
  logger: [
    {
      type: "Console",
      options: {
        level: "info",
        formatter: "short"
      }
    },
    {
      type: "File",
      options: {
        level: "debug",
        filename: "moleculer.log",
        formatter: "json"
      }
    }
  ]
});

// Add this to your broker.js after service loading
broker.start().then(async () => {
  try {
      const res = await broker.call("user.create", {
          username: "testuser",
          email: "test@example.com",
          password: "password123"
      });
      console.log("User created:", res);
  } catch (err) {
      console.error("Error:", err);
  }
});

// Load services
broker.loadServices("./services");

// Start broker
broker.start()
  .then(() => broker.repl())
  .catch(err => console.error(err));