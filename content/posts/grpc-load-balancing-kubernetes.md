---
title: "Load balancing gRPC in Kubernetes with Stork"
date: 2026-08-24
draft: false
tags: ["kubernetes", "Quarkus", "gRPC"]
summary: "Load balancing gRPC requests between Quarkus services in Kubernetes with Stork"
---
gRPC uses sticky sessions, which is problematic when load balancing using Kubernetes services.
The first backend that receives the request will keep the connection open and
all further requests will get routed to it.

We can use [SmallRye Stork](https://smallrye.io/smallrye-stork/latest/) to client-side load balance the requests.
Stork provides multiple options that work with Kubernetes with almost no additional configuration.
I found the following options to be the easiest to configure:
- [DNS Service Discovery](https://smallrye.io/smallrye-stork/3.0.1/service-discovery/dns/) - we can use headless Kubernetes services,
this way Stork can get the addresses of all pods and will load balance requests to them. When a new pod gets added or removed, the
Kubernetes DNS will update the Stork DNS query and it will begin/stop routing the requests to the pod.
- [Kubernetes Service Discovery](https://smallrye.io/smallrye-stork/3.0.1/service-discovery/kubernetes/) - we can use the Kubernetes service discovery API, which is probably cleaner,
but requires creating a new service account, role, and role bindings.

In our case we decided to use DNS service discovery, since it was the simplest to set up.
