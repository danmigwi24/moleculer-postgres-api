# Creating a Moleculer.js API with PostgreSQL, Mixins, and Password Encryption

Here's a comprehensive guide to building a Moleculer.js API with PostgreSQL integration, using mixins, and demonstrating password encryption.

## Project Setup

First, let's set up the basic project structure:


### Folder Structure

```
moleculer-postgres-api/
├── .env                    # Environment variables
├── package.json
├── broker.js               # Main broker file
├── services/               # All services
│   ├── db.service.js       # Database service with mixins
│   ├── api.service.js      # API gateway service
│   └── auth.service.js     # Auth service (optional)
├── logs/                   # Log files (auto-created)
│   └── moleculer.log
└── README.md               # Project documentation
```


```bash
# Create a new Moleculer project
mkdir moleculer-postgres-api
cd moleculer-postgres-api
npm init -y
npm install moleculer moleculer-db moleculer-db-adapter-sequelize sequelize pg pg-hstore bcryptjs
```

## 1. Database Service with Mixin

Create a `db.service.js` file that will handle all PostgreSQL operations:

```javascript
const { Service } = require("moleculer");
const DbService = require("moleculer-db");
const SequelizeAdapter = require("moleculer-db-adapter-sequelize");
const Sequelize = require("sequelize");
const bcrypt = require("bcryptjs");

// Password encryption mixin
const PasswordMixin = {
    methods: {
        async encryptPassword(password) {
            const salt = await bcrypt.genSalt(10);
            return await bcrypt.hash(password, salt);
        },
        async comparePassword(password, hash) {
            return await bcrypt.compare(password, hash);
        }
    }
};

module.exports = {
    name: "db",
    mixins: [DbService],
    adapter: new SequelizeAdapter(process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/moleculer_db"),
    model: {
        name: "user",
        define: {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true
            },
            username: {
                type: Sequelize.STRING,
                unique: true,
                allowNull: false
            },
            email: {
                type: Sequelize.STRING,
                unique: true,
                allowNull: false
            },
            password: {
                type: Sequelize.STRING,
                allowNull: false
            },
            createdAt: Sequelize.DATE,
            updatedAt: Sequelize.DATE
        },
        options: {
            // Model options
        }
    },
    
    // Custom mixins
    mixins: [PasswordMixin],
    
    settings: {
        fields: ["id", "username", "email", "createdAt"],
        entityValidator: {
            username: "string|min:3",
            email: "email",
            password: "string|min:6"
        }
    },
    
    actions: {
        // Override create action to hash password
        async create(ctx) {
            const { password, ...entity } = ctx.params;
            const hashedPassword = await this.encryptPassword(password);
            return this.adapter.insert({ ...entity, password: hashedPassword });
        },
        
        // Custom action to authenticate user
        authenticate: {
            params: {
                email: "string",
                password: "string"
            },
            async handler(ctx) {
                const { email, password } = ctx.params;
                const user = await this.adapter.findOne({ email });
                
                if (!user) {
                    throw new Error("Invalid credentials");
                }
                
                const isValid = await this.comparePassword(password, user.password);
                if (!isValid) {
                    throw new Error("Invalid credentials");
                }
                
                // Return user without password
                const { password: _, ...userData } = user;
                return userData;
            }
        }
    },
    
    async afterConnected() {
        // Create tables if they don't exist
        await this.adapter.sync();
    }
};
```

## 2. API Gateway Service

Create an `api.service.js` file to expose the API endpoints:

```javascript
const { Service } = require("moleculer");
const ApiGateway = require("moleculer-web");

module.exports = {
    name: "api",
    mixins: [ApiGateway],
    
    settings: {
        port: process.env.PORT || 3000,
        
        routes: [{
            path: "/api",
            
            // Route whitelist
            whitelist: [
                "db.*"
            ],
            
            // Route-level aliases
            aliases: {
                "POST /users": "db.create",
                "POST /auth": "db.authenticate",
                "GET /users": "db.find",
                "GET /users/:id": "db.get"
            },
            
            // Disable direct DB access
            mappingPolicy: "restrict",
            
            // Enable authentication
            authentication: true,
            
            // Enable body parsers
            bodyParsers: {
                json: true,
                urlencoded: { extended: true }
            }
        }]
    },
    
    methods: {
        // Authentication method
        async authenticate(ctx, route, req) {
            const auth = req.headers["authorization"];
            if (auth && auth.startsWith("Bearer")) {
                const token = auth.slice(7);
                // Verify token here (JWT example)
                try {
                    const user = await ctx.call("auth.resolveToken", { token });
                    return user;
                } catch(err) {
                    return null;
                }
            }
            return null;
        }
    }
};
```

## 3. Auth Service (Optional)

For more complete authentication, you could add an auth service:

```javascript
const { Service } = require("moleculer");
const jwt = require("jsonwebtoken");

module.exports = {
    name: "auth",
    
    settings: {
        jwtSecret: process.env.JWT_SECRET || "moleculer-secret-key"
    },
    
    actions: {
        generateToken: {
            params: {
                user: { type: "object" }
            },
            handler(ctx) {
                return jwt.sign(ctx.params.user, this.settings.jwtSecret, { expiresIn: "1h" });
            }
        },
        
        resolveToken: {
            params: {
                token: "string"
            },
            handler(ctx) {
                return new Promise((resolve, reject) => {
                    jwt.verify(ctx.params.token, this.settings.jwtSecret, (err, decoded) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(decoded);
                        }
                    });
                });
            }
        }
    }
};
```

## 4. Update the DB Service to Use Auth

Modify the `authenticate` action in `db.service.js` to return a token:

```javascript
authenticate: {
    params: {
        email: "string",
        password: "string"
    },
    async handler(ctx) {
        const { email, password } = ctx.params;
        const user = await this.adapter.findOne({ email });
        
        if (!user) {
            throw new Error("Invalid credentials");
        }
        
        const isValid = await this.comparePassword(password, user.password);
        if (!isValid) {
            throw new Error("Invalid credentials");
        }
        
        // Generate token
        const token = await ctx.call("auth.generateToken", {
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
        
        // Return user without password and with token
        const { password: _, ...userData } = user;
        return { ...userData, token };
    }
}
```

## 5. Create broker.js

Create the main broker file:

```javascript
const { ServiceBroker } = require("moleculer");

const broker = new ServiceBroker({
    logger: true,
    logLevel: "info"
});

// Load services
broker.loadServices("./services");

// Start broker
broker.start()
    .then(() => broker.repl())
    .catch(err => console.error(err));
```

## 6. Add Logging Configuration

Based on the Moleculer logging documentation, you can enhance the logging:

```javascript
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
                filename: "logs/moleculer.log",
                formatter: "json"
            }
        }
    ]
});
```

## 7. Running the Project

Add these scripts to your `package.json`:

```json
"scripts": {
    "dev": "nodemon broker.js",
    "start": "node broker.js"
}
```

Then run:

```bash
npm run dev
```

## Testing the API

You can now test the API endpoints:

1. **Create a user**:
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "email": "john@example.com", "password": "secret123"}'
```

2. **Authenticate**:
```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "secret123"}'
```

3. **Get users**:
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Summary

This implementation demonstrates:
1. Moleculer.js service structure
2. PostgreSQL integration using Sequelize
3. Password encryption with bcrypt
4. Custom mixins for reusable functionality
5. JWT authentication
6. REST API endpoints
7. Logging configuration

The password encryption is handled in the mixin and automatically applied when creating users. The authentication process verifies the encrypted passwords without ever storing or transmitting them in plain text.





Here's the complete folder structure and commands needed for your Moleculer.js API with PostgreSQL, mixins, and password encryption:

### Commands Needed

1. **Initialize the project**:
```bash
mkdir moleculer-postgres-api
cd moleculer-postgres-api
npm init -y
```

2. **Install dependencies**:
```bash
npm install moleculer moleculer-db moleculer-db-adapter-sequelize sequelize pg pg-hstore bcryptjs jsonwebtoken dotenv
```

3. **For development (with hot reload)**:
```bash
npm install --save-dev nodemon
```

4. **Add scripts to package.json**:
```json
"scripts": {
  "dev": "nodemon broker.js",
  "start": "node broker.js",
  "migrate": "node ./services/db.service.js --migrate"
}
```

5. **Create a .env file**:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/moleculer_db
JWT_SECRET=your-very-secure-secret
PORT=3000
```

6. **Start PostgreSQL (Docker example)**:
```bash
docker run --name moleculer-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

7. **Create database (run in PostgreSQL)**:
```sql
CREATE DATABASE moleculer_db;
```

8. **Run the application**:
```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

### Key Files Content

1. **broker.js**:
```javascript
require("dotenv").config();
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
        filename: "logs/moleculer.log",
        formatter: "json"
      }
    }
  ]
});

// Load services
broker.loadServices("./services");

// Start broker
broker.start()
  .then(() => broker.repl())
  .catch(err => console.error(err));
```

2. **package.json** (example):
```json
{
  "name": "moleculer-postgres-api",
  "version": "1.0.0",
  "description": "Moleculer API with PostgreSQL and password encryption",
  "main": "broker.js",
  "scripts": {
    "dev": "nodemon broker.js",
    "start": "node broker.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.0.3",
    "jsonwebtoken": "^9.0.0",
    "moleculer": "^0.14.25",
    "moleculer-db": "^0.8.15",
    "moleculer-db-adapter-sequelize": "^0.4.9",
    "moleculer-web": "^0.10.5",
    "pg": "^8.11.0",
    "pg-hstore": "^2.3.4",
    "sequelize": "^6.31.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

### Verification Commands

After starting the service, verify it's working:

1. **Create a user**:
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "securepassword"}'
```

2. **Check logs**:
```bash
tail -f logs/moleculer.log
```

3. **Check database**:
```bash
psql -U postgres -d moleculer_db -c "SELECT * FROM users;"
```

This structure provides a clean separation of concerns with services in their own files, proper environment configuration, and all necessary commands to get started with development and production deployment.