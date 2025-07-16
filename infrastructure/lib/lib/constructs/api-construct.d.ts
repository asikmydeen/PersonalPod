import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
export interface ApiConstructProps {
    environment: string;
    apiFunction: lambda.Function;
}
export declare class ApiConstruct extends Construct {
    readonly api: apigateway.RestApi;
    readonly apiUrl: string;
    constructor(scope: Construct, id: string, props: ApiConstructProps);
}
