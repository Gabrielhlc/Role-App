import swaggerAutogen from "swagger-autogen";

const doc = {
  info: {
    title: "API Rolê ",
    description: "Documentação automatizada das rotas do backend.",
    version: "1.0.0",
  },
  host: "localhost:3000",
  schemes: ["http"],
  securityDefinitions: {
    bearerAuth: {
      type: "apiKey",
      in: "header",
      name: "Authorization",
      description: "Insira o token JWT no formato: Bearer SEU_TOKEN",
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

export const outputFile = "./src/config/swagger-output.json";

const endpointsFiles = ["./src/server.ts"];

swaggerAutogen()(outputFile, endpointsFiles, doc).then(() => {
  console.log(
    "link do Swagger gerado com sucesso em/src/config/swagger-output.json",
  );
});
