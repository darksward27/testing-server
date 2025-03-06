#!/bin/bash

# Exit on any error
set -e

# Configuration
IMAGE_NAME="nodejs-load-test-server"
IMAGE_TAG="latest"
NAMESPACE="default"

# Build the Docker image
echo "Building Docker image..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# Check if running in a Kubernetes environment with access to a registry
if [ -n "$KUBERNETES_SERVICE_HOST" ]; then
  # If you're using a container registry, you would push the image here
  # For example with Docker Hub:
  # docker tag ${IMAGE_NAME}:${IMAGE_TAG} yourusername/${IMAGE_NAME}:${IMAGE_TAG}
  # docker push yourusername/${IMAGE_NAME}:${IMAGE_TAG}
  
  echo "Note: For a real cluster deployment, you need to push the image to a registry"
  echo "and update the deployment.yaml file with the correct image reference."
fi

# Apply Kubernetes configuration
echo "Deploying to Kubernetes..."
kubectl apply -f deployment.yaml -n ${NAMESPACE}

echo "Deployment completed successfully!"
echo "To check the status of your deployment, run:"
echo "kubectl get pods -n ${NAMESPACE} -l app=nodejs-load-test-server"
echo ""
echo "To access the service (if using minikube):"
echo "minikube service nodejs-load-test-server -n ${NAMESPACE}" 