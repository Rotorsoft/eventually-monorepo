import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
//import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from "constructs";

export interface Props {
  path: string;
  handler: string;
  environment: Record<string, string>;
}

export class ServerlessAPI extends Construct {
  public readonly handler: lambda.Function;
  // public readonly store: dynamodb.Table;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // seed from here?
    // this.table = new dynamodb.Table(this, 'EventStore', {
    //     partitionKey: { name: 'path', type: dynamodb.AttributeType.STRING }
    // });

    this.handler = new lambda.Function(this, `${id}Lambda`, {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(props.path),
      handler: props.handler,
      environment: props.environment
    });

    new apigw.LambdaRestApi(this, `${id}RestApi`, {
      handler: this.handler
    });
  }
}
