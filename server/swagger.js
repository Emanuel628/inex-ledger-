import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const setupSwagger = (app) => {
  const port = process.env.PORT || 4000;
  const serverUrl = process.env.API_URL || `http://localhost:${port}`;
  const options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Luna Financial Intelligence API",
        version: "1.0.0",
        description: "Transparent, zero-knowledge financial engine documentation.",
      },
      servers: [{ url: serverUrl }],
    },
    apis: ["./server/routes/*.js"],
  };

  const specs = swaggerJsdoc(options);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));
};

export default setupSwagger;
