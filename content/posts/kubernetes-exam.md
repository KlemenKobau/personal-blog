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

## Pods

### Quickly create the pod definition file

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