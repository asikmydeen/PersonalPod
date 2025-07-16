/**
 * DynamoDB Table Creation Script
 * 
 * This script creates the DynamoDB tables for PersonalPod using AWS CDK constructs
 */

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { dynamoTableDefinitions } from './table-definitions';

export class DynamoDBTables extends Construct {
  public readonly searchIndicesTable: dynamodb.Table;
  public readonly sessionManagementTable: dynamodb.Table;
  public readonly cacheTable: dynamodb.Table;
  public readonly syncQueueTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: { environment: string }) {
    super(scope, id);

    const { environment } = props;

    // Search Indices Table
    this.searchIndicesTable = new dynamodb.Table(this, 'SearchIndicesTable', {
      tableName: `${dynamoTableDefinitions.searchIndices.tableName}-${environment}`,
      partitionKey: dynamoTableDefinitions.searchIndices.partitionKey,
      sortKey: dynamoTableDefinitions.searchIndices.sortKey,
      billingMode: dynamoTableDefinitions.searchIndices.billingMode,
      removalPolicy: environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
      stream: dynamoTableDefinitions.searchIndices.stream,
      timeToLiveAttribute: 'ttl',
    });

    // Add GSI to Search Indices Table
    this.searchIndicesTable.addGlobalSecondaryIndex({
      indexName: dynamoTableDefinitions.searchIndices.globalSecondaryIndexes[0].indexName,
      partitionKey: dynamoTableDefinitions.searchIndices.globalSecondaryIndexes[0].partitionKey,
      sortKey: dynamoTableDefinitions.searchIndices.globalSecondaryIndexes[0].sortKey,
      projectionType: dynamoTableDefinitions.searchIndices.globalSecondaryIndexes[0].projectionType,
    });

    // Session Management Table
    this.sessionManagementTable = new dynamodb.Table(this, 'SessionManagementTable', {
      tableName: `${dynamoTableDefinitions.sessionManagement.tableName}-${environment}`,
      partitionKey: dynamoTableDefinitions.sessionManagement.partitionKey,
      sortKey: dynamoTableDefinitions.sessionManagement.sortKey,
      billingMode: dynamoTableDefinitions.sessionManagement.billingMode,
      removalPolicy: environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
      stream: dynamoTableDefinitions.sessionManagement.stream,
      timeToLiveAttribute: 'ttl',
    });

    // Add GSIs to Session Management Table
    dynamoTableDefinitions.sessionManagement.globalSecondaryIndexes.forEach((gsi) => {
      this.sessionManagementTable.addGlobalSecondaryIndex({
        indexName: gsi.indexName,
        partitionKey: gsi.partitionKey,
        sortKey: gsi.sortKey,
        projectionType: gsi.projectionType,
      });
    });

    // Cache Table
    this.cacheTable = new dynamodb.Table(this, 'CacheTable', {
      tableName: `${dynamoTableDefinitions.cache.tableName}-${environment}`,
      partitionKey: dynamoTableDefinitions.cache.partitionKey,
      sortKey: dynamoTableDefinitions.cache.sortKey,
      billingMode: dynamoTableDefinitions.cache.billingMode,
      removalPolicy: RemovalPolicy.DESTROY, // Cache can always be rebuilt
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: 'ttl',
    });

    // Add GSI to Cache Table
    this.cacheTable.addGlobalSecondaryIndex({
      indexName: dynamoTableDefinitions.cache.globalSecondaryIndexes[0].indexName,
      partitionKey: dynamoTableDefinitions.cache.globalSecondaryIndexes[0].partitionKey,
      sortKey: dynamoTableDefinitions.cache.globalSecondaryIndexes[0].sortKey,
      projectionType: dynamoTableDefinitions.cache.globalSecondaryIndexes[0].projectionType,
    });

    // Sync Queue Table
    this.syncQueueTable = new dynamodb.Table(this, 'SyncQueueTable', {
      tableName: `${dynamoTableDefinitions.syncQueue.tableName}-${environment}`,
      partitionKey: dynamoTableDefinitions.syncQueue.partitionKey,
      sortKey: dynamoTableDefinitions.syncQueue.sortKey,
      billingMode: dynamoTableDefinitions.syncQueue.billingMode,
      removalPolicy: environment === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
      stream: dynamoTableDefinitions.syncQueue.stream,
      timeToLiveAttribute: 'ttl',
    });

    // Add GSIs to Sync Queue Table
    dynamoTableDefinitions.syncQueue.globalSecondaryIndexes.forEach((gsi) => {
      this.syncQueueTable.addGlobalSecondaryIndex({
        indexName: gsi.indexName,
        partitionKey: gsi.partitionKey,
        sortKey: gsi.sortKey,
        projectionType: gsi.projectionType,
      });
    });
  }
}