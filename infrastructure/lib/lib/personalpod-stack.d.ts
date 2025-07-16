import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface PersonalPodStackProps extends cdk.StackProps {
    environment?: string;
}
export declare class PersonalPodStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: PersonalPodStackProps);
}
