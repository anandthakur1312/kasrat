/// <reference path="./.sst/platform/config.d.ts" />

// SST app configuration for Kasrat backend.
//
// Defines a single AWS Lambda function (Fastify-on-Lambda via @fastify/aws-lambda)
// fronted by a Lambda Function URL. Lives in ap-south-1 (Mumbai).
//
// Secrets are stored via `sst secret set <Name> <value>` per stage. Set them once:
//   npx sst secret set DatabaseUrl     "postgres://..."     --stage prod
//   npx sst secret set ClerkSecretKey  "sk_test_..."         --stage prod
//
// Deploy:
//   npx sst deploy --stage prod
//
// Tear down (only non-prod):
//   npx sst remove  --stage <stage>

export default $config({
  app(input) {
    return {
      name: "kasrat",
      // prod stage: keep resources around if `sst remove` is ever run by accident.
      // anything else (dev, preview, etc.): remove cleanly.
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: { region: "ap-south-1" },
      },
    };
  },

  async run() {
    const databaseUrl = new sst.Secret("DatabaseUrl");
    const clerkSecretKey = new sst.Secret("ClerkSecretKey");

    const api = new sst.aws.Function("Api", {
      handler: "packages/backend/src/lambda.handler",
      runtime: "nodejs20.x",
      timeout: "15 seconds",
      memory: "512 MB",
      url: true,
      link: [databaseUrl, clerkSecretKey],
      environment: {
        DATABASE_URL: databaseUrl.value,
        CLERK_SECRET_KEY: clerkSecretKey.value,
        NODE_ENV: "production",
      },
      // Prisma + Lambda bundling. Three things have to land in the zip:
      //   1. @prisma/client — the public facade (resolved as an npm dep).
      //   2. .prisma/client — the generated implementation that the facade
      //      lazily requires at runtime, including the rhel-openssl-3.0.x
      //      query engine binary. esbuild won't bundle this hidden dir, so
      //      we copy it verbatim into node_modules/ inside the bundle.
      //   3. schema.prisma — Prisma reads this at startup to know the
      //      datasource URL env var name etc.
      nodejs: {
        install: ["@prisma/client"],
      },
      copyFiles: [
        {
          from: "node_modules/.prisma/client",
          to: "node_modules/.prisma/client",
        },
        {
          from: "packages/backend/prisma/schema.prisma",
          to: "schema.prisma",
        },
      ],
    });

    return {
      apiUrl: api.url,
    };
  },
});
