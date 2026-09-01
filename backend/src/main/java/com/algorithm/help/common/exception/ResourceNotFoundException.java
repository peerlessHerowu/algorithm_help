package com.algorithm.help.common.exception;

/**
 * 资源未找到异常，触发 HTTP 404 响应
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public ResourceNotFoundException(String resourceType, String identifier) {
        super(String.format("%s 不存在: %s", resourceType, identifier));
    }
}
