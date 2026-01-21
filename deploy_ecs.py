#!/usr/bin/env python3
"""
AWS ECS Fargate Deployment Script for Trevi Frontend
Handles ECR image management, ECS cluster/service deployment, and ALB integration
"""

import argparse
import json
import os
import subprocess
import sys
import time
from typing import Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

# Configuration
PROJECT_NAME = "trevi-fe-pilot-prod"
AWS_REGION = "us-east-1"
CONTAINER_PORT = 3000
DEFAULT_CPU = "512"  # 0.5 vCPU
DEFAULT_MEMORY = "1024"  # 1GB


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(msg: str):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{msg:^70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}\n")


def print_success(msg: str):
    print(f"{Colors.OKGREEN}✓ {msg}{Colors.ENDC}")


def print_error(msg: str):
    print(f"{Colors.FAIL}✗ {msg}{Colors.ENDC}")


def print_info(msg: str):
    print(f"{Colors.OKCYAN}ℹ {msg}{Colors.ENDC}")


def print_warning(msg: str):
    print(f"{Colors.WARNING}⚠ {msg}{Colors.ENDC}")


class AWSDeployer:
    def __init__(self):
        self.ecr_client = boto3.client('ecr', region_name=AWS_REGION)
        self.ecs_client = boto3.client('ecs', region_name=AWS_REGION)
        self.ec2_client = boto3.client('ec2', region_name=AWS_REGION)
        self.elbv2_client = boto3.client('elbv2', region_name=AWS_REGION)
        self.logs_client = boto3.client('logs', region_name=AWS_REGION)
        self.sts_client = boto3.client('sts', region_name=AWS_REGION)
        
        # Get AWS account ID
        self.account_id = self.sts_client.get_caller_identity()['Account']
        self.ecr_repo_uri = f"{self.account_id}.dkr.ecr.{AWS_REGION}.amazonaws.com/{PROJECT_NAME}"
        
    def create_ecr_repository(self) -> str:
        """Create ECR repository if it doesn't exist"""
        try:
            response = self.ecr_client.describe_repositories(
                repositoryNames=[PROJECT_NAME]
            )
            print_info(f"ECR repository already exists: {PROJECT_NAME}")
            return response['repositories'][0]['repositoryUri']
        except ClientError as e:
            if e.response['Error']['Code'] == 'RepositoryNotFoundException':
                print_info(f"Creating ECR repository: {PROJECT_NAME}")
                response = self.ecr_client.create_repository(
                    repositoryName=PROJECT_NAME,
                    imageScanningConfiguration={'scanOnPush': True},
                    encryptionConfiguration={'encryptionType': 'AES256'}
                )
                print_success(f"Created ECR repository: {PROJECT_NAME}")
                return response['repository']['repositoryUri']
            else:
                raise

    def build_and_push_image(self) -> str:
        """Build Docker image and push to ECR"""
        print_header("Building and Pushing Docker Image")
        
        # Create ECR repository
        repo_uri = self.create_ecr_repository()
        image_tag = f"{repo_uri}:latest"
        
        # Get ECR login token
        print_info("Authenticating with ECR...")
        try:
            response = self.ecr_client.get_authorization_token()
            token = response['authorizationData'][0]['authorizationToken']
            endpoint = response['authorizationData'][0]['proxyEndpoint']
            
            # Decode token (it's base64 encoded "AWS:password")
            import base64
            username, password = base64.b64decode(token).decode().split(':')
            
            # Docker login
            subprocess.run(
                ['docker', 'login', '-u', username, '-p', password, endpoint],
                check=True,
                capture_output=True
            )
            print_success("Authenticated with ECR")
        except Exception as e:
            print_error(f"Failed to authenticate with ECR: {e}")
            raise
        
        # Build Docker image
        print_info("Building Docker image (this may take several minutes)...")
        try:
            subprocess.run(
                ['docker', 'build', '-t', image_tag, '.'],
                check=True
            )
            print_success(f"Built Docker image: {image_tag}")
        except subprocess.CalledProcessError as e:
            print_error(f"Docker build failed: {e}")
            raise
        
        # Push to ECR
        print_info("Pushing image to ECR...")
        try:
            subprocess.run(
                ['docker', 'push', image_tag],
                check=True
            )
            print_success(f"Pushed image to ECR: {image_tag}")
        except subprocess.CalledProcessError as e:
            print_error(f"Docker push failed: {e}")
            raise
        
        return image_tag

    def create_log_group(self):
        """Create CloudWatch log group"""
        log_group_name = f"/ecs/{PROJECT_NAME}"
        try:
            self.logs_client.create_log_group(logGroupName=log_group_name)
            self.logs_client.put_retention_policy(
                logGroupName=log_group_name,
                retentionInDays=7
            )
            print_success(f"Created CloudWatch log group: {log_group_name}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceAlreadyExistsException':
                print_info(f"Log group already exists: {log_group_name}")
            else:
                raise

    def get_or_create_ecs_cluster(self) -> str:
        """Get or create ECS cluster"""
        cluster_name = PROJECT_NAME
        try:
            response = self.ecs_client.describe_clusters(clusters=[cluster_name])
            if response['clusters'] and response['clusters'][0]['status'] == 'ACTIVE':
                print_info(f"ECS cluster already exists: {cluster_name}")
                return cluster_name
        except:
            pass
        
        print_info(f"Creating ECS cluster: {cluster_name}")
        self.ecs_client.create_cluster(
            clusterName=cluster_name,
            capacityProviders=['FARGATE'],
            defaultCapacityProviderStrategy=[
                {'capacityProvider': 'FARGATE', 'weight': 1}
            ]
        )
        print_success(f"Created ECS cluster: {cluster_name}")
        return cluster_name

    def create_security_group(self, vpc_id: str, name_suffix: str, description: str) -> str:
        """Create security group"""
        sg_name = f"{PROJECT_NAME}-{name_suffix}"
        
        # Check if SG already exists
        try:
            response = self.ec2_client.describe_security_groups(
                Filters=[
                    {'Name': 'group-name', 'Values': [sg_name]},
                    {'Name': 'vpc-id', 'Values': [vpc_id]}
                ]
            )
            if response['SecurityGroups']:
                sg_id = response['SecurityGroups'][0]['GroupId']
                print_info(f"Security group already exists: {sg_name} ({sg_id})")
                return sg_id
        except:
            pass
        
        # Create new security group
        print_info(f"Creating security group: {sg_name}")
        response = self.ec2_client.create_security_group(
            GroupName=sg_name,
            Description=description,
            VpcId=vpc_id
        )
        sg_id = response['GroupId']
        
        # Tag the security group
        self.ec2_client.create_tags(
            Resources=[sg_id],
            Tags=[
                {'Key': 'Name', 'Value': sg_name},
                {'Key': 'Project', 'Value': PROJECT_NAME}
            ]
        )
        
        print_success(f"Created security group: {sg_name} ({sg_id})")
        return sg_id

    def configure_security_groups(self, vpc_id: str, alb_sg_id: str) -> str:
        """Create and configure security group for ECS tasks"""
        # Create ECS security group
        ecs_sg_id = self.create_security_group(
            vpc_id=vpc_id,
            name_suffix="ecs-sg",
            description=f"Security group for {PROJECT_NAME} ECS tasks"
        )
        
        # Allow traffic from ALB to ECS tasks on port 3000
        try:
            self.ec2_client.authorize_security_group_ingress(
                GroupId=ecs_sg_id,
                IpPermissions=[
                    {
                        'IpProtocol': 'tcp',
                        'FromPort': CONTAINER_PORT,
                        'ToPort': CONTAINER_PORT,
                        'UserIdGroupPairs': [{'GroupId': alb_sg_id}]
                    }
                ]
            )
            print_success(f"Configured ECS security group to allow traffic from ALB on port {CONTAINER_PORT}")
        except ClientError as e:
            if e.response['Error']['Code'] != 'InvalidPermission.Duplicate':
                raise
        
        return ecs_sg_id

    def create_target_group(self, vpc_id: str) -> str:
        """Create ALB target group for frontend"""
        tg_name = f"{PROJECT_NAME}-tg"
        
        # Check if target group already exists
        try:
            response = self.elbv2_client.describe_target_groups(Names=[tg_name])
            if response['TargetGroups']:
                tg_arn = response['TargetGroups'][0]['TargetGroupArn']
                print_info(f"Target group already exists: {tg_name}")
                return tg_arn
        except ClientError:
            pass
        
        # Create target group
        print_info(f"Creating target group: {tg_name}")
        response = self.elbv2_client.create_target_group(
            Name=tg_name,
            Protocol='HTTP',
            Port=CONTAINER_PORT,
            VpcId=vpc_id,
            HealthCheckEnabled=True,
            HealthCheckPath='/',
            HealthCheckProtocol='HTTP',
            HealthCheckIntervalSeconds=30,
            HealthCheckTimeoutSeconds=10,
            HealthyThresholdCount=2,
            UnhealthyThresholdCount=3,
            TargetType='ip',
            Tags=[
                {'Key': 'Name', 'Value': tg_name},
                {'Key': 'Project', 'Value': PROJECT_NAME}
            ]
        )
        
        tg_arn = response['TargetGroups'][0]['TargetGroupArn']
        print_success(f"Created target group: {tg_name}")
        return tg_arn

    def configure_alb_rules(self, alb_arn: str, target_group_arn: str):
        """Configure ALB listener rules for frontend and backend routing"""
        print_info("Configuring ALB listener rules...")
        
        # Get listeners
        listeners = self.elbv2_client.describe_listeners(LoadBalancerArn=alb_arn)
        
        if not listeners['Listeners']:
            print_error("No listeners found on ALB")
            raise Exception("ALB has no listeners configured")
        
        # Configure rules for HTTP listener (port 80)
        http_listener = None
        https_listener = None
        
        for listener in listeners['Listeners']:
            if listener['Port'] == 80:
                http_listener = listener
            elif listener['Port'] == 443:
                https_listener = listener
        
        if not http_listener:
            print_warning("No HTTP listener (port 80) found on ALB")
        
        # Add rules to HTTP listener
        if http_listener:
            self._add_routing_rules(http_listener['ListenerArn'], target_group_arn)
        
        # Add rules to HTTPS listener if it exists
        if https_listener:
            self._add_routing_rules(https_listener['ListenerArn'], target_group_arn)
        
        print_success("ALB listener rules configured")

    def _add_routing_rules(self, listener_arn: str, frontend_tg_arn: str):
        """Add routing rules to a listener"""
        # Get existing rules
        existing_rules = self.elbv2_client.describe_rules(ListenerArn=listener_arn)
        
        # Check if backend rule exists
        backend_rule_exists = False
        frontend_rule_exists = False
        
        for rule in existing_rules['Rules']:
            if rule['IsDefault']:
                continue
            
            for condition in rule.get('Conditions', []):
                if condition['Field'] == 'path-pattern':
                    values = condition.get('Values', [])
                    if '/session/*' in values:
                        backend_rule_exists = True
                        print_info(f"Backend rule (/session/*) already exists with priority {rule['Priority']}")
            
            # Check if this rule points to our frontend target group
            for action in rule.get('Actions', []):
                if action.get('TargetGroupArn') == frontend_tg_arn:
                    frontend_rule_exists = True
                    print_info(f"Frontend rule already exists with priority {rule['Priority']}")
        
        # Add backend rule if it doesn't exist
        if not backend_rule_exists:
            print_warning("Backend rule (/session/*) not found. Please ensure backend target group is configured!")
            print_info("You need to manually create a rule with priority 1 for /session/* pointing to your backend target group")
        
        # Add frontend catch-all rule if it doesn't exist
        if not frontend_rule_exists:
            # Find the highest priority number
            max_priority = 1
            for rule in existing_rules['Rules']:
                if not rule['IsDefault'] and 'Priority' in rule:
                    try:
                        priority = int(rule['Priority'])
                        if priority > max_priority:
                            max_priority = priority
                    except:
                        pass
            
            # Use a high priority for frontend (catch-all)
            frontend_priority = max_priority + 1
            
            print_info(f"Creating frontend rule with priority {frontend_priority}")
            self.elbv2_client.create_rule(
                ListenerArn=listener_arn,
                Priority=frontend_priority,
                Conditions=[
                    {
                        'Field': 'path-pattern',
                        'PathPatternConfig': {
                            'Values': ['/*']
                        }
                    }
                ],
                Actions=[
                    {
                        'Type': 'forward',
                        'TargetGroupArn': frontend_tg_arn
                    }
                ]
            )
            print_success(f"Created frontend rule with priority {frontend_priority}")

    def create_task_definition(
        self, 
        image_uri: str, 
        backend_url: str, 
        cpu: str, 
        memory: str
    ) -> str:
        """Create or update ECS task definition"""
        family_name = PROJECT_NAME
        
        task_def = {
            'family': family_name,
            'networkMode': 'awsvpc',
            'requiresCompatibilities': ['FARGATE'],
            'cpu': cpu,
            'memory': memory,
            'executionRoleArn': f'arn:aws:iam::{self.account_id}:role/ecsTaskExecutionRole',
            'containerDefinitions': [
                {
                    'name': PROJECT_NAME,
                    'image': image_uri,
                    'essential': True,
                    'portMappings': [
                        {
                            'containerPort': CONTAINER_PORT,
                            'protocol': 'tcp'
                        }
                    ],
                    'environment': [
                        {'name': 'NODE_ENV', 'value': 'production'},
                        {'name': 'PORT', 'value': str(CONTAINER_PORT)},
                        {'name': 'BACKEND_URL', 'value': backend_url}
                    ],
                    'logConfiguration': {
                        'logDriver': 'awslogs',
                        'options': {
                            'awslogs-group': f'/ecs/{PROJECT_NAME}',
                            'awslogs-region': AWS_REGION,
                            'awslogs-stream-prefix': 'ecs'
                        }
                    },
                    'healthCheck': {
                        'command': [
                            'CMD-SHELL',
                            'node -e "require(\'http\').get(\'http://localhost:3000/\', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"'
                        ],
                        'interval': 30,
                        'timeout': 10,
                        'retries': 3,
                        'startPeriod': 60
                    }
                }
            ]
        }
        
        print_info(f"Registering task definition: {family_name}")
        response = self.ecs_client.register_task_definition(**task_def)
        task_def_arn = response['taskDefinition']['taskDefinitionArn']
        print_success(f"Registered task definition: {task_def_arn}")
        
        return task_def_arn

    def create_or_update_service(
        self,
        cluster_name: str,
        task_definition_arn: str,
        target_group_arn: str,
        security_group_id: str,
        subnet_ids: List[str]
    ):
        """Create or update ECS service"""
        service_name = PROJECT_NAME
        
        # Check if service exists
        try:
            response = self.ecs_client.describe_services(
                cluster=cluster_name,
                services=[service_name]
            )
            
            if response['services'] and response['services'][0]['status'] == 'ACTIVE':
                print_info(f"Service {service_name} already exists, updating...")
                
                # Update service
                self.ecs_client.update_service(
                    cluster=cluster_name,
                    service=service_name,
                    taskDefinition=task_definition_arn,
                    forceNewDeployment=True
                )
                print_success(f"Updated service: {service_name}")
                return
        except:
            pass
        
        # Create new service
        print_info(f"Creating ECS service: {service_name}")
        
        self.ecs_client.create_service(
            cluster=cluster_name,
            serviceName=service_name,
            taskDefinition=task_definition_arn,
            loadBalancers=[
                {
                    'targetGroupArn': target_group_arn,
                    'containerName': PROJECT_NAME,
                    'containerPort': CONTAINER_PORT
                }
            ],
            desiredCount=1,
            launchType='FARGATE',
            networkConfiguration={
                'awsvpcConfiguration': {
                    'subnets': subnet_ids,
                    'securityGroups': [security_group_id],
                    'assignPublicIp': 'ENABLED'
                }
            },
            healthCheckGracePeriodSeconds=60,
            deploymentConfiguration={
                'maximumPercent': 200,
                'minimumHealthyPercent': 100
            }
        )
        
        print_success(f"Created ECS service: {service_name}")

    def get_alb_info(self, alb_identifier: str) -> Tuple[str, str, List[str]]:
        """Get ALB ARN, VPC ID, and security group IDs from name or ARN"""
        try:
            # Try to describe by ARN first
            if alb_identifier.startswith('arn:'):
                response = self.elbv2_client.describe_load_balancers(
                    LoadBalancerArns=[alb_identifier]
                )
            else:
                # Try by name
                response = self.elbv2_client.describe_load_balancers(
                    Names=[alb_identifier]
                )
            
            if not response['LoadBalancers']:
                raise Exception(f"ALB not found: {alb_identifier}")
            
            alb = response['LoadBalancers'][0]
            alb_arn = alb['LoadBalancerArn']
            vpc_id = alb['VpcId']
            sg_ids = alb['SecurityGroups']
            dns_name = alb['DNSName']
            
            print_success(f"Found ALB: {alb['LoadBalancerName']}")
            print_info(f"  VPC ID: {vpc_id}")
            print_info(f"  DNS Name: {dns_name}")
            print_info(f"  Security Groups: {', '.join(sg_ids)}")
            
            return alb_arn, vpc_id, sg_ids
            
        except ClientError as e:
            print_error(f"Failed to find ALB: {e}")
            raise


def prompt_for_inputs() -> Dict:
    """Prompt user for deployment inputs"""
    print_header("AWS ECS Fargate Deployment Configuration")
    
    config = {}
    
    # ALB selection
    print_info("Enter your existing Application Load Balancer name or ARN")
    print_info("Example: trevi-pilot-be-alb")
    config['alb_identifier'] = input(f"{Colors.OKCYAN}ALB Name/ARN: {Colors.ENDC}").strip()
    
    if not config['alb_identifier']:
        print_error("ALB name/ARN is required")
        sys.exit(1)
    
    # VPC ID (will be auto-detected from ALB, but allow override)
    print_info("\nVPC will be auto-detected from ALB (press Enter to auto-detect)")
    vpc_override = input(f"{Colors.OKCYAN}VPC ID (optional override): {Colors.ENDC}").strip()
    if vpc_override:
        config['vpc_id'] = vpc_override
    
    # Subnets for ECS tasks
    print_info("\nEnter subnet IDs for ECS tasks (comma-separated)")
    print_info("These should be private subnets or public subnets with NAT gateway")
    print_info("Example: subnet-abc123,subnet-def456")
    config['subnet_ids'] = input(f"{Colors.OKCYAN}Subnet IDs: {Colors.ENDC}").strip()
    
    if not config['subnet_ids']:
        print_error("At least one subnet ID is required")
        sys.exit(1)
    
    config['subnet_ids'] = [s.strip() for s in config['subnet_ids'].split(',')]
    
    # Backend URL
    print_info("\nEnter backend URL (default: http://trevi-pilot-be-alb-1938866189.us-east-1.elb.amazonaws.com)")
    backend_url = input(f"{Colors.OKCYAN}Backend URL: {Colors.ENDC}").strip()
    config['backend_url'] = backend_url or 'http://trevi-pilot-be-alb-1938866189.us-east-1.elb.amazonaws.com'
    
    # CPU and Memory
    print_info(f"\nEnter CPU units (default: {DEFAULT_CPU} = 0.5 vCPU)")
    print_info("Options: 256 (0.25), 512 (0.5), 1024 (1), 2048 (2), 4096 (4)")
    cpu = input(f"{Colors.OKCYAN}CPU: {Colors.ENDC}").strip()
    config['cpu'] = cpu or DEFAULT_CPU
    
    print_info(f"\nEnter memory in MB (default: {DEFAULT_MEMORY} = 1GB)")
    print_info("Options depend on CPU - see AWS Fargate docs")
    memory = input(f"{Colors.OKCYAN}Memory (MB): {Colors.ENDC}").strip()
    config['memory'] = memory or DEFAULT_MEMORY
    
    return config


def main():
    parser = argparse.ArgumentParser(
        description='Deploy Trevi Frontend to AWS ECS Fargate'
    )
    parser.add_argument(
        '--mode',
        choices=['initial', 'push-image', 'update-service', 'update-env'],
        default='initial',
        help='Deployment mode'
    )
    parser.add_argument('--vpc-id', help='VPC ID')
    parser.add_argument('--alb-name', help='ALB name or ARN')
    parser.add_argument('--subnets', help='Comma-separated subnet IDs')
    parser.add_argument('--backend-url', help='Backend URL')
    parser.add_argument('--cpu', default=DEFAULT_CPU, help='CPU units')
    parser.add_argument('--memory', default=DEFAULT_MEMORY, help='Memory in MB')
    parser.add_argument('--skip-build', action='store_true', help='Skip Docker build/push')
    
    args = parser.parse_args()
    
    try:
        deployer = AWSDeployer()
        
        if args.mode == 'initial':
            # Full deployment
            print_header("Initial Deployment - Full Setup")
            
            # Get configuration
            if not all([args.alb_name, args.subnets]):
                config = prompt_for_inputs()
            else:
                config = {
                    'alb_identifier': args.alb_name,
                    'vpc_id': args.vpc_id,
                    'subnet_ids': args.subnets.split(','),
                    'backend_url': args.backend_url or 'http://trevi-pilot-be-alb-1938866189.us-east-1.elb.amazonaws.com',
                    'cpu': args.cpu,
                    'memory': args.memory
                }
            
            # Get ALB information
            alb_arn, vpc_id, alb_sg_ids = deployer.get_alb_info(config['alb_identifier'])
            
            # Use detected VPC if not overridden
            if 'vpc_id' not in config or not config['vpc_id']:
                config['vpc_id'] = vpc_id
            
            # Build and push image
            if not args.skip_build:
                image_uri = deployer.build_and_push_image()
            else:
                image_uri = f"{deployer.ecr_repo_uri}:latest"
                print_info(f"Skipping build, using existing image: {image_uri}")
            
            # Create CloudWatch log group
            deployer.create_log_group()
            
            # Create ECS cluster
            cluster_name = deployer.get_or_create_ecs_cluster()
            
            # Create security groups
            ecs_sg_id = deployer.configure_security_groups(config['vpc_id'], alb_sg_ids[0])
            
            # Create target group
            target_group_arn = deployer.create_target_group(config['vpc_id'])
            
            # Configure ALB rules
            deployer.configure_alb_rules(alb_arn, target_group_arn)
            
            # Create task definition
            task_def_arn = deployer.create_task_definition(
                image_uri=image_uri,
                backend_url=config['backend_url'],
                cpu=config['cpu'],
                memory=config['memory']
            )
            
            # Create or update service
            deployer.create_or_update_service(
                cluster_name=cluster_name,
                task_definition_arn=task_def_arn,
                target_group_arn=target_group_arn,
                security_group_id=ecs_sg_id,
                subnet_ids=config['subnet_ids']
            )
            
            print_header("Deployment Complete!")
            print_success("Frontend is being deployed to ECS Fargate")
            print_info(f"Service: {PROJECT_NAME}")
            print_info(f"Cluster: {cluster_name}")
            print_info("Check ECS console for deployment status")
            print_info("\nOnce healthy, access your frontend through the ALB DNS name")
            
        elif args.mode == 'push-image':
            # Just build and push image
            print_header("Building and Pushing Docker Image")
            image_uri = deployer.build_and_push_image()
            print_success(f"Image pushed: {image_uri}")
            print_info("Run with --mode update-service to deploy this image")
            
        elif args.mode == 'update-service':
            # Update service with new image
            print_header("Updating ECS Service")
            
            image_uri = f"{deployer.ecr_repo_uri}:latest"
            backend_url = args.backend_url or 'http://trevi-pilot-be-alb-1938866189.us-east-1.elb.amazonaws.com'
            
            # Create new task definition
            task_def_arn = deployer.create_task_definition(
                image_uri=image_uri,
                backend_url=backend_url,
                cpu=args.cpu,
                memory=args.memory
            )
            
            # Update service
            deployer.ecs_client.update_service(
                cluster=PROJECT_NAME,
                service=PROJECT_NAME,
                taskDefinition=task_def_arn,
                forceNewDeployment=True
            )
            
            print_success("Service updated with new task definition")
            print_info("New deployment in progress - check ECS console")
            
        elif args.mode == 'update-env':
            # Update environment variables (new task definition)
            print_header("Updating Environment Variables")
            
            if not args.backend_url:
                backend_url = input(f"{Colors.OKCYAN}Backend URL: {Colors.ENDC}").strip()
            else:
                backend_url = args.backend_url
            
            image_uri = f"{deployer.ecr_repo_uri}:latest"
            
            # Create new task definition with updated env
            task_def_arn = deployer.create_task_definition(
                image_uri=image_uri,
                backend_url=backend_url,
                cpu=args.cpu,
                memory=args.memory
            )
            
            # Update service
            deployer.ecs_client.update_service(
                cluster=PROJECT_NAME,
                service=PROJECT_NAME,
                taskDefinition=task_def_arn,
                forceNewDeployment=True
            )
            
            print_success("Environment variables updated")
            print_info("New deployment in progress")
        
    except KeyboardInterrupt:
        print_error("\n\nDeployment cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"\n\nDeployment failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
