---
title: "Preparing for the CKA exam"
date: 2026-01-12
draft: false
tags: ["kubernetes", "CKA exam", "The Linux foundation"]
summary: "Learning for the Linux foundation Certified Kubernetes administrator exam"
---

- this year learning for the exam
- useful commands
- will update while learing

I decided that 2026 will finally be the year for the CKA exam.
I paid the admission price on cyber monday and got a big discount.

While following the excellent Udemy course [Certified Kubernetes Administrator (CKA) with Practice Tests](https://www.udemy.com/course/certified-kubernetes-administrator-with-practice-tests/) I found some great commands that may come in handy for everyday use.
I will update the page with more examples when I progress more.

## Quickly create the pod definition file

```sh
kubectl run <name> --image=<image name> --dry-run=client -o yaml > pod.yaml
```

This will create the pod definition yaml

```yaml
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: <name>
  name: <name>
spec:
  containers:
  - name: <name>
    image: <image name>
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
```

## [Config map](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/kubectl_create_configmap/)

```sh
kubectl create configmap NAME [--from-file=[key=]source] [--from-literal=key1=value1] [--dry-run=server|client|none]
```

## Update the resource definition

Apply the changes (apply the diff)
```sh
kubectl apply -f <file name>
```

Recreate resources
```sh
kubectl replace -f <file name>
```

If you are changing a field that cannot be updated (for example the nodeName pod parameter)
you can also use (delete and create the resources)
```sh
kubectl replace --force -f <file name>
```

## Expose as a service
```sh
kubectl expose pod valid-pod --port=444 --name=frontend
kubectl expose deployment nginx --port=80 --target-port=8000
```

## Explain command

```sh
kubectl explain <what>
kubectl explain replicaset
```

Describes fields in some kubernetes object.

## Watch for changes
```sh
kubectl get pods --watch
```

## Taints and tolerations

Add taint
```sh
kubectl taint nodes node1 key1=value1:NoSchedule
```

Remove taint
```sh
kubectl taint nodes node1 key1=value1:NoSchedule-
```

## Change labels

```sh
# Update pod 'foo' with the label 'unhealthy' and the value 'true'
kubectl label pods foo unhealthy=true

# Update pod 'foo' with the label 'status' and the value 'unhealthy', overwriting any existing value
kubectl label --overwrite pods foo status=unhealthy

# Update all pods in the namespace
kubectl label pods --all status=unhealthy

# Update a pod identified by the type and name in "pod.json"
kubectl label -f pod.json status=unhealthy

# Update pod 'foo' only if the resource is unchanged from version 1
kubectl label pods foo status=unhealthy --resource-version=1

# Update pod 'foo' by removing a label named 'bar' if it exists
# Does not require the --overwrite flag
kubectl label pods foo bar-
```

## Set default resource limits and requests

Relevant https://kubernetes.io/docs/concepts/policy/limit-range/

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: cpu-resource-constraint
spec:
  limits:
  - default: # this section defines default limits
      cpu: 500m
    defaultRequest: # this section defines default requests
      cpu: 500m
    max: # max and min define the limit range (pod definition cannot override this)
      cpu: "1"
    min:
      cpu: 100m
    type: Container
```

When changing the limits on the pod spec directly, kubernetes will not allow this!
But exiting out of the edit mode will create a temporary file and the
path to the file will be printed in the response

```
error...
A copy of your changes has been saved to "/tmp/...yaml" IMPORTANT
```

## Important kubelet system paths

If the kubelet is running as a systemd process then use `systemctl status kubelet`. The following paths are the defaults and **can be overridden**

Kubelet config path, written in the service status ([kubelet integration](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/kubelet-integration/))
```
/var/lib/kubelet/config.yaml
```

Kubernetes manifests for static pods, written in the kubelet config, specifically the *staticPodPath* variable ([static pods](https://kubernetes.io/docs/tasks/configure-pod-container/static-pod/))
```
/etc/kubernetes/manifests/
```

## Priority classes
Link: [Pod priority and preemption](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/)

Default priority classes
```sh
root@controlplane ~ ➜  k get priorityclasses.scheduling.k8s.io 
NAME                      VALUE        GLOBAL-DEFAULT   AGE   PREEMPTIONPOLICY
system-cluster-critical   2000000000   false            34m   PreemptLowerPriority
system-node-critical      2000001000   false            34m   PreemptLowerPriority
```

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority-nonpreempting
value: 1000000
preemptionPolicy: Never <-- If set to never it will not kill existing pods with a lower priority
globalDefault: false
description: "This priority class will not cause other pods to be preempted."
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  ...
spec:
  containers:
  - name: nginx
    ...
  priorityClassName: high-priority

```

## [Multiple schedulers](https://kubernetes.io/docs/tasks/extend-kubernetes/configure-multiple-schedulers/)

A scheduler can also have multiple [profiles](https://kubernetes.io/docs/reference/scheduling/config/#multiple-profiles).
This may be preferable to multiple schedulers, since the profiles run in the same binary and
avoids race conditions between different schedulers (2 schedulers want to schedule 2 pods on a node with resources for only one).

## [Admission controllers](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/)

## Application lifecycle management

### [Rolling updates and rollbacks](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/)

```sh
# Rollback to the previous deployment
kubectl rollout undo deployment/abc

# Check the rollout status of a daemonset
kubectl rollout status daemonset/foo

# Restart a deployment
kubectl rollout restart deployment/abc

# Restart deployments with the 'app=nginx' label
kubectl rollout restart deployment --selector=app=nginx

# View the rollout history of a deployment
kubectl rollout history deployment/abc

# View the details of daemonset revision 3
kubectl rollout history daemonset/abc --revision=3
```

Deployment strategies
- [Rolling updates](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment)
- [Recreate](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#recreate-deployment)
