package com.algorithm.help.archaeology.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * 算法发明时间线事件（嵌入对象，存储在 JSON 列中）
 */
@Data
@Accessors(chain = true)
public class TimelineEvent {

    /** 事件年份 */
    private Integer year;

    /** 事件描述 */
    private String event;

    /** 事件意义 */
    private String significance;
}
