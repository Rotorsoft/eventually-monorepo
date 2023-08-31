import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventQueryStringParameters
} from "aws-lambda";

export const proxyEvent = (
  httpMethod: "GET" | "POST",
  path: string,
  body: string | null = null,
  headers: APIGatewayProxyEventHeaders = {},
  query?: {
    queryStringParameters: APIGatewayProxyEventQueryStringParameters;
    multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters;
  }
): APIGatewayProxyEvent => ({
  httpMethod,
  path,
  pathParameters: {},
  queryStringParameters: query?.queryStringParameters ?? {},
  multiValueQueryStringParameters: query?.multiValueQueryStringParameters ?? {},
  headers,
  multiValueHeaders: {},
  body,
  isBase64Encoded: false,
  stageVariables: {},
  requestContext: {
    httpMethod,
    path,
    protocol: "",
    apiId: "",
    accountId: "",
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: "",
      user: null,
      userAgent: null,
      userArn: null
    },
    authorizer: {},
    stage: "",
    requestId: "",
    requestTimeEpoch: 0,
    resourceId: "",
    resourcePath: ""
  },
  resource: ""
});
