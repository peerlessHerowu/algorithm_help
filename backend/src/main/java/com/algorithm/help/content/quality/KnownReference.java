package com.algorithm.help.content.quality;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 已知权威来源参考文献模型
 */
@Data
@Accessors(chain = true)
public class KnownReference {

    /** 文献正式名称 */
    private String name;

    /** 别名列表（缩写、常用称呼等） */
    private List<String> aliases;

    /** 类型：textbook, course, paper */
    private String type;
}
