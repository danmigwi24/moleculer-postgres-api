
// services/db.service.js
require('dotenv').config({ path: `${process.cwd()}/project.env` });
const { ServiceBroker } = require("moleculer");
const { Sequelize } = require("sequelize");
const DbService = require("moleculer-db");
const SqlAdapter = require("moleculer-db-adapter-sequelize");

module.exports = {
  name: "db",
  
  mixins: [DbService],
  
  actions: {
    // Define service actions here
  },

  methods: {
    /**
     * Initialize database connection and models
     */
    initDatabase() {
      this.logger.info("Initializing database connection...");
      
      // Create Sequelize instance
      /*
      this.sequelize = new Sequelize(
        process.env.DB_NAME || "moleculer_api",
        process.env.DB_USER || "postgres",
        process.env.DB_PASSWORD || "postgres",
        {
          host: process.env.DB_HOST || "localhost",
          dialect: "postgres",
          logging: this.broker.logger.info.bind(this.broker.logger),
          define: {
            timestamps: true
          }
        }
      );
      */
      this.sequelize = new Sequelize(
        process.env.DB_NAME || "moleculer_api",
        process.env.DB_USER || "postgres",
        process.env.DB_PASSWORD || "postgres",
        {
          host: process.env.DB_HOST || "localhost",
          port: process.env.DB_PORT || 5432, // Default PostgreSQL port is 5432
          dialect: "postgres",
          logging: this.broker.logger.info.bind(this.broker.logger),
          define: {
            timestamps: true
          }
        }
      );
      
      // Initialize models
      this.models = {
       // user: require("../models/user.model")(this.sequelize, Sequelize)
      };
      
      // Sync models with database
      return this.sequelize.sync({ alter: true })
        .then(() => {
          this.logger.info("Database connection established successfully");
        })
        .catch(err => {
          this.logger.error("Database connection failed", err);
          throw err;
        });
    }
  },
  
//   created() {
//     this.initDatabase();
//   }
created() {
    this.initDatabase();
    
    // Make sure models and sequelize are accessible
    this.broker.metadata.models = this.models;
    this.broker.metadata.sequelize = this.sequelize;
  }
};