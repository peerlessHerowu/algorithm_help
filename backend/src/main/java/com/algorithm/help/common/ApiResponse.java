package com.algorithm.help.common;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 统一 API 响应结构
 *
 * @param <T> 响应数据类型
 */
@Data
@Accessors(chain = true)
public class ApiResponse<T> {

    /** 业务状态码 */
    private int code;

    /** 响应消息 */
    private String message;

    /** 响应数据 */
    private T data;

    /** UTC 毫秒时间戳 */
    private Long timestamp;

    /**
     * 构建成功响应
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<T>()
                .setCode(200)
                .setMessage("success")
                .setData(data)
                .setTimestamp(System.currentTimeMillis());
    }

    /**
     * 构建无数据的成功响应
     */
    public static <T> ApiResponse<T> success() {
        return new ApiResponse<T>()
                .setCode(200)
                .setMessage("success")
                .setTimestamp(System.currentTimeMillis());
    }

    /**
     * 构建错误响应
     */
    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<T>()
                .setCode(code)
                .setMessage(message)
                .setTimestamp(System.currentTimeMillis());
    }
}
