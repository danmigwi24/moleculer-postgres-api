
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

  settings: {
    sequelize: null,
    dk: "DANIEL"
  },


  methods: {
    /**
     * Initialize database connection and models
     */
    initDatabase() {
      this.logger.info("Initializing database connection...");
      /*
      this.sequelize = new Sequelize(
        process.env.DB_NAME || "moleculer_api",
        process.env.DB_USER || "postgres",
        process.env.DB_PASSWORD || "postgres",
        {
          host: process.env.DB_HOST || "localhost",
          port: process.env.DB_PORT || 5432, // Default PostgreSQL port is 5432
          dialect: "postgres",
          logging: false,//this.broker.logger.info.bind(this.broker.logger),
          define: {
            timestamps: true
          }
        }
      );
      */
     this.sequelize = new Sequelize(
         process.env.DB_URL || 'postgres://postgres:dkimani24@localhost:5444/moleculer_db',
         {
             dialect: 'postgres',
             schema: 'public',
             logging: false
         }
     )

      this.settings.sequelize = this.sequelize
      // Initialize models
      this.models = {
        user: require("../models/user.model")(this.sequelize)
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

  created() {
    this.initDatabase();

    // Make sure models and sequelize are accessible
    this.broker.metadata.models = this.models;
    this.broker.metadata.sequelize = this.sequelize;
  },


  async created2() {
    this.settings.sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: process.env.DB_DIALECT,
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

    try {
      await this.settings.sequelize.authenticate();
      this.logger.info("Database connection has been established successfully.");
    } catch (err) {
      this.logger.error("Unable to connect to the database:", err);
      throw err;
    }
  },

  async stopped() {
    if (this.settings.sequelize) {
      await this.settings.sequelize.close();
    }
  }
};

