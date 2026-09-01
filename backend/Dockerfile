# ============================================
# Stage 1: 编译打包
# ============================================
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# 先复制 pom.xml，利用 Docker 缓存层加速依赖下载
COPY pom.xml .
RUN mvn dependency:go-offline -B

# 复制源码并打包（跳过测试加速构建）
COPY src ./src
RUN mvn package -DskipTests -B

# ============================================
# Stage 2: 最小化运行镜像
# ============================================
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# 创建非 root 用户运行应用
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 从构建阶段复制 jar
COPY --from=build /app/target/*.jar app.jar

# 创建必要目录
RUN mkdir -p /app/prompts /app/data/static && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

# JVM 参数优化（容器环境）
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
