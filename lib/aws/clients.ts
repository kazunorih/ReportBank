import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";

const region = process.env.AWS_REGION?.trim() || "ap-northeast-1";

export const cognitoClient = new CognitoIdentityProviderClient({ region });
export const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region }),
  { marshallOptions: { removeUndefinedValues: true } },
);
export const sqsClient = new SQSClient({ region });
