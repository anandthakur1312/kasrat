import awsLambdaFastify, { type LambdaResponse, type PromiseHandler } from '@fastify/aws-lambda';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { buildApp } from './app.js';

let cachedHandler: PromiseHandler<APIGatewayProxyEventV2, LambdaResponse> | null = null;

async function getHandler(): Promise<PromiseHandler<APIGatewayProxyEventV2, LambdaResponse>> {
  if (cachedHandler) return cachedHandler;
  const app = await buildApp();
  // awsLambdaFastify must wrap before app.ready() — it adds request decorators
  // (e.g. `request.awsLambda`) which Fastify rejects post-start.
  cachedHandler = awsLambdaFastify(app);
  return cachedHandler;
}

export const handler: PromiseHandler<APIGatewayProxyEventV2, LambdaResponse> = async (event, context) => {
  const h = await getHandler();
  return h(event, context);
};
