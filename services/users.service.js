// services/users.service.js
require('dotenv').config({ path: `${process.cwd()}/project.env` });
const { MoleculerClientError } = require("moleculer").Errors;
const DbService = require("moleculer-db");

const SequelizeAdapter = require("moleculer-db-adapter-sequelize");
const Sequelize = require("sequelize");

const EncryptionMixin = require("../mixins/encryption.mixin");
const { logger } = require('sequelize/lib/utils/logger');
//
const UserModel = require("../models/user.model");


// Create the Sequelize instance first
const sequelize = new Sequelize(
    process.env.DB_URL || 'postgres://postgres:dkimani24@localhost:5444/moleculer_db',
    {
        dialect: 'postgres',
        schema: 'public',
        logging: false
    }
);

// Then create the model using that instance
const model = UserModel(sequelize);


module.exports = {
    name: "users",

    mixins: [
        DbService,
        EncryptionMixin
    ],
    // Use the sequelize instance in the adapter
    adapter: new SequelizeAdapter(sequelize),

    // Use the initialized model
    model: model,


    // These will be set in the created() hook
    //adapter: null,
    //model: null,
    member: null,

    settings: {
        fields: ["id", "username", "email", "active", "role", "createdAt", "updatedAt"],
        entityValidator: {
            username: { type: "string", min: 3, max: 30 },
            email: { type: "email" },
            password: { type: "string", min: 6 }
        }
    },

    hooks: {
        before: {
            create: [
                async function (ctx) {
                    // Hash password before creating user
                    if (ctx.params.password) {
                        ctx.params.password = await this.hashPassword(ctx.params.password);
                    }
                    return ctx;
                }
            ],
            update: [
                async function (ctx) {
                    // Hash password if it's being updated
                    if (ctx.params.password) {
                        ctx.params.password = await this.hashPassword(ctx.params.password);
                    }
                    return ctx;
                }
            ]
        }
    },

    actions: {
        /**
         * Register a new user
         */
        register: {
            params: {
                username: { type: "string", min: 3, max: 30 },
                email: { type: "email" },
                password: { type: "string", min: 6 }
            },
            async handler(ctx) {
                const { username, email, password } = ctx.params;

                // Check if user already exists

                const exists = await this.adapter.findOne({
                    where: { email },
                    raw: false
                });



                if (exists) {
                    throw new MoleculerClientError("Username or email already exists", 422, "ALREADY_EXISTS");
                }

                const hashedPassword = await this.hashPassword(password);

                // Create new user
                return this.adapter.insert({
                    username,
                    email,
                    password: hashedPassword
                });


            }
        },

        /**
         * Login with username and password
         */
        login: {
            params: {
                email: { type: "email" },
                password: { type: "string", min: 1 }
            },
            async handler(ctx) {
                const { email, password } = ctx.params;

                // Find user
                const user = await this.adapter.findOne({
                    where: { email },
                    raw: false
                });

                if (!user) {
                    throw new MoleculerClientError("1 Email or password is invalid", 422, "INVALID_CREDENTIALS");
                }
                this.logger.info(`USER : ${user}`)

                // Check password
                const isValid = await this.comparePassword(password, user.password);
                if (!isValid) {
                    throw new MoleculerClientError("2 Email or password is invalid", 422, "INVALID_CREDENTIALS");
                }

                // Return user without password
                const userData = user.get({ plain: true });
                delete userData.password;

                return {
                    user: userData,
                    token: "JWT_TOKEN_WOULD_GO_HERE" // In a real app, you'd generate a JWT token
                };
            }
        },

        /**
         * Get user by ID (with sensitive fields removed)
         */
        get: {
            auth: "required",
            params: {
                id: { type: "uuid" }
            },
            async handler(ctx) {
                const user = await this.getById(ctx.params.id);
                if (!user) {
                    throw new MoleculerClientError("User not found", 404, "USER_NOT_FOUND");
                }

                // Don't return the password
                delete user.password;

                return user;
            }
        },

        /**
         * Change password for a user
         */
        changePassword: {
            auth: "required",
            params: {
                id: { type: "uuid" },
                oldPassword: { type: "string", min: 1 },
                newPassword: { type: "string", min: 6 }
            },
            async handler(ctx) {
                // Get user with password
                const user = await this.adapter.findById(ctx.params.id);
                if (!user) {
                    throw new MoleculerClientError("User not found", 404, "USER_NOT_FOUND");
                }

                // Verify old password
                const isValid = await this.comparePassword(ctx.params.oldPassword, user.password);
                if (!isValid) {
                    throw new MoleculerClientError("Old password is invalid", 422, "INVALID_PASSWORD");
                }

                // Update with new password
                const update = {
                    password: await this.hashPassword(ctx.params.newPassword)
                };

                return this.adapter.updateById(ctx.params.id, update);
            }
        }
    },

    created() {
        
        const dbService = this.broker.getLocalService("db");
        if (!dbService) {
            throw new Error("DB service not found");
        }
        this.logger.info(`DB service found ${dbService.settings.dk}`)
        this.logger.info(`DB service found ${dbService.settings.sequelize}`)

        this.member = UserModel(dbService.settings.sequelize);
        //
        //this.model = UserModel(dbService.settings.sequelize);
       //this.adapter =  new SequelizeAdapter(sequelize)
    },

    started() {
        this.logger.info(`***************************** - DB_URL ${process.env.DB_URL}`)
    }
};