# Eureka Service

Service registry for microservice discovery.

## Port
8761

## Responsibilities
- Service registration: all microservices register on startup
- Service discovery: provides service locations to Gateway and other services
- Health monitoring

## Tech Stack
- Spring Boot 3.x
- spring-cloud-starter-netflix-eureka-server

## Usage
Services register via spring-cloud-starter-netflix-eureka-client
Gateway routes to lb://service-name using load-balanced URLs
