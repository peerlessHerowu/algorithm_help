package com.algorithm.help.content.generator;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.ArrayList;
import java.util.List;

/**
 * 层级合规校验结果
 */
@Data
@Accessors(chain = true)
public class ComplianceResult {

    /** 是否合规 */
    private boolean compliant;

    /** 不符合的原因列表 */
    private List<String> violations = new ArrayList<>();
}
