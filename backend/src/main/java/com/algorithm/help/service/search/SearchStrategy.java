package com.algorithm.help.service.search;

import com.algorithm.help.entity.Problem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * 搜索策略接口
 * 不同搜索引擎实现此接口，通过配置切换
 */
public interface SearchStrategy {

    /**
     * 根据关键词搜索题目
     *
     * @param keyword  搜索关键词（中英文均支持）
     * @param pageable 分页参数
     * @return 匹配的题目分页结果
     */
    Page<Problem> search(String keyword, Pageable pageable);

    /**
     * 获取策略名称
     */
    String getName();
}
