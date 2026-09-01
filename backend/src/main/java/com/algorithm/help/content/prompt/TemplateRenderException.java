package com.algorithm.help.content.prompt;

/**
 * 模板渲染异常：变量未填充或模板加载失败时抛出
 */
public class TemplateRenderException extends RuntimeException {

    public TemplateRenderException(String message) {
        super(message);
    }

    public TemplateRenderException(String message, Throwable cause) {
        super(message, cause);
    }
}
