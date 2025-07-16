import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export interface PipelineConstructProps {
  githubRepo: string;
  githubBranch: string;
  githubOwner: string;
  ecrRepository: ecr.Repository;
  ecsService: ecs.FargateService;
}

export class PipelineConstruct extends Construct {
  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: PipelineConstructProps) {
    super(scope, id);

    // Create S3 bucket for pipeline artifacts
    const artifactsBucket = new s3.Bucket(this, 'PipelineArtifacts', {
      bucketName: `personalpod-pipeline-artifacts-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create CodeBuild project for building and testing
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: 'personalpod-build',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true, // Required for Docker
        environmentVariables: {
          AWS_DEFAULT_REGION: { value: cdk.Aws.REGION },
          AWS_ACCOUNT_ID: { value: cdk.Aws.ACCOUNT_ID },
          ECR_REPO_URI: { value: props.ecrRepository.repositoryUri },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Installing dependencies...',
              'npm ci',
              'echo Running tests...',
              'npm test',
              'echo Building the Docker image...',
              'docker build -t $ECR_REPO_URI:latest -f api/Dockerfile ./api',
              'docker tag $ECR_REPO_URI:latest $ECR_REPO_URI:$IMAGE_TAG',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing the Docker images...',
              'docker push $ECR_REPO_URI:latest',
              'docker push $ECR_REPO_URI:$IMAGE_TAG',
              'echo Writing image definitions file...',
              'printf \'[{"name":"personalpod-api","imageUri":"%s"}]\' $ECR_REPO_URI:$IMAGE_TAG > imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['imagedefinitions.json'],
        },
      }),
    });

    // Grant ECR permissions to CodeBuild
    props.ecrRepository.grantPullPush(buildProject);

    // Create the pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'personalpod-pipeline',
      artifactBucket: artifactsBucket,
      restartExecutionOnUpdate: true,
    });

    // Source stage
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: props.githubOwner,
      repo: props.githubRepo,
      branch: props.githubBranch,
      oauthToken: cdk.SecretValue.secretsManager('github-token'),
      output: sourceOutput,
    });

    this.pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // Build stage
    const buildOutput = new codepipeline.Artifact('BuildOutput');
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    this.pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    // Deploy stage
    const deployAction = new codepipeline_actions.EcsDeployAction({
      actionName: 'Deploy',
      service: props.ecsService,
      input: buildOutput,
    });

    this.pipeline.addStage({
      stageName: 'Deploy',
      actions: [deployAction],
    });

    // Create CloudWatch Event Rule for pipeline notifications
    // You can add SNS topic for notifications here
  }
}