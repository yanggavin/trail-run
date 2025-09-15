#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TrailRunInfrastructureStack } from '../lib/trailrun-infrastructure-stack';

const app = new cdk.App();

new TrailRunInfrastructureStack(app, 'TrailRunInfrastructureStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});