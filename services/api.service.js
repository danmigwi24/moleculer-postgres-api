// services/api.service.js
require('dotenv').config({ path: `${process.cwd()}/project.env` });
const ApiGateway = require("moleculer-web");

module.exports = {
  name: "api",
  
  mixins: [ApiGateway],
  
  settings: {
    port: process.env.APP_PORT || 3000,
    
    routes: [
      {
        path: "/api",
        
        whitelist: [
          // Access to any actions in all services
          "**"
        ],
        
        // Enable authentication
        authorization: true,
        
        // Auto-alias for REST services
        autoAliases: true,
        
        // Define authentication
        authentication: true,
        
        // Route options
        bodyParsers: {
          json: true,
          urlencoded: { extended: true }
        },
        
        // Map routes
        aliases: {
          "POST /users/register": "users.register",
          "POST /users/login": "users.login",
          "GET /users/:id": "users.get",
          "PUT /users/:id/password": "users.changePassword",
          //
          "POST /auth/register": "auth.register",
          "POST /auth/login": "auth.login",
          "GET /auth/:id": "auth.get",
          "PUT /auth/:id/password": "auth.changePassword"
        },
        
        // Handle errors
        onError(req, res, err) {
          // Return with the error as JSON object
          res.setHeader("Content-type", "application/json");
          
          if (err.code) {
            res.writeHead(err.code);
          } else {
            res.writeHead(500);
          }
          
          // Return error message
          if (err.name === "MoleculerClientError") {
            res.end(JSON.stringify({
              error: {
                name: err.name,
                message: err.message,
                code: err.code,
                type: err.type
              }
            }));
          } else {
            // Otherwise send back general error
            res.end(JSON.stringify({
              error: {
                name: err.name,
                message: "Server error occurred",
                code: 500
              }
            }));
          }
        }
      }
    ],
    
    // API Gateway authentication
    methods: {
      // Quick implementation - in production, use a proper auth method
      authenticate(ctx, route, req) {
        // Get authorization header
        const auth = req.headers["authorization"];
        
        if (auth && auth.startsWith("Bearer")) {
          const token = auth.slice(7);
          
          // In production, you would verify the JWT token here
          if (token) {
            // For demonstration, we'll just say the user is authenticated
            // In a real app, decode and verify the JWT
            return { id: "some-user-id" };
          }
        }
        
        // If no valid token is found
        return null;
      }
    }
  }
};