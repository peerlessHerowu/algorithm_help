package com.algorithm.help.api.problem;

import com.algorithm.help.api.dto.PlatformMappingDTO;
import com.algorithm.help.api.dto.ProblemSaveDTO;
import com.algorithm.help.api.dto.ProblemUpdateDTO;

/**
 * 题目服务 Dubbo 接口
 * 由 Crawler 服务调用，将采集的题目数据写入 Core 服务
 */
public interface ProblemFacade {

    /**
     * 保存新题目
     *
     * @param dto 题目数据
     * @return 题目ID
     */
    Long saveProblem(ProblemSaveDTO dto);

    /**
     * 更新已有题目
     *
     * @param id  题目ID
     * @param dto 更新数据
     */
    void updateProblem(Long id, ProblemUpdateDTO dto);

    /**
     * 检查题目是否重复
     *
     * @param title      题目标题
     * @param platform   来源平台
     * @param platformId 平台题目ID
     * @return 已存在的题目ID，不存在返回 null
     */
    Long checkDuplicate(String title, String platform, String platformId);

    /**
     * 保存跨平台映射关系
     *
     * @param dto 映射数据
     */
    void savePlatformMapping(PlatformMappingDTO dto);
}
