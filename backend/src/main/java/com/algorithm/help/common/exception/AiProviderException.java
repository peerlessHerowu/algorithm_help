package com.algorithm.help.common.exception;

/**
 * AI Provider 调用异常
 * <p>
 * 当 AI Provider 不可用、调用失败或配置缺失时抛出此异常
 */
public class AiProviderException extends RuntimeException {

    public AiProviderException(String message) {
        super(message);
    }

    public AiProviderException(String message, Throwable cause) {
        super(message, cause);
    }
}
